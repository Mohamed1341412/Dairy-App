// pb_hooks/services/ledger_projection_service.pb.js

/**
 * LedgerProjectionService (v3.0 - Clean Ledger Projection Engine)
 *
 * ⚠️ ARCHITECTURAL BOUNDARY:
 * - مسؤول فقط عن إسقاط Transaction موجود إلى دفاتر الأستاذ
 * - لا ينشئ Transactions
 * - لا يعكس Transactions
 * - يأخذ Transaction جاهزة فقط ويقوم بالـ Projection
 *
 * ⚠️ ATOMICITY RULE:
 * يجب استدعاء هذا الـ Service داخل runInTransaction من قِبَل Domain Hook.
 *
 * ⚠️ GENERIC DESIGN:
 * - يعتمد على tx.type, tx.party_type, tx.direction, tx.is_reversal
 * - لا يحتاج entryType parameter
 * - لا يحتاج reference parameter
 * - يستنتج كل شيء من Transaction نفسها
 *
 * ⚠️ SUPPORTED LEDGERS:
 * - client_ledgers (party_type = 'client')
 * - vendor_ledgers (party_type = 'vendor')
 * - worker_ledgers (party_type = 'worker')
 * - financial_account_ledgers (affects_cashflow = true)
 *
 * ⚠️ CLEAN DESIGN PRINCIPLES:
 * - لا re-query للـ Transaction (يتم تمرير tx object)
 * - لا dependency على أسماء Collections في المعادلات
 * - global_posting_sequence يجب أن يكون موجوداً مسبقاً (setup)
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
   * ⚠️ CLEAN DESIGN:
   * - يعتمد على tx.type, tx.party_type, tx.direction, tx.is_reversal
   * - لا يحتاج entryType parameter
   * - لا يحتاج reference parameter
   * - يكتب في Party Ledger + Financial Account Ledger تلقائياً
   * - يمرر tx object مباشرة (لا re-query)
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

    const direction = tx.get("direction");
    const partyType = tx.get("party_type");
    const accountId = tx.get("account_id");
    const affectsCashflow = tx.get("affects_cashflow");
    const isReversal = tx.get("is_reversal") || false;
    const entryType = tx.get("type");

    // ✅ 1. معالجة حركة الخزينة/البنك (Cashflow)
    if (affectsCashflow) {
      if (!accountId) {
        throw new Error(
          `Transaction affects_cashflow=true but account_id is missing.`,
        );
      }

      if (direction === "in") {
        this._postAccountLedger(dao, accountId, tx, amount, 0, isReversal);
      } else if (direction === "out") {
        this._postAccountLedger(dao, accountId, tx, 0, amount, isReversal);
      } else {
        throw new Error(
          `Invalid direction: ${direction}. Must be 'in' or 'out'.`,
        );
      }
    }

    // ✅ 2. معالجة ذمم الأطراف (Clients, Vendors, Workers)
    if (partyType) {
      if (partyType === "client") {
        const clientId = tx.get("client_id");
        if (!clientId) {
          throw new Error(
            `Transaction has party_type='client' but client_id is missing.`,
          );
        }

        if (direction === "in") {
          this._postPartyLedger(
            dao,
            "clients",
            "client_ledgers",
            "client_id",
            clientId,
            tx,
            partyType,
            0,
            amount,
            isReversal,
          );
        } else if (direction === "out") {
          this._postPartyLedger(
            dao,
            "clients",
            "client_ledgers",
            "client_id",
            clientId,
            tx,
            partyType,
            amount,
            0,
            isReversal,
          );
        } else {
          throw new Error(
            `Invalid direction: ${direction}. Must be 'in' or 'out'.`,
          );
        }
      } else if (partyType === "vendor") {
        const vendorId = tx.get("vendor_id");
        if (!vendorId) {
          throw new Error(
            `Transaction has party_type='vendor' but vendor_id is missing.`,
          );
        }

        if (direction === "out") {
          this._postPartyLedger(
            dao,
            "vendors",
            "vendor_ledgers",
            "vendor_id",
            vendorId,
            tx,
            partyType,
            amount,
            0,
            isReversal,
          );
        } else if (direction === "in") {
          this._postPartyLedger(
            dao,
            "vendors",
            "vendor_ledgers",
            "vendor_id",
            vendorId,
            tx,
            partyType,
            0,
            amount,
            isReversal,
          );
        } else {
          throw new Error(
            `Invalid direction: ${direction}. Must be 'in' or 'out'.`,
          );
        }
      } else if (partyType === "worker") {
        const workerId = tx.get("worker_id");
        if (!workerId) {
          throw new Error(
            `Transaction has party_type='worker' but worker_id is missing.`,
          );
        }

        if (direction === "out") {
          this._postPartyLedger(
            dao,
            "workers",
            "worker_ledgers",
            "worker_id",
            workerId,
            tx,
            partyType,
            amount,
            0,
            isReversal,
          );
        } else if (direction === "in") {
          this._postPartyLedger(
            dao,
            "workers",
            "worker_ledgers",
            "worker_id",
            workerId,
            tx,
            partyType,
            0,
            amount,
            isReversal,
          );
        } else {
          throw new Error(
            `Invalid direction: ${direction}. Must be 'in' or 'out'.`,
          );
        }
      } else {
        throw new Error(
          `Unsupported party_type: ${partyType}. Must be 'client', 'vendor', or 'worker'.`,
        );
      }
    }
  },

  // ==========================================
  // 2. INTERNAL HELPERS
  // ==========================================

  /**
   * حساب الرصيد الجديد بناءً على partyType (ليس collection name).
   * ⚠️ Business Logic معزولة في مكان واحد.
   */
  _calculateNewBalance: function (partyType, oldBalance, debit, credit) {
    // Client: debit يزيد المدين (نستلم منه أقل)
    // Vendor/Worker: credit يزيد الدائن (ندفع له أقل)
    if (partyType === "client") {
      return oldBalance + debit - credit;
    }
    // vendor, worker
    return oldBalance + credit - debit;
  },

  /**
   * إنشاء ledger entry للطرف (client/vendor/worker).
   * ⚠️ يجب استدعاؤها داخل runInTransaction من قِبَل Domain Hook.
   * ⚠️ CLEAN: يأخذ tx object مباشرة (لا re-query).
   */
  _postPartyLedger: function (
    dao,
    partyCollection,
    ledgerCollection,
    partyField,
    partyId,
    tx,
    partyType,
    debit,
    credit,
    isReversal,
  ) {
    if (debit === 0 && credit === 0) return;

    const party = dao.findRecordById(partyCollection, partyId);
    if (!party) throw new Error(`${partyCollection} not found: ${partyId}`);

    const oldBalance = party.getFloat("cached_balance") || 0;

    // ✅ CLEAN: استخدام partyType بدلاً من partyCollection
    const newBalance = this._calculateNewBalance(
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
    ledger.set("is_reversal", isReversal);

    // ✅ CLEAN: استخدام tx object مباشرة (لا re-query)
    ledger.set("ref_type", tx.get("reference_collection") || "");
    ledger.set("ref_id", tx.get("reference_id") || "");
    ledger.set("ref_number", tx.get("reference_number") || "");

    // ✅ Immutable Posting Sequence
    ledger.set("posting_sequence", this._getNextPostingSequence(dao));

    dao.saveRecord(ledger);

    // ✅ تحديث cached_balance على الطرف
    party.set("cached_balance", newBalance);
    dao.saveRecord(party);
  },

  /**
   * إنشاء ledger entry للحساب المالي (cash/bank).
   * ⚠️ يجب استدعاؤها داخل runInTransaction من قِبَل Domain Hook.
   * ⚠️ CLEAN: يأخذ tx object مباشرة (لا re-query).
   */
  _postAccountLedger: function (dao, accountId, tx, debit, credit, isReversal) {
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
    ledger.set("is_reversal", isReversal);

    // ✅ CLEAN: استخدام tx object مباشرة (لا re-query)
    ledger.set("ref_type", tx.get("reference_collection") || "");
    ledger.set("ref_id", tx.get("reference_id") || "");
    ledger.set("ref_number", tx.get("reference_number") || "");

    ledger.set("posting_sequence", this._getNextPostingSequence(dao));

    dao.saveRecord(ledger);

    // ✅ تحديث cached_balance على الحساب المالي
    account.set("cached_balance", newBalance);
    dao.saveRecord(account);
  },

  // ==========================================
  // 3. SEQUENCE GENERATOR (Setup-Dependent)
  // ==========================================

  /**
   * توليد posting_sequence التالي.
   * ⚠️ CLEAN: يعتمد على وجود global_posting_sequence في system_settings.
   * ⚠️ إذا لم يكن موجوداً، يرمي Error (لأنه إعداد يجب إنشاؤه أثناء Setup).
   */
  _getNextPostingSequence: function (dao) {
    const setting = dao.findFirstRecordByFilter(
      "system_settings",
      'key = "global_posting_sequence"',
    );

    // ✅ CLEAN: رمي Error إذا لم يكن الإعداد موجوداً (setup issue)
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
