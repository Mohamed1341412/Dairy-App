// pb_hooks/hooks/purchase/purchase_hooks.pb.js

const StockService = require(`${__hooks}/services/stock_service.pb.js`);
const MaterialService = require(`${__hooks}/services/material_service.pb.js`);
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
 * Purchase Hooks - Business Orchestrator
 *
 * ⚠️ ARCHITECTURAL BOUNDARY:
 * - Orchestrates purchase order lifecycle only
 * - Supports both products and materials
 * - No reservations (unlike sales — purchases don't reserve stock)
 * - Transaction created only on physical receipt
 *
 * ⚠️ ATOMICITY RULE:
 * All side effects happen in BeforeUpdate to ensure atomicity.
 * Status change + movements + transaction = single transaction.
 *
 * ⚠️ LIFECYCLE:
 * draft → received → returned
 * draft → cancelled
 * received → cancelled (NOT ALLOWED)
 */

// ==========================================
// CONSTANTS (Single Source of Truth)
// ==========================================

const PURCHASES = "purchase_orders";
const PURCHASE_ITEMS = "purchase_order_items";

const VALID_TRANSITIONS = Object.freeze({
  draft: ["received", "cancelled"],
  received: ["returned"],
  returned: [],
  cancelled: [],
});

const IMMUTABLE_AFTER_DRAFT = Object.freeze(["vendor_id", "net_amount"]);

// ==========================================
// LOCAL HELPERS (Reduce Duplication)
// ==========================================

/**
 * Helper: Extract business date from order
 */
function getBusinessDate(order) {
  return order.get("business_date") || order.get("purchase_date");
}

/**
 * Helper: Load purchase order items
 */
function getOrderItems(dao, orderId) {
  return dao.findRecordsByFilter(
    PURCHASE_ITEMS,
    `purchase_order_id = "${orderId}"`,
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
    collectionName: PURCHASES,
    recordId: recordId,
    newData: data,
  });
}

/**
 * Helper: Assert order is in draft status
 */
function assertDraftOrder(dao, orderId, action) {
  let order;
  try {
    order = dao.findRecordById(PURCHASES, orderId);
  } catch (err) {
    throw new Error(`Purchase order not found: ${orderId}`);
  }

  const status = order.get("status");
  if (status !== "draft") {
    const actionWord =
      action === "add" ? "added" : action === "modify" ? "modified" : "deleted";
    throw new Error(
      `Cannot ${action} items of a ${status} order. Only draft orders can have items ${actionWord}.`,
    );
  }
}

/**
 * Helper: Create and save Movement only (doesn't call applyMovement)
 */
function createMovement(dao, options) {
  const movement = new $classes.Record(
    dao.findCollectionByNameOrId(options.collection),
  );

  movement.set(options.idField, options.itemId);
  movement.set("direction", options.direction);
  movement.set("quantity", options.qty);
  movement.set("movement_type", options.movementType);
  movement.set("business_date", options.businessDate);
  movement.set("reference_number", options.referenceNumber);

  dao.saveRecord(movement);
  return movement;
}

/**
 * Helper: Process purchase item movement (product or material)
 */
function processItemMovement(dao, item, options) {
  const qty = item.getFloat("quantity");
  const lineType = item.get("line_type");

  if (lineType === "product") {
    const movement = createMovement(dao, {
      collection: "inventory_movements",
      idField: "product_id",
      itemId: item.get("product_id"),
      direction: options.direction,
      qty: qty,
      movementType: options.movementType,
      businessDate: options.businessDate,
      referenceNumber: options.referenceNumber,
    });
    StockService.applyMovement(dao, movement);
  } else if (lineType === "material") {
    const movement = createMovement(dao, {
      collection: "material_movements",
      idField: "material_id",
      itemId: item.get("material_id"),
      direction: options.direction,
      qty: qty,
      movementType: options.movementType,
      businessDate: options.businessDate,
      referenceNumber: options.referenceNumber,
    });
    MaterialService.applyMovement(dao, movement);
  } else {
    throw new Error(`Unsupported line_type: ${lineType}`);
  }
}

