// pb_hooks/hooks/sales/sales_hooks.pb.js

const StockService = require(`${__hooks}/services/stock_service.pb.js`);
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
 * Sales Hooks - Business Orchestrator
 *
 * ⚠️ ARCHITECTURAL BOUNDARY:
 * - Orchestrates sales order lifecycle only
 * - No stock calculations (owned by StockService)
 * - No transaction creation logic (owned by TransactionService)
 * - No ledger projection logic (owned by LedgerProjectionService)
 *
 * ⚠️ ATOMICITY RULE:
 * All side effects happen in BeforeUpdate to ensure atomicity.
 * Status change + reservations + movements + transaction + ledger = single transaction.
 *
 * ⚠️ LIFECYCLE:
 * draft → confirmed → delivered → returned
 * draft → confirmed → cancelled
 * draft → cancelled
 * confirmed → cancelled (NOT ALLOWED after reservation - releases first)
 */

// ==========================================
// CONSTANTS (Single Source of Truth)
// ==========================================

const SALES_ORDERS = "sales_orders";
const SALES_ORDER_ITEMS = "sales_order_items";

const VALID_TRANSITIONS = Object.freeze({
  draft: ["confirmed", "cancelled"],
  confirmed: ["delivered", "cancelled"],
  delivered: ["returned"],
  returned: [],
  cancelled: [],
});

const IMMUTABLE_AFTER_CONFIRMATION = Object.freeze([
  "client_id",
  "net_amount",
  "payment_method",
]);

// ==========================================
// LOCAL HELPERS (Reduce Duplication)
// ==========================================

/**
 * Helper: Extract business date from order
 */
function getBusinessDate(order) {
  return order.get("business_date") || order.get("order_date");
}

/**
 * Helper: Load sales order items
 */
function getOrderItems(dao, orderId) {
  return dao.findRecordsByFilter(
    SALES_ORDER_ITEMS,
    `sales_order_id = "${orderId}"`,
  );
}

/**
 * Helper: Find original transaction for a sales order
 */
function getOriginalTransaction(dao, orderId) {
  return dao.findFirstRecordByFilter(
    "transactions",
    `reference_collection = "${SALES_ORDERS}" && reference_id = "${orderId}" && is_reversal = false`,
  );
}

/**
 * Helper: Create and save inventory movement
 */
function createMovement(dao, options) {
  const movement = new $classes.Record(
    dao.findCollectionByNameOrId("inventory_movements"),
  );

  movement.set("product_id", options.productId);
  movement.set("direction", options.direction);
  movement.set("quantity", options.qty);
  movement.set("movement_type", options.movementType);
  movement.set("business_date", options.businessDate);
  movement.set("reference_number", options.referenceNumber);

  dao.saveRecord(movement);
  return movement;
}

/**
 * Helper: Assert order is in draft status
 */
function assertDraftOrder(dao, orderId, action) {
  let order;
  try {
    order = dao.findRecordById(SALES_ORDERS, orderId);
  } catch (err) {
    throw new Error(`Sales order not found: ${orderId}`);
  }

  const status = order.get("status");
  if (status !== "draft") {
    const actionWord =
      action === "modify" ? "modified" : action === "add" ? "added" : "deleted";
    throw new Error(
      `Cannot ${action} items of a ${status} order. Only draft orders can have items ${actionWord}.`,
    );
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
    collectionName: SALES_ORDERS,
    recordId: recordId,
    newData: data,
  });
}

