// pb_hooks/hooks/finance/finance_hooks.pb.js

const { valuesEqual } = require(`${__hooks}/utils/helpers.pb.js`);

const MONEY_EPSILON = 0.001;

/**
 * Finance Hooks - The Pure Financial Integrity Layer (Final 10/10)
 *
 * ⚠️ ARCHITECTURAL BOUNDARY (Ownership.md & Source of Truth):
 * 1. هذا الـ Hook لا يقوم بأي ترحيل محاسبي (Ledger Projection).
 * 2. هذا الـ Hook لا ينشئ معاملات (Transactions).
 * 3. هذا الـ Hook لا يولد أرقام المعاملات (transaction_number).
 *    (المسؤولية تقع على عاتق Domain Hooks: sales_hooks, purchase_hooks, etc.)
 * 4. دوره الوحيد: الحماية، التحقق من التعارض المتبادل (Mutual Exclusivity)،
 *    فرض قواعد الارتجاع الصارمة، وحماية الـ Immutability.
 */

// ==========================================
// 1. BEFORE CREATE: Strict Validation & Mutual Exclusivity
// ==========================================
onRecordBeforeCreateRequest((e) => {
  const record = e.record;

  // A. ✅ Mutual Exclusivity: Party Type & IDs (Exactly one party owner rule)
  const partyType = record.get("party_type");
  const clientId = record.get("client_id");
  const vendorId = record.get("vendor_id");
  const workerId = record.get("worker_id");

  if (partyType === "client") {
    if (!clientId)
      throw new Error(
        "Validation Failed: party_type is 'client' but client_id is missing.",
      );
    if (vendorId || workerId)
      throw new Error(
        "Validation Failed: A client transaction cannot have vendor_id or worker_id.",
      );
  } else if (partyType === "vendor") {
    if (!vendorId)
      throw new Error(
        "Validation Failed: party_type is 'vendor' but vendor_id is missing.",
      );
    if (clientId || workerId)
      throw new Error(
        "Validation Failed: A vendor transaction cannot have client_id or worker_id.",
      );
  } else if (partyType === "worker") {
    if (!workerId)
      throw new Error(
        "Validation Failed: party_type is 'worker' but worker_id is missing.",
      );
    if (clientId || vendorId)
      throw new Error(
        "Validation Failed: A worker transaction cannot have client_id or vendor_id.",
      );
  }

  // B. ✅ Mutual Exclusivity: Cashflow & Account
  const affectsCashflow = record.get("affects_cashflow");
  const accountId = record.get("account_id");

  if (affectsCashflow && !accountId) {
    throw new Error(
      "Validation Failed: affects_cashflow is true but account_id is missing.",
    );
  }
  if (!affectsCashflow && accountId) {
    throw new Error(
      "Validation Failed: affects_cashflow is false but account_id is provided. Remove account_id or set affects_cashflow to true.",
    );
  }

  // C. ✅ Mutual Exclusivity: Reference Tracking
  const refCollection = record.get("reference_collection");
  const refId = record.get("reference_id");

  if (refCollection && !refId) {
    throw new Error(
      "Validation Failed: reference_collection is set but reference_id is missing.",
    );
  }
  if (refId && !refCollection) {
    throw new Error(
      "Validation Failed: reference_id is set but reference_collection is missing.",
    );
  }

  // D. Strict Reversal Validation
  if (record.get("is_reversal") === true) {
    const originalTxId = record.get("reversal_of");

    if (!originalTxId) {
      throw new Error(
        "A reversal transaction must be linked to an original transaction via 'reversal_of'.",
      );
    }

    const originalTx = $app.dao().findRecordById("transactions", originalTxId);

    if (originalTx.get("status") !== "posted") {
      throw new Error(
        "Can only reverse a transaction that is already 'posted'.",
      );
    }

    if (originalTx.get("is_reversal") === true) {
      throw new Error(
        "Cannot reverse a reversal transaction. Create a new reversal for the original.",
      );
    }

    if (record.get("direction") === originalTx.get("direction")) {
      throw new Error(
        `A reversal transaction must have the opposite direction. Original: '${originalTx.get("direction")}', Reversal: '${record.get("direction")}'.`,
      );
    }

    const originalAmount = originalTx.getFloat("amount");
    const reversalAmount = record.getFloat("amount");
    if (Math.abs(originalAmount - reversalAmount) > MONEY_EPSILON) {
      throw new Error(
        `A reversal amount (${reversalAmount}) must exactly match the original amount (${originalAmount}). Partial reversals are not supported.`,
      );
    }

    // Double Reversal Check (Defense-in-Depth alongside DB Partial Unique Index)
    try {
      $app
        .dao()
        .findFirstRecordByFilter(
          "transactions",
          `reversal_of = "${originalTxId}"`,
        );
      throw new Error("This transaction has already been reversed.");
    } catch (err) {
      if (err.message === "This transaction has already been reversed.")
        throw err;
    }
  }
}, "transactions");

// ==========================================
// 2. BEFORE UPDATE: Immutability & Locking Guards
// ==========================================
onRecordBeforeUpdateRequest((e) => {
  const oldRecord = e.oldRecord;
  const newRecord = e.record;

  // A. Absolute Locking Guard
  if (oldRecord.get("is_locked") === true) {
    throw new Error("Cannot update a locked transaction.");
  }

  // B. Financial Core Immutability Guard
  const status = oldRecord.get("status");
  if (status === "posted" || status === "reversed") {
    // ✅ Added reference_collection and reference_id to protect Audit Trail linkage
    const immutableFields = [
      "amount",
      "direction",
      "party_type",
      "client_id",
      "vendor_id",
      "worker_id",
      "account_id",
      "type",
      "transaction_category",
      "transaction_source",
      "affects_cashflow",
      "status",
      "reversal_of",
      "transaction_date",
      "business_date",
      "reference_collection",
      "reference_id",
    ];

    for (const field of immutableFields) {
      if (!valuesEqual(oldRecord.get(field), newRecord.get(field))) {
        throw new Error(
          `Field '${field}' is immutable on ${status} transactions. Create a reversal instead.`,
        );
      }
    }
  }
}, "transactions");

// ==========================================
// 3. BEFORE DELETE: Soft Delete Enforcement
// ==========================================
onRecordBeforeDeleteRequest((e) => {
  const record = e.record;

  if (
    record.get("status") === "posted" ||
    record.get("status") === "reversed" ||
    record.get("is_locked") === true
  ) {
    throw new Error(
      "Cannot physically delete a posted, reversed, or locked transaction. Use soft-delete or reversal.",
    );
  }
}, "transactions");