// ==========================================
// 1. BEFORE CREATE: Reference Number Generation
// ==========================================
onRecordBeforeCreateRequest((e) => {
  if (!e.record.get("reference_number")) {
    e.record.set("reference_number", ReferenceNumberService.generate("PO"));
  }
  if (!e.record.get("status")) {
    e.record.set("status", "draft");
  }
}, PURCHASES);

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
      `Invalid status transition from '${oldStatus}' to '${newStatus}'.`,
    );
  }

  // B. Protect Financial Fields After Receipt
  if (oldStatus !== "draft" && newStatus !== "draft") {
    for (const field of IMMUTABLE_AFTER_DRAFT) {
      if (e.oldRecord.get(field) !== e.record.get(field)) {
        throw new Error(`Field '${field}' cannot be modified after receipt.`);
      }
    }
  }

  // C. Execute Side Effects Based on Transition
  const orderId = e.record.id;
  const orderRef = e.record.get("reference_number");
  const vendorId = e.record.get("vendor_id");
  const netAmount = e.record.getFloat("net_amount");
  const businessDate = getBusinessDate(e.record);

  // ==========================================
  // EVENT: Draft → Received (Stock IN + Payable)
  // ==========================================
  if (oldStatus === "draft" && newStatus === "received") {
    const items = getOrderItems(dao, orderId);

    for (const item of items) {
      processItemMovement(dao, item, {
        direction: "in",
        movementType: "purchase",
        businessDate: businessDate,
        referenceNumber: orderRef,
      });
    }

    const txRecord = TransactionService.create(dao, {
      type: "purchase",
      partyType: "vendor",
      vendorId: vendorId,
      amount: netAmount,
      direction: "out",
      affectsCashflow: false,
      transactionDate: businessDate,
      businessDate: businessDate,
      source: "purchase_order",
      referenceCollection: PURCHASES,
      referenceId: orderId,
      referenceNumber: orderRef,
      paidAmount: 0,
      remainingAmount: netAmount,
      paymentStatus: "unpaid",
    });

    LedgerProjectionService.projectTransaction(dao, txRecord);

    logAudit(e, AuditActions.PURCHASE_ORDER_RECEIVED, orderId, {
      status: "received",
      transaction_id: txRecord.id,
    });
  }

  // ==========================================
  // EVENT: Received → Returned (Reverse Movement + Reversal)
  // ==========================================
  else if (oldStatus === "received" && newStatus === "returned") {
    const items = getOrderItems(dao, orderId);

    for (const item of items) {
      processItemMovement(dao, item, {
        direction: "out",
        movementType: "purchase_return",
        businessDate: businessDate,
        referenceNumber: orderRef,
      });
    }

    // Find original transaction (exclude reversals to avoid ambiguity)
    const originalTx = dao.findFirstRecordByFilter(
      "transactions",
      `reference_collection = "${PURCHASES}" && reference_id = "${orderId}" && is_reversal = false`,
    );

    const reversalTx = TransactionService.reverse(dao, originalTx, {
      businessDate: businessDate,
      paidAmount: 0,
      remainingAmount: originalTx.getFloat("amount"),
      paymentStatus: "unpaid",
    });

    LedgerProjectionService.projectTransaction(dao, reversalTx);

    logAudit(e, AuditActions.PURCHASE_ORDER_RETURNED, orderId, {
      status: "returned",
      reversal_transaction_id: reversalTx.id,
    });
  }

  // ==========================================
  // EVENT: Draft → Cancelled (No side effects)
  // ==========================================
  else if (oldStatus === "draft" && newStatus === "cancelled") {
    logAudit(e, AuditActions.PURCHASE_ORDER_CANCELLED, orderId, {
      status: "cancelled",
    });
  }
}, PURCHASES);

// ==========================================
// 3. PROTECT ITEMS: Create/Update/Delete After Receipt
// ==========================================

onRecordBeforeCreateRequest((e) => {
  const dao = e.dao;
  const orderId = e.record.get("purchase_order_id");
  assertDraftOrder(dao, orderId, "add");
}, PURCHASE_ITEMS);

onRecordBeforeUpdateRequest((e) => {
  const dao = e.dao;
  const orderId = e.record.get("purchase_order_id");
  assertDraftOrder(dao, orderId, "modify");
}, PURCHASE_ITEMS);

onRecordBeforeDeleteRequest((e) => {
  const dao = e.dao;
  const orderId = e.record.get("purchase_order_id");
  assertDraftOrder(dao, orderId, "delete");
}, PURCHASE_ITEMS);
