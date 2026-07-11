// pb_hooks/hooks/payroll/payroll_hooks.pb.js

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
 * Payroll Hooks - Business Orchestrator (V1 - Final Production-Ready)
 *
 * ⚠️ ARCHITECTURAL BOUNDARY:
 * - Payroll = Independent Business Document (Accrual Basis).
 * - Orchestrates payroll record lifecycle only.
 * - No payment creation (Payment Module handles cash movement independently).
 * - No ledger projection logic (owned by LedgerProjectionService).
 * - No worker balance calculations (owned by LedgerProjectionService via party_type='worker').
 *
 * ⚠️ LIFECYCLE:
 * draft → approved (Creates Salary Transaction, Liability Recognition)
 * draft → cancelled
 * approved → cancelled (Reverses Transaction - only if unpaid)
 *
 * ⚠️ ATOMICITY RULE:
 * All side effects happen in BeforeUpdate using e.dao to ensure atomicity.
 *
 * ⚠️ FINANCIAL LOGIC:
 * - Approval creates a Transaction with affects_cashflow = false (Liability Recognition).
 * - Worker Ledger is updated automatically by LedgerProjectionService (party_type='worker').
 * - Cancellation reverses the Transaction using TransactionService.reverse().
 * - Cash outflow happens ONLY via Payment Module (not here).
 */

// ==========================================
// CONSTANTS (Single Source of Truth)
// ==========================================

const PAYROLL_RECORDS = "payroll_records";

const VALID_TRANSITIONS = Object.freeze({
  draft: ["approved", "cancelled"],
  approved: ["cancelled"],
  cancelled: [],
});