// ==========================================
// 1. BEFORE CREATE: Reference Number Generation
// ==========================================
onRecordBeforeCreateRequest((e) => {
  if (!e.record.get("reference_number")) {
    e.record.set("reference_number", ReferenceNumberService.generate("SO"));
  }
  if (!e.record.get("status")) {
    e.record.set("status", "draft");
  }
}, SALES_ORDERS);

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

  // B. Protect Financial Fields After Confirmation
  if (oldStatus !== "draft" && newStatus !== "draft") {
    for (const field of IMMUTABLE_AFTER_CONFIRMATION) {
      if (e.oldRecord.get(field) !== e.record.get(field)) {
        throw new Error(
          `Field '${field}' cannot be modified after order confirmation.`,
        );
      }
    }
  }

  // C. Execute Side Effects Based on Transition
  const orderId = e.record.id;
  const orderRef = e.record.get("reference_number");
  const clientId = e.record.get("client_id");
  const netAmount = e.record.getFloat("net_amount");
  const businessDate = getBusinessDate(e.record);

  // ==========================================
  // EVENT: Draft → Confirmed (Reserve Stock)
  // ==========================================
  if (oldStatus === "draft" && newStatus === "confirmed") {
    const items = getOrderItems(dao, orderId);

    for (const item of items) {
      StockService.reserveStock(
        dao,
        "products",
        item.get("product_id"),
        item.getFloat("quantity"),
      );
    }

    logAudit(e, AuditActions.SALES_ORDER_CONFIRMED, orderId, {
      status: "confirmed",
      reference_number: orderRef,
    });
  }

  // ==========================================
  // EVENT: Confirmed → Delivered (Convert Reservation to Movement + Create Transaction)
  // ==========================================
  else if (oldStatus === "confirmed" && newStatus === "delivered") {
    const items = getOrderItems(dao, orderId);

    // 1. Release reservation + Create movement + Apply projection
    for (const item of items) {
      const productId = item.get("product_id");
      const qty = item.getFloat("quantity");

      StockService.releaseReservation(dao, "products", productId, qty);

      const movement = createMovement(dao, {
        productId: productId,
        direction: "out",
        qty: qty,
        movementType: "sale",
        businessDate: businessDate,
        referenceNumber: orderRef,
      });

      StockService.applyMovement(dao, movement);
    }

    // 2. Create financial transaction using TransactionService
    const txRecord = TransactionService.create(dao, {
      type: "sale",
      partyType: "client",
      clientId: clientId,
      amount: netAmount,
      direction: "in",
      affectsCashflow: false,
      transactionDate: businessDate,
      businessDate: businessDate,
      source: "sales_order",
      referenceCollection: SALES_ORDERS,
      referenceId: orderId,
      referenceNumber: orderRef,
      paidAmount: 0,
      remainingAmount: netAmount,
      paymentStatus: "unpaid",
    });

    // 3. Project to ledger using LedgerProjectionService
    LedgerProjectionService.projectTransaction(dao, txRecord);

    logAudit(e, AuditActions.SALES_ORDER_DELIVERED, orderId, {
      status: "delivered",
      transaction_id: txRecord.id,
    });
  }

  // ==========================================
  // EVENT: Confirmed → Cancelled (Release Reservation)
  // ==========================================
  else if (oldStatus === "confirmed" && newStatus === "cancelled") {
    const items = getOrderItems(dao, orderId);

    for (const item of items) {
      StockService.releaseReservation(
        dao,
        "products",
        item.get("product_id"),
        item.getFloat("quantity"),
      );
    }

    logAudit(e, AuditActions.SALES_ORDER_CANCELLED, orderId, {
      status: "cancelled",
    });
  }

  // ==========================================
  // EVENT: Draft → Cancelled (No side effects)
  // ==========================================
  else if (oldStatus === "draft" && newStatus === "cancelled") {
    logAudit(e, AuditActions.SALES_ORDER_CANCELLED, orderId, {
      status: "cancelled",
    });
  }

  // ==========================================
  // EVENT: Delivered → Returned (Reverse Movement + Reversal Transaction)
  // ==========================================
  else if (oldStatus === "delivered" && newStatus === "returned") {
    const items = getOrderItems(dao, orderId);

    // 1. Create reverse inventory movement + Apply projection
    for (const item of items) {
      const productId = item.get("product_id");
      const qty = item.getFloat("quantity");

      const movement = createMovement(dao, {
        productId: productId,
        direction: "in",
        qty: qty,
        movementType: "return",
        businessDate: businessDate,
        referenceNumber: orderRef,
      });

      StockService.applyMovement(dao, movement);
    }

    // 2. Find original transaction
    const originalTx = getOriginalTransaction(dao, orderId);

    if (!originalTx) {
      throw new Error(
        `Original transaction not found for sales order: ${orderId}`,
      );
    }

    // 3. Create reversal transaction using TransactionService
    const reversalTx = TransactionService.reverse(dao, originalTx, {
      businessDate: businessDate,
      paidAmount: 0,
      remainingAmount: originalTx.getFloat("amount"),
      paymentStatus: "unpaid",
    });

    // 4. Project reversal to ledger
    LedgerProjectionService.projectTransaction(dao, reversalTx);

    logAudit(e, AuditActions.SALES_ORDER_RETURNED, orderId, {
      status: "returned",
      reversal_transaction_id: reversalTx.id,
    });
  }
}, SALES_ORDERS);

// ==========================================
// 3. PROTECT ITEMS AFTER CONFIRMATION
// ==========================================

onRecordBeforeCreateRequest((e) => {
  const dao = e.dao;
  const orderId = e.record.get("sales_order_id");
  assertDraftOrder(dao, orderId, "add");
}, SALES_ORDER_ITEMS);

onRecordBeforeUpdateRequest((e) => {
  const dao = e.dao;
  const orderId = e.record.get("sales_order_id");
  assertDraftOrder(dao, orderId, "modify");
}, SALES_ORDER_ITEMS);

onRecordBeforeDeleteRequest((e) => {
  const dao = e.dao;
  const orderId = e.record.get("sales_order_id");
  assertDraftOrder(dao, orderId, "delete");
}, SALES_ORDER_ITEMS);
