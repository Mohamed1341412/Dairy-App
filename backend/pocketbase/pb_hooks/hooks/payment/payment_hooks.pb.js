// pb_hooks/hooks/payment/payment_hooks.pb.js

const TransactionService = require(`${__hooks}/services/transaction_service.pb.js`);
const PaymentAllocationService = require(`${__hooks}/services/payment_allocation_service.pb.js`);
const LedgerProjectionService = require(`${__hooks}/services/ledger_projection_service.pb.js`);
const ReferenceNumberService = require(`${__hooks}/services/reference_number_service.pb.js`);
const { AuditActions } = require(`${__hooks}/core/audit_actions.pb.js`);
const { OperationTypes } = require(`${__hooks}/core/operation_types.pb.js`);
const AuditService = require(`${__hooks}/services/audit_service.pb.js`);

/**
 * Payment Hooks - Business Orchestrator
 *
 * ⚠️ ARCHITECTURAL BOUNDARY:
 * - Orchestrates payment lifecycle only
 * - No allocation logic (owned by PaymentAllocationService)
 * - No transaction creation logic (owned by TransactionService)
 * - No ledger projection logic (owned by LedgerProjectionService)
 *
 * ⚠️ ATOMICITY RULE:
 * All side effects happen in BeforeUpdate to ensure atomicity.
 * Status change + transaction + allocations + ledger = single transaction.
 *
 * ⚠️ LIFECYCLE:
 * draft → confirmed → cancelled
 * draft → cancelled
 * confirmed → cancelled (Cancellation = Reversal)
 */

// ==========================================
// CONSTANTS (Single Source of Truth)
// ==========================================

const PAYMENTS = "payments";
const PAYMENT_ALLOCATIONS = "payment_allocations";

const VALID_TRANSITIONS = Object.freeze({
  draft: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  cancelled: [],
});

const IMMUTABLE_AFTER_CONFIRMATION = Object.freeze([
  "account_id",
  "client_id",
  "vendor_id",
  "worker_id",
  "amount",
  "direction",
]);

// ==========================================
// LOCAL HELPERS (Reduce Duplication)
// ==========================================

/**
 * Helper: Extract payment date from payment record
 */
function getPaymentDate(payment) {
  return payment.get("payment_date");
}

/**
 * Helper: Determine party type from payment record
 */
function determinePartyType(payment) {
  if (payment.get("client_id")) return "client";
  if (payment.get("vendor_id")) return "vendor";
  if (payment.get("worker_id")) return "worker";
  throw new Error(
    "Payment must have a party (client_id, vendor_id, or worker_id)."
  );
}

/**
 * Helper: Load payment allocations
 */
function getPaymentAllocations(dao, paymentId) {
  return dao.findRecordsByFilter(
    PAYMENT_ALLOCATIONS,
    `payment_id = "${paymentId}"`
  );
}

/**
 * Helper: Find original transaction for a payment
 */
function getOriginalTransaction(dao, paymentId) {
  return dao.findFirstRecordByFilter(
    "transactions",
    `reference_collection = "${PAYMENTS}" && reference_id = "${paymentId}" && is_reversal = false`
  );
}

/**
 * Helper: Log Audit Entry
 */
function logAudit(e, action, recordId, data) {
  AuditService.log({
    userId: AuditService.getUserId(e),
    action: action,
    operationType: OperationTypes.UPDATE,
    collectionName: PAYMENTS,
    recordId: recordId,
    newData: data,
  });
}

// ==========================================
// 1. BEFORE CREATE: Reference Number Generation
// ==========================================
onRecordBeforeCreateRequest((e) => {
  if (!e.record.get("reference_number")) {
    e.record.set("reference_number", ReferenceNumberService.generate("PAY"));
  }
  if (!e.record.get("status")) {
    e.record.set("status", "draft");
  }
  // Initialize unallocated_amount with full amount
  if (!e.record.get("unallocated_amount")) {
    e.record.set("unallocated_amount", e.record.getFloat("amount"));
  }
}, PAYMENTS);

