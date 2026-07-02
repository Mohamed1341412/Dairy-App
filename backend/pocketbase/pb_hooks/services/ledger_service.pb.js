// pb_hooks/services/ledger_service.pb.js

/**
 * LedgerService - The Blind Financial Posting Engine (Final v10/10)
 *
 * ⚠️ القواعد الذهبية:
 * 1. هذا الـ Service لا يفتح Transactions بنفسه.
 * 2. لا يقوم بأي اشتقاق ذكي (No Magic). يتلقى الأوامر صريحة من الـ Domain Hooks.
 * 3. يفشل فوراً (Fail-Fast) إذا تم استدعاؤه في حالة غير صحيحة.
 */

const LedgerService = {
  // ==========================================
  // 1. MAIN ORCHESTRATOR (The Entry Point)
  // ==========================================

  /**
   * تقوم بترجمة سجل transaction عام إلى قيود دفترية فعلية.
   * ⚠️ يجب استدعاؤها داخل runInTransaction من قِبَل الـ Domain Hook.
   *
   * @param {Object} dao - الـ Transaction DAO.
   * @param {Record} tx - سجل المعاملة.
   * @param {string} entryType - نوع القيد الدفتري (يُمرر صراحة من الـ Hook).
   * @param {Object} reference - المراجع المهيكلة {type, id, number}.
   */
  projectTransaction: function (dao, tx, entryType, reference) {
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

    const txId = tx.id;
    const entryDate = tx.get("business_date") || tx.get("transaction_date");

    // ✅ 1. معالجة حركة الخزينة/البنك (Cashflow)
    if (affectsCashflow && accountId) {
      if (direction === "in") {
        this.postAccountDebit(
          dao,
          accountId,
          txId,
          amount,
          entryDate,
          entryType,
          reference,
        );
      } else {
        this.postAccountCredit(
          dao,
          accountId,
          txId,
          amount,
          entryDate,
          entryType,
          reference,
        );
      }
    }

    // ✅ 2. معالجة ذمم الأطراف (Clients, Vendors, Workers)
    if (partyType === "client") {
      const clientId = tx.get("client_id");
      if (!clientId) throw new Error("Client transaction missing client_id.");
      if (direction === "in")
        this.postClientCredit(
          dao,
          clientId,
          txId,
          amount,
          entryType,
          reference,
        );
      else
        this.postClientDebit(dao, clientId, txId, amount, entryType, reference);
    } else if (partyType === "vendor") {
      const vendorId = tx.get("vendor_id");
      if (!vendorId) throw new Error("Vendor transaction missing vendor_id.");
      if (direction === "out")
        this.postVendorDebit(dao, vendorId, txId, amount, entryType, reference);
      else
        this.postVendorCredit(
          dao,
          vendorId,
          txId,
          amount,
          entryType,
          reference,
        );
    } else if (partyType === "worker") {
      const workerId = tx.get("worker_id");
      if (!workerId) throw new Error("Worker transaction missing worker_id.");
      if (direction === "out")
        this.postWorkerDebit(dao, workerId, txId, amount, entryType, reference);
      else
        this.postWorkerCredit(
          dao,
          workerId,
          txId,
          amount,
          entryType,
          reference,
        );
    }
  },
  // ==========================================
  // 1. CLIENT LEDGERS
  // ==========================================
  postClientDebit: function (
    dao,
    clientId,
    txId,
    amount,
    entryType,
    reference,
  ) {
    this._postPartyLedger(
      dao,
      "clients",
      "client_ledgers",
      "client_id",
      clientId,
      txId,
      amount,
      0,
      entryType,
      reference,
    );
  },

  postClientCredit: function (
    dao,
    clientId,
    txId,
    amount,
    entryType,
    reference,
  ) {
    this._postPartyLedger(
      dao,
      "clients",
      "client_ledgers",
      "client_id",
      clientId,
      txId,
      0,
      amount,
      entryType,
      reference,
    );
  },

  // ==========================================
  // 2. VENDOR LEDGERS
  // ==========================================
  postVendorDebit: function (
    dao,
    vendorId,
    txId,
    amount,
    entryType,
    reference,
  ) {
    this._postPartyLedger(
      dao,
      "vendors",
      "vendor_ledgers",
      "vendor_id",
      vendorId,
      txId,
      amount,
      0,
      entryType,
      reference,
    );
  },

  postVendorCredit: function (
    dao,
    vendorId,
    txId,
    amount,
    entryType,
    reference,
  ) {
    this._postPartyLedger(
      dao,
      "vendors",
      "vendor_ledgers",
      "vendor_id",
      vendorId,
      txId,
      0,
      amount,
      entryType,
      reference,
    );
  },

  // ==========================================
  // 3. WORKER LEDGERS
  // ==========================================
  postWorkerDebit: function (
    dao,
    workerId,
    txId,
    amount,
    entryType,
    reference,
  ) {
    this._postPartyLedger(
      dao,
      "workers",
      "worker_ledgers",
      "worker_id",
      workerId,
      txId,
      amount,
      0,
      entryType,
      reference,
    );
  },

  postWorkerCredit: function (
    dao,
    workerId,
    txId,
    amount,
    entryType,
    reference,
  ) {
    this._postPartyLedger(
      dao,
      "workers",
      "worker_ledgers",
      "worker_id",
      workerId,
      txId,
      0,
      amount,
      entryType,
      reference,
    );
  },

  // ==========================================
  // 4. FINANCIAL ACCOUNTS
  // ==========================================
  postAccountDebit: function (
    dao,
    accountId,
    txId,
    amount,
    entryDate,
    entryType,
    reference,
  ) {
    this._postAccountLedger(
      dao,
      accountId,
      txId,
      amount,
      0,
      entryDate,
      entryType,
      reference,
    );
  },

  postAccountCredit: function (
    dao,
    accountId,
    txId,
    amount,
    entryDate,
    entryType,
    reference,
  ) {
    this._postAccountLedger(
      dao,
      accountId,
      txId,
      0,
      amount,
      entryDate,
      entryType,
      reference,
    );
  },

  // ==========================================
  // INTERNAL HELPERS
  // ==========================================
  _postPartyLedger: function (
    dao,
    partyCollection,
    ledgerCollection,
    partyField,
    partyId,
    txId,
    debit,
    credit,
    entryType,
    reference,
  ) {
    if (debit === 0 && credit === 0) return;

    const party = dao.findRecordById(partyCollection, partyId);
    if (!party) throw new Error(`${partyCollection} not found: ${partyId}`);

    const oldBalance = party.getFloat("cached_balance") || 0;
    const newBalance =
      partyCollection === "clients"
        ? oldBalance + debit - credit
        : oldBalance + credit - debit;

    const ledger = new $classes.Record(
      dao.findCollectionByNameOrId(ledgerCollection),
    );
    ledger.set(partyField, partyId);
    ledger.set("transaction_id", txId);
    ledger.set("entry_type", entryType);
    ledger.set("debit", debit);
    ledger.set("credit", credit);
    ledger.set("balance_after", newBalance);
    ledger.set("is_reversal", entryType === "reversal");

    // ✅ Structured Reference
    ledger.set("ref_type", reference?.type || "");
    ledger.set("ref_id", reference?.id || "");
    ledger.set("ref_number", reference?.number || "");

    // ✅ Immutable Posting Sequence
    ledger.set("posting_sequence", this._getNextPostingSequence(dao));

    dao.saveRecord(ledger);

    party.set("cached_balance", newBalance);
    dao.saveRecord(party);
  },

  _postAccountLedger: function (
    dao,
    accountId,
    txId,
    debit,
    credit,
    entryDate,
    entryType,
    reference,
  ) {
    if (debit === 0 && credit === 0) return;

    const account = dao.findRecordById("financial_accounts", accountId);
    if (!account) throw new Error(`Financial Account not found: ${accountId}`);

    const oldBalance = account.getFloat("cached_balance") || 0;
    const newBalance = oldBalance + debit - credit;

    const ledger = new $classes.Record(
      dao.findCollectionByNameOrId("financial_account_ledgers"),
    );
    ledger.set("account_id", accountId);
    ledger.set("transaction_id", txId);
    ledger.set("entry_type", entryType);
    ledger.set("debit", debit);
    ledger.set("credit", credit);
    ledger.set("balance_after", newBalance);
    ledger.set("entry_date", entryDate);
    ledger.set("is_reversal", entryType === "reversal");

    ledger.set("ref_type", reference?.type || "");
    ledger.set("ref_id", reference?.id || "");
    ledger.set("ref_number", reference?.number || "");

    ledger.set("posting_sequence", this._getNextPostingSequence(dao));

    dao.saveRecord(ledger);

    account.set("cached_balance", newBalance);
    dao.saveRecord(account);
  },

  // ==========================================
  // SEQUENCE GENERATOR (Race-condition free)
  // ==========================================
  _getNextPostingSequence: function (dao) {
    const setting = dao.findFirstRecordByFilter(
      "system_settings",
      'key = "global_posting_sequence"',
    );
    let currentSeq = 0;

    if (setting) {
      currentSeq = parseInt(setting.get("value")) || 0;
    }

    const nextSeq = currentSeq + 1;

    if (setting) {
      setting.set("value", String(nextSeq));
      dao.saveRecord(setting);
    } else {
      const newSetting = new $classes.Record(
        dao.findCollectionByNameOrId("system_settings"),
      );
      newSetting.set("key", "global_posting_sequence");
      newSetting.set("value", String(nextSeq));
      dao.saveRecord(newSetting);
    }

    return nextSeq;
  },
};

module.exports = LedgerService;
