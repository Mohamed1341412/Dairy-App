// pb_hooks/services/ledger_projection_service.pb.js

/**
 * LedgerProjectionService (v4.0 - Final Clean Design)
 *
 * ⚠️ ARCHITECTURAL BOUNDARY:
 * - مسؤول فقط عن إسقاط Transaction موجود إلى دفاتر الأستاذ
 * - لا ينشئ Transactions
 * - لا يعكس Transactions
 * - يأخذ Transaction جاهزة فقط ويقوم بالـ Projection
 *
 * ⚠️ CLEAN DESIGN PRINCIPLES:
 * - projectTransaction() هو مصدر الحقيقة الوحيد للـ Posting Logic
 * - _applyReversal() هو helper تقني لتطبيق الـ reversal فقط
 * - _calculatePartyBalance() هو helper لحساب الرصيد بناءً على partyType
 * - _postPartyLedger() و _postAccountLedger() هي Dumb Functions (كتابة فقط)
 * - لا يوجد أي Helper يعرف client أو vendor أو worker
 * - لا يوجد Business Logic موزع داخل الـ Helpers
 *
 * ⚠️ ATOMICITY RULE:
 * يجب استدعاء هذا الـ Service داخل runInTransaction من قِبَل Domain Hook.
 */

const LedgerProjectionService = {
  // ==========================================
  // 1. MAIN ORCHESTRATOR (The Entry Point)
  // ==========================================

  /**
   * 🏭 GENERIC PROJECTION ENGINE:
   * إسقاط Transaction موجود إلى دفاتر الأستاذ.
   * ⚠️ يجب استدعاؤها داخل runInTransaction من قِبَل Domain Hook.
   *
   * ⚠️ RESPONSIBILITIES:
   * - تحديد debit/credit لكل Ledger بشكل صريح
   * - تطبيق الـ reversal
   * - استدعاء الـ Dumb Functions للكتابة
   */
  projectTransaction: function (dao, tx) {
    // ✅ Fail-Fast: الصمت في الأنظمة المالية جريمة.
    if (tx.get("status") !== "posted") {
      throw new Error(
        "Critical: Only posted transactions may be projected to ledgers.",
      );
    }

    const amount = tx.getFloat("amount");
    if (amount <= 0) return; // لا توجد حركة مالية

    // ✅ Validation مرة واحدة
    const direction = tx.get("direction");
    if (direction !== "in" && direction !== "out") {
      throw new Error(
        `Invalid direction: ${direction}. Must be 'in' or 'out'.`,
      );
    }

    const isReversal = tx.get("is_reversal") || false;

    // ✅ 1. معالجة حركة الخزينة/البنك (Cashflow)
    if (tx.get("affects_cashflow")) {
      const accountId = tx.get("account_id");
      if (!accountId) {
        throw new Error(
          `Transaction affects_cashflow=true but account_id is missing.`,
        );
      }

      // Financial Account: in → debit, out → credit
      let debit = direction === "in" ? amount : 0;
      let credit = direction === "out" ? amount : 0;

      // Apply reversal
      const posting = this._applyReversal(debit, credit, isReversal);
      this._postAccountLedger(
        dao,
        accountId,
        tx,
        posting.debit,
        posting.credit,
      );
    }

    // ✅ 2. معالجة ذمم الأطراف (Clients, Vendors, Workers)
    const partyType = tx.get("party_type");
    if (partyType) {
      const partyId = tx.get(`${partyType}_id`);
      if (!partyId) {
        throw new Error(
          `Transaction has party_type='${partyType}' but ${partyType}_id is missing.`,
        );
      }

      let debit, credit;

      if (partyType === "client") {
        // Client (Asset - AR): in → credit, out → debit (معكوس)
        debit = direction === "out" ? amount : 0;
        credit = direction === "in" ? amount : 0;
      } else if (partyType === "vendor" || partyType === "worker") {
        // Vendor/Worker (Liability - AP): in → credit, out → debit (معكوس)
        debit = direction === "out" ? amount : 0;
        credit = direction === "in" ? amount : 0;
      } else {
        throw new Error(
          `Unsupported party_type: ${partyType}. Must be 'client', 'vendor', or 'worker'.`,
        );
      }

      // Apply reversal
      const posting = this._applyReversal(debit, credit, isReversal);
      this._postPartyLedger(
        dao,
        partyType,
        partyId,
        tx,
        posting.debit,
        posting.credit,
      );
    }
  },

  // ==========================================
  // 2. REVERSAL HELPER (Technical Only)
  // ==========================================

  /**
   * Helper تقني لتطبيق الـ reversal فقط.
   * ⚠️ لا يعرف شيئاً عن Business Logic.
   * ⚠️ وظيفته الوحيدة: تطبيق الـ reversal (swap debit/credit).
   */
  _applyReversal: function (debit, credit, isReversal) {
    if (isReversal) {
      return { debit: credit, credit: debit };
    }
    return { debit, credit };
  },

  // ==========================================
  // 3. BALANCE CALCULATION HELPER
  // ==========================================

  /**
   * حساب الرصيد الجديد بناءً على partyType.
   * ⚠️ Business Logic معزولة في مكان واحد.
   */
  _calculatePartyBalance: function (partyType, oldBalance, debit, credit) {
    if (partyType === "client") {
      // Client (Asset): debit يزيد، credit يقلل
      return oldBalance + debit - credit;
    }
    // Vendor/Worker (Liability): credit يزيد، debit يقلل
    return oldBalance + credit - debit;
  },

  // ==========================================
  // 4. DUMB FUNCTIONS (Write Only)
  // ==========================================

  /**
   * Dumb Function: كتابة ledger entry للطرف فقط.
   * ⚠️ لا تحتوي أي Business Logic.
   * ⚠️ تستقبل debit و credit جاهزين.
   */
  _postPartyLedger: function (dao, partyType, partyId, tx, debit, credit) {
    if (debit === 0 && credit === 0) return;

    const partyCollection = partyType + "s";
    const ledgerCollection = partyType + "_ledgers";
    const partyField = partyType + "_id";

    const party = dao.findRecordById(partyCollection, partyId);
    if (!party) throw new Error(`${partyCollection} not found: ${partyId}`);

    const oldBalance = party.getFloat("cached_balance") || 0;
    const newBalance = this._calculatePartyBalance(
      partyType,
      oldBalance,
      debit,
      credit,
    );

    const ledger = new $classes.Record(
      dao.findCollectionByNameOrId(ledgerCollection),
    );
    ledger.set(partyField, partyId);
    ledger.set("transaction_id", tx.id);
    ledger.set("entry_type", tx.get("type"));
    ledger.set("debit", debit);
    ledger.set("credit", credit);
    ledger.set("balance_after", newBalance);
    ledger.set("is_reversal", tx.get("is_reversal") || false);

    // Structured Reference من Transaction
    ledger.set("ref_type", tx.get("reference_collection") || "");
    ledger.set("ref_id", tx.get("reference_id") || "");
    ledger.set("ref_number", tx.get("reference_number") || "");

    // Immutable Posting Sequence
    ledger.set("posting_sequence", this._getNextPostingSequence(dao));

    dao.saveRecord(ledger);

    // تحديث cached_balance على الطرف
    party.set("cached_balance", newBalance);
    dao.saveRecord(party);
  },

  /**
   * Dumb Function: كتابة ledger entry للحساب المالي فقط.
   * ⚠️ لا تحتوي أي Business Logic.
   * ⚠️ تستقبل debit و credit جاهزين.
   */
  _postAccountLedger: function (dao, accountId, tx, debit, credit) {
    if (debit === 0 && credit === 0) return;

    const account = dao.findRecordById("financial_accounts", accountId);
    if (!account) throw new Error(`Financial Account not found: ${accountId}`);

    const oldBalance = account.getFloat("cached_balance") || 0;
    const newBalance = oldBalance + debit - credit;

    const ledger = new $classes.Record(
      dao.findCollectionByNameOrId("financial_account_ledgers"),
    );
    ledger.set("account_id", accountId);
    ledger.set("transaction_id", tx.id);
    ledger.set("entry_type", tx.get("type"));
    ledger.set("debit", debit);
    ledger.set("credit", credit);
    ledger.set("balance_after", newBalance);
    ledger.set(
      "entry_date",
      tx.get("business_date") || tx.get("transaction_date"),
    );
    ledger.set("is_reversal", tx.get("is_reversal") || false);

    // Structured Reference من Transaction
    ledger.set("ref_type", tx.get("reference_collection") || "");
    ledger.set("ref_id", tx.get("reference_id") || "");
    ledger.set("ref_number", tx.get("reference_number") || "");

    ledger.set("posting_sequence", this._getNextPostingSequence(dao));

    dao.saveRecord(ledger);

    // تحديث cached_balance على الحساب المالي
    account.set("cached_balance", newBalance);
    dao.saveRecord(account);
  },

  // ==========================================
  // 5. SEQUENCE GENERATOR (Setup-Dependent)
  // ==========================================

  /**
   * توليد posting_sequence التالي.
   * ⚠️ يعتمد على وجود global_posting_sequence في system_settings.
   * ⚠️ إذا لم يكن موجوداً، يرمي Error (لأنه إعداد يجب إنشاؤه أثناء Setup).
   */
  _getNextPostingSequence: function (dao) {
    const setting = dao.findFirstRecordByFilter(
      "system_settings",
      'key = "global_posting_sequence"',
    );

    if (!setting) {
      throw new Error(
        "Critical: global_posting_sequence system setting is missing. Please run system setup.",
      );
    }

    const currentSeq = parseInt(setting.get("value")) || 0;
    const nextSeq = currentSeq + 1;

    setting.set("value", String(nextSeq));
    dao.saveRecord(setting);

    return nextSeq;
  },
};

module.exports = LedgerProjectionService;
