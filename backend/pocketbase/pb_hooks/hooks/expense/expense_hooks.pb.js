// pb_hooks/hooks/expense/expense_hooks.pb.js

const TransactionService = require(
  `${__hooks}/services/transaction_service.pb.js`,
);
const LedgerProjectionService = require(
  `${__hooks}/services/ledger_projection_service.pb.js`,
);
const ReferenceNumberService = require(
  `${__hooks}/services/reference_number_service.pb.js`,
);
const { AuditActions } = require(`${__hooks}/core/audit_actions.pb.js`);
const { OperationTypes } = require(`${__hooks}/core/operation_types.pb.js`);
const AuditService = require(`${__hooks}/services/audit_service.pb.js`);

/**
 * Expense Hooks - Business Orchestrator (V1 - Final Production-Ready)
 *
 * ⚠️ ARCHITECTURAL BOUNDARY:
 * - Expense = Independent Business Document (Accrual Basis).
 * - Orchestrates expense lifecycle only.
 * - No payment creation (Payment Module handles cash movement independently).
 * - No ledger projection logic (owned by LedgerProjectionService).
 *
 * ⚠️ LIFECYCLE:
 * draft → approved (Creates Transaction, Expense Recognition)
 * approved → cancelled (Reverses Transaction)
 * draft → cancelled (No side effects)
 *
 * ⚠️ ATOMICITY RULE:
 * All side effects happen in BeforeUpdate using e.dao to ensure atomicity.
 *
 * ⚠️ FINANCIAL LOGIC:
 * - Approval creates a Transaction with affects_cashflow = false (Liability/Expense Recognition).
 * - Cancellation reverses the Transaction using TransactionService.reverse().
 */

// ==========================================
// CONSTANTS (Single Source of Truth)
// ==========================================

const EXPENSES = "expenses";

const VALID_TRANSITIONS = Object.freeze({
  draft: ["approved", "cancelled"],
  approved: ["cancelled"],
  cancelled: [],
});

const IMMUTABLE_FIELDS = Object.freeze([
  "amount",
  "category",
  "date",
  "details",
]);

// ==========================================
// LOCAL HELPERS (Reduce Duplication)
// ==========================================

/**
 * Helper: Check if status is locked for modifications
 */
function isImmutableStatus(status) {
  return status === "approved" || status === "cancelled";
}

/**
 * Helper: Validate expense data structure
 */
function validateExpenseData(record) {
  if (record.getFloat("amount") <= 0) {
    throw new Error("Expense amount must be strictly positive.");
  }
  if (!record.get("category")) {
    throw new Error("Expense category is required.");
  }
  if (!record.get("date")) {
    throw new Error("Expense date is required.");
  }
}

/**
 * Helper: Log Audit Entry
 */
function logAudit(e, action, recordId, data) {
  AuditService.log({
    userId: AuditService.getUserId(e),
    action: action,
    operationType: OperationTypes.UPDATE,
    collectionName: EXPENSES,
    recordId: recordId,
    newData: data,
  });
}

// ==========================================
// 1. BEFORE CREATE: Validation & Defaults
// ==========================================
onRecordBeforeCreateRequest((e) => {
  // A. Validate Data Structure
  validateExpenseData(e.record);

  // B. Generate Reference Number
  if (!e.record.get("reference_number")) {
    e.record.set("reference_number", ReferenceNumberService.generate("EXP"));
  }

  // C. Set Default Status
  if (!e.record.get("status")) {
    e.record.set("status", "draft");
  }
}, EXPENSES);

// ==========================================
// 1.5 BEFORE UPDATE: Validation (Draft Only)
// ==========================================
onRecordBeforeUpdateRequest((e) => {
  // ✅ Validation فقط إذا كان status = draft
  const oldStatus = e.oldRecord.get("status");
  if (oldStatus === "draft") {
    validateExpenseData(e.record);
  }
}, EXPENSES);