// ==========================================
// 2. BEFORE UPDATE: Status Transition & Side Effects
// ==========================================
onRecordBeforeUpdateRequest((e) => {
  const dao = e.dao;
  const oldStatus = e.oldRecord.get("status");
  const newStatus = e.record.get("status");

  if (oldStatus === newStatus) return;

  // A. Validate Status Transitions
  if (!VALID_TRANSITIONS[oldStatus]?.includes(newStatus)) {
    throw new Error(
      `Invalid status transition from '${oldStatus}' to '${newStatus}'.`
    );
  }

  // B. Protect Financial Fields After Confirmation
  if (oldStatus !== "draft" && newStatus !== "draft") {
    for (const field of IMMUTABLE_AFTER_CONFIRMATION) {
      if (e.oldRecord.get(field) !== e.record.get(field)) {
        throw new Error(
          `Field '${field}' cannot be modified after payment confirmation.`
        );
      }
    }
  }

  // C. Execute Side Effects Based on Transition
  const paymentId = e.record.id;
  const paymentRef = e.record.get("reference_number");
  const amount = e.record.getFloat("amount");
  const direction = e.record.get("direction");
  const accountId = e.record.get("account_id");
  const partyType = determinePartyType(e.record);
  const partyId = e.record.get(`${partyType}_id`);
  const paymentDate = getPaymentDate(e.record);

  // ==========================================
  // EVENT: Draft → Confirmed (Create Transaction + Execute Allocations)
  // ==========================================
  if (oldStatus === "draft" && newStatus === "confirmed") {
    const allocations = getPaymentAllocations(dao, paymentId);

    // 1. Create payment transaction
    const txRecord = TransactionService.create(dao, {
      type: "payment",
      partyType: partyType,
      [`${partyType}Id`]: partyId,
      amount: amount,
      direction: direction,
      affectsCashflow: true,
      accountId: accountId,
      transactionDate: paymentDate,
      businessDate: paymentDate,
      source: "payment",
      referenceCollection: PAYMENTS,
      referenceId: paymentId,
      referenceNumber: paymentRef,
      paidAmount: 0,
      remainingAmount: amount,
      paymentStatus: "unpaid",
    });

    // 2. Execute allocations (updates transactions + payment_allocations)
    if (allocations.length > 0) {
      PaymentAllocationService.executeAllocations(dao, e.record, allocations);
    }

    // 3. Project to ledger
    LedgerProjectionService.projectTransaction(dao, txRecord);

    logAudit(e, AuditActions.PAYMENT_CONFIRMED, paymentId, {
      status: "confirmed",
      transaction_id: txRecord.id,
    });
  }

  // ==========================================
  // EVENT: Confirmed → Cancelled (Reverse Allocations + Reverse Transaction)
  // ==========================================
  else if (oldStatus === "confirmed" && newStatus === "cancelled") {
    const allocations = getPaymentAllocations(dao, paymentId);
    const originalTx = getOriginalTransaction(dao, paymentId);

    if (!originalTx) {
      throw new Error(
        `Original transaction not found for payment: ${paymentId}`
      );
    }

    // 1. Reverse allocations (restores transactions + deletes allocations)
    if (allocations.length > 0) {
      PaymentAllocationService.reverseAllocations(dao, e.record, allocations);
    }

    // 2. Create reversal transaction
    const reversalTx = TransactionService.reverse(dao, originalTx, {
      businessDate: paymentDate,
    });

    // 3. Project reversal to ledger
    LedgerProjectionService.projectTransaction(dao, reversalTx);

    logAudit(e, AuditActions.PAYMENT_CANCELLED, paymentId, {
      status: "cancelled",
      reversal_transaction_id: reversalTx.id,
    });
  }

  // ==========================================
  // EVENT: Draft → Cancelled (No side effects)
  // ==========================================
  else if (oldStatus === "draft" && newStatus === "cancelled") {
    logAudit(e, AuditActions.PAYMENT_CANCELLED, paymentId, {
      status: "cancelled",
    });
  }
}, PAYMENTS);