const IMMUTABLE_FIELDS = Object.freeze([
  "worker_id",
  "month",
  "year",
  "base_salary",
  "bonuses",
  "deductions",
  "gifts",
  "penalties",
  "absence_days",
  "net_salary",
  "business_date",
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
 * Helper: Validate payroll data structure (Fail-Fast)
 */
function validatePayrollData(record) {
  const workerId = record.get("worker_id");
  if (!workerId) {
    throw new Error("Worker is required for payroll record.");
  }

  const month = record.get("month");
  const year = record.get("year");
  if (!month || !year) {
    throw new Error("Payroll period (month and year) is required.");
  }

  const netSalary = record.getFloat("net_salary");
  if (!netSalary || netSalary <= 0) {
    throw new Error(
      `Net salary must be positive. Got: ${netSalary} for worker ${workerId}.`,
    );
  }

  const baseSalary = record.getFloat("base_salary");
  if (!baseSalary || baseSalary <= 0) {
    throw new Error(
      `Base salary must be positive. Got: ${baseSalary} for worker ${workerId}.`,
    );
  }

  // ✅ التحقق من business_date
  if (!record.get("business_date")) {
    throw new Error("Business date is required for payroll record.");
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
    collectionName: PAYROLL_RECORDS,
    recordId: recordId,
    newData: data,
  });
}

// ==========================================
// 1. BEFORE CREATE: Defaults & Reference Number
// ==========================================
onRecordBeforeCreateRequest((e) => {
  // A. Generate Reference Number
  if (!e.record.get("reference_number")) {
    e.record.set(
      "reference_number",
      ReferenceNumberService.generate("PAYROLL"),
    );
  }

  // B. Set Default Status
  if (!e.record.get("status")) {
    e.record.set("status", "draft");
  }
}, PAYROLL_RECORDS);

// ==========================================
// 2. BEFORE CREATE: Validation
// ==========================================
onRecordBeforeCreateRequest((e) => {
  validatePayrollData(e.record);
}, PAYROLL_RECORDS);

// ==========================================
// 3. BEFORE UPDATE: Validation (Draft Only)
// ==========================================
onRecordBeforeUpdateRequest((e) => {
  const oldStatus = e.oldRecord.get("status");
  if (oldStatus === "draft") {
    validatePayrollData(e.record);
  }
}, PAYROLL_RECORDS);

// ==========================================
// 4. BEFORE UPDATE: Lifecycle & Side Effects
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
  const payrollId = e.record.id;
  const payrollRef = e.record.get("reference_number");
  const workerId = e.record.get("worker_id");
  const netSalary = e.record.getFloat("net_salary");
  const businessDate = e.record.get("business_date");

  // ==========================================
  // EVENT: Draft → Approved (Salary Liability Recognition)
  // ==========================================
  if (oldStatus === "draft" && newStatus === "approved") {
    validatePayrollData(e.record);
    // Precondition: Ensure no transaction exists yet (idempotency guard)
    if (e.record.get("transaction_id")) {
      throw new Error(`Payroll ${payrollId} already has a linked transaction.`);
    }

    // 1. Create Salary Transaction (Accrual: No Cashflow yet)
    const txRecord = TransactionService.create(dao, {
      type: "salary",
      partyType: "worker",
      workerId: workerId,
      amount: netSalary,
      direction: "out",
      affectsCashflow: false, // ✅ Crucial: Liability Recognition, not Cash Outflow
      transactionDate: businessDate,
      businessDate: businessDate,
      source: "payroll",
      referenceCollection: PAYROLL_RECORDS,
      referenceId: payrollId,
      referenceNumber: payrollRef,
      paidAmount: 0,
      remainingAmount: netSalary,
      paymentStatus: "unpaid",
    });

    // 2. Project to Ledger (Worker Ledger updated automatically)
    LedgerProjectionService.projectTransaction(dao, txRecord);

    // 3. Link Transaction to Payroll
    e.record.set("transaction_id", txRecord.id);

    logAudit(e, AuditActions.PAYROLL_APPROVED, payrollId, {
      status: "approved",
      transaction_id: txRecord.id,
      worker_id: workerId,
      net_salary: netSalary,
    });
  }

  // ==========================================
  // EVENT: Approved → Cancelled (Reversal)
  // ==========================================
  else if (oldStatus === "approved" && newStatus === "cancelled") {
    const transactionId = e.record.get("transaction_id");

    if (!transactionId) {
      throw new Error(
        `Cannot cancel payroll ${payrollId}: No linked transaction found.`,
      );
    }

    // Precondition: Ensure Transaction hasn't been paid via Payment Allocation
    const originalTx = dao.findRecordById("transactions", transactionId);
    if (originalTx.getFloat("paid_amount") > 0) {
      throw new Error(
        `Cannot cancel payroll ${payrollId}: Transaction has been partially or fully paid. Reverse the payment first.`,
      );
    }

    // 1. Create Reversal Transaction (Uses same business date as original)
    const reversalTx = TransactionService.reverse(dao, originalTx, {
      businessDate: businessDate,
    });

    // 2. Project Reversal to Ledger (Worker Ledger reversed automatically)
    LedgerProjectionService.projectTransaction(dao, reversalTx);

    logAudit(e, AuditActions.PAYROLL_CANCELLED, payrollId, {
      status: "cancelled",
      reversal_transaction_id: reversalTx.id,
    });
  }

  // ==========================================
  // EVENT: Draft → Cancelled (No side effects)
  // ==========================================
  else if (oldStatus === "draft" && newStatus === "cancelled") {
    logAudit(e, AuditActions.PAYROLL_CANCELLED, payrollId, {
      status: "cancelled",
    });
  }
}, PAYROLL_RECORDS);

// ==========================================
// 5. BEFORE UPDATE: Immutability Guard
// ==========================================
onRecordBeforeUpdateRequest((e) => {
  const oldStatus = e.oldRecord.get("status");

  if (isImmutableStatus(oldStatus)) {
    for (const field of IMMUTABLE_FIELDS) {
      if (e.oldRecord.get(field) !== e.record.get(field)) {
        throw new Error(
          `Field '${field}' is immutable on ${oldStatus} payroll records.`,
        );
      }
    }
  }
}, PAYROLL_RECORDS);

// ==========================================
// 6. BEFORE DELETE: Delete Protection
// ==========================================
onRecordBeforeDeleteRequest((e) => {
  const status = e.record.get("status");

  if (status !== "draft") {
    throw new Error(
      `Cannot delete a ${status} payroll record. Only draft records can be deleted.`,
    );
  }
}, PAYROLL_RECORDS);