// ==========================================
// 2. BEFORE UPDATE: Lifecycle & Side Effects
// ==========================================
onRecordBeforeUpdateRequest((e) => {
  const dao = e.dao;
  const oldStatus = e.oldRecord.get("status");
  const newStatus = e.record.get("status");

  if (oldStatus === newStatus) return;

  // A. Validate Status Transitions
  if (!VALID_TRANSITIONS[oldStatus]?.includes(newStatus)) {
    throw new Error(
      `Invalid status transition from '${oldStatus}' to '${newStatus}'.`,
    );
  }

  // B. Extract Common Data
  const expenseId = e.record.id;
  const expenseRef = e.record.get("reference_number");
  const amount = e.record.getFloat("amount");
  const expenseDate = e.record.get("date");

  // ==========================================
  // EVENT: Draft → Approved (Expense Recognition)
  // ==========================================
  if (oldStatus === "draft" && newStatus === "approved") {
    // 1. Create Financial Transaction (Accrual: No Cashflow yet)
    const txRecord = TransactionService.create(dao, {
      type: "expense",
      amount: amount,
      direction: "out",
      affectsCashflow: false, // ✅ Crucial: Expense Recognition, not Cash Outflow
      transactionDate: expenseDate,
      businessDate: expenseDate,
      source: "expense",
      referenceCollection: EXPENSES,
      referenceId: expenseId,
      referenceNumber: expenseRef,
      paidAmount: 0,
      remainingAmount: amount,
      paymentStatus: "unpaid",
    });

    // 2. Project to Ledger
    LedgerProjectionService.projectTransaction(dao, txRecord);

    // 3. Link Transaction to Expense
    e.record.set("transaction_id", txRecord.id);

    logAudit(e, AuditActions.EXPENSE_APPROVED, expenseId, {
      status: "approved",
      transaction_id: txRecord.id,
    });
  }

  // ==========================================
  // EVENT: Approved → Cancelled (Reversal)
  // ==========================================
  else if (oldStatus === "approved" && newStatus === "cancelled") {
    const transactionId = e.record.get("transaction_id");

    if (!transactionId) {
      throw new Error(
        `Cannot cancel expense ${expenseId}: No linked transaction found.`,
      );
    }

    // Precondition: Ensure it hasn't been paid via Payment Allocation
    const originalTx = dao.findRecordById("transactions", transactionId);
    if (originalTx.getFloat("paid_amount") > 0) {
      throw new Error(
        `Cannot cancel expense ${expenseId}: Transaction has been partially or fully paid. Reverse the payment first.`,
      );
    }

    // 1. Create Reversal Transaction (Uses same business date as original)
    const reversalTx = TransactionService.reverse(dao, originalTx, {
      businessDate: expenseDate,
    });

    // 2. Project Reversal to Ledger
    LedgerProjectionService.projectTransaction(dao, reversalTx);

    logAudit(e, AuditActions.EXPENSE_CANCELLED, expenseId, {
      status: "cancelled",
      reversal_transaction_id: reversalTx.id,
    });
  }

  // ==========================================
  // EVENT: Draft → Cancelled (No side effects)
  // ==========================================
  else if (oldStatus === "draft" && newStatus === "cancelled") {
    logAudit(e, AuditActions.EXPENSE_CANCELLED, expenseId, {
      status: "cancelled",
    });
  }
}, EXPENSES);

// ==========================================
// 3. BEFORE UPDATE: Immutability Guard
// ==========================================
onRecordBeforeUpdateRequest((e) => {
  const oldStatus = e.oldRecord.get("status");

  if (isImmutableStatus(oldStatus)) {
    for (const field of IMMUTABLE_FIELDS) {
      if (e.oldRecord.get(field) !== e.record.get(field)) {
        throw new Error(
          `Field '${field}' is immutable on ${oldStatus} expenses.`,
        );
      }
    }
  }
}, EXPENSES);

// ==========================================
// 4. BEFORE DELETE: Delete Protection
// ==========================================
onRecordBeforeDeleteRequest((e) => {
  const status = e.record.get("status");

  if (status !== "draft") {
    throw new Error(
      `Cannot delete a ${status} expense. Only draft expenses can be deleted.`,
    );
  }
}, EXPENSES);
