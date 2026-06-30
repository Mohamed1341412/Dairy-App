// pb_hooks/services/ledger_service.pb.js

/**
 * LedgerService - The Blind Financial Posting Engine (v10/10 Final)
 *
 * - محرك أعمى لا يعرف تفاصيل الأعمال.
 * - يضمن الترتيب الزمني المطلق عبر posting_sequence.
 * - محمي ضد الترحيل المزدوج عبر UNIQUE(transaction_id, entry_type).
 */

const LedgerService = {
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
