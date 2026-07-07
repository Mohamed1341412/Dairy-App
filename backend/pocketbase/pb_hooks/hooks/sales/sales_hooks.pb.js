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
 * هذا الـ Hook ينسق دورة حياة أمر البيع فقط.
 * لا يقوم بأي حسابات مخزون أو محاسبة.
 * يستدعي Services فقط داخل نفس Transaction الأصلي.
 *
 * ⚠️ ATOMICITY RULE:
 * جميع العمليات الجانبية (Side Effects) تتم في BeforeUpdate
 * لضمان أن تغيير الحالة والعمليات الجانبية تتم في نفس الـ Transaction.
 *
 * ⚠️ LIFECYCLE:
 * draft → confirmed → delivered → returned
 * draft → confirmed → cancelled
 * draft → cancelled
 */

// ==========================================
// LOCAL HELPERS (Reduce Duplication)
// ==========================================

/**
 * Helper: تحميل بنود أمر البيع
 */
function getOrderItems(orderId) {
  return $app
    .dao()
    .findRecordsByFilter("sales_order_items", `sales_order_id = "${orderId}"`);
}

/**
 * Helper: تسجيل Audit Log
 */
function logAudit(e, action, recordId, data) {
  AuditService.log({
    userId: AuditService.getUserId(e),
    action: action,
    operationType: OperationTypes.UPDATE,
    collectionName: "sales_orders",
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
}, "sales_orders");

// ==========================================
// 2. BEFORE UPDATE: Status Transition & Side Effects
// ==========================================
onRecordBeforeUpdateRequest((e) => {
  const oldStatus = e.oldRecord.get("status");
  const newStatus = e.record.get("status");

  if (oldStatus === newStatus) return;

  // A. Validate Status Transitions
  const validTransitions = {
    draft: ["confirmed", "cancelled"],
    confirmed: ["delivered", "cancelled"],
    delivered: ["returned"],
    returned: [],
    cancelled: [],
  };

  if (!validTransitions[oldStatus]?.includes(newStatus)) {
    throw new Error(
      `Invalid status transition from '${oldStatus}' to '${newStatus}'.`,
    );
  }

  // B. Protect Financial Fields After Confirmation
  if (oldStatus !== "draft" && newStatus !== "draft") {
    const protectedFields = ["client_id", "net_amount", "payment_method"];
    for (const field of protectedFields) {
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
  const businessDate =
    e.record.get("business_date") || e.record.get("order_date");

  // ==========================================
  // EVENT: Draft → Confirmed (Reserve Stock)
  // ==========================================
  if (oldStatus === "draft" && newStatus === "confirmed") {
    const items = getOrderItems(orderId);

    for (const item of items) {
      StockService.reserveStock(
        $app.dao(),
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
    const items = getOrderItems(orderId);

    for (const item of items) {
      const productId = item.get("product_id");
      const qty = item.getFloat("quantity");

      // 1. Release reservation
      StockService.releaseReservation($app.dao(), "products", productId, qty);

      // 2. Create inventory movement
      const movementCollection = $app
        .dao()
        .findCollectionByNameOrId("inventory_movements");
      const movement = new $classes.Record(movementCollection);
      movement.set("product_id", productId);
      movement.set("direction", "out");
      movement.set("quantity", qty);
      movement.set("movement_type", "sale");
      movement.set("business_date", businessDate);
      movement.set("reference_number", orderRef);
      $app.dao().saveRecord(movement);

      // 3. Apply stock projection
      StockService.applyMovement($app.dao(), movement);
    }

    // 4. Create financial transaction using TransactionService
    const txRecord = TransactionService.create($app.dao(), {
      type: "sale",
      partyType: "client",
      clientId: clientId,
      amount: netAmount,
      direction: "in",
      affectsCashflow: false,
      transactionDate: businessDate,
      businessDate: businessDate,
      source: "sales_order",
      referenceCollection: "sales_orders",
      referenceId: orderId,
      referenceNumber: orderRef,
      paidAmount: 0,
      remainingAmount: netAmount,
      paymentStatus: "unpaid",
    });

    // 5. Project to ledger using LedgerProjectionService
    LedgerProjectionService.projectTransaction($app.dao(), txRecord);

    logAudit(e, AuditActions.SALES_ORDER_DELIVERED, orderId, {
      status: "delivered",
      transaction_id: txRecord.id,
    });
  }

  // ==========================================
  // EVENT: Confirmed → Cancelled (Release Reservation)
  // ==========================================
  else if (oldStatus === "confirmed" && newStatus === "cancelled") {
    const items = getOrderItems(orderId);

    for (const item of items) {
      StockService.releaseReservation(
        $app.dao(),
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
    const items = getOrderItems(orderId);

    for (const item of items) {
      const productId = item.get("product_id");
      const qty = item.getFloat("quantity");

      // 1. Create reverse inventory movement
      const movementCollection = $app
        .dao()
        .findCollectionByNameOrId("inventory_movements");
      const movement = new $classes.Record(movementCollection);
      movement.set("product_id", productId);
      movement.set("direction", "in");
      movement.set("quantity", qty);
      movement.set("movement_type", "return");
      movement.set("business_date", businessDate);
      movement.set("reference_number", orderRef);
      $app.dao().saveRecord(movement);

      // 2. Apply stock projection
      StockService.applyMovement($app.dao(), movement);
    }

    // 3. Find original transaction
    const originalTx = $app
      .dao()
      .findFirstRecordByFilter(
        "transactions",
        `reference_collection = "sales_orders" && reference_id = "${orderId}"`,
      );

    // 4. Create reversal transaction manually
    // TODO: Reuse TransactionService when reversal creation becomes shared
    // across multiple modules (sales, purchases, payroll, expenses...).
    // ⚠️ IMPORTANT: direction stays the same as original (Business Direction)
    // LedgerProjectionService handles debit/credit flip automatically when is_reversal = true
    const txCollection = $app.dao().findCollectionByNameOrId("transactions");
    const reversalTx = new $classes.Record(txCollection);

    reversalTx.set("transaction_number", ReferenceNumberService.generate("TX"));
    reversalTx.set("type", originalTx.get("type"));
    reversalTx.set("party_type", originalTx.get("party_type"));
    reversalTx.set("client_id", originalTx.get("client_id"));
    reversalTx.set("amount", originalTx.getFloat("amount"));
    reversalTx.set("direction", originalTx.get("direction")); // Same direction as original
    reversalTx.set("affects_cashflow", originalTx.get("affects_cashflow"));
    reversalTx.set("status", "posted");
    reversalTx.set("business_date", businessDate);
    reversalTx.set("transaction_date", businessDate);
    reversalTx.set("transaction_source", originalTx.get("transaction_source"));
    reversalTx.set(
      "reference_collection",
      originalTx.get("reference_collection"),
    );
    reversalTx.set("reference_id", originalTx.get("reference_id"));
    reversalTx.set("reference_number", originalTx.get("reference_number"));
    reversalTx.set("is_reversal", true);
    reversalTx.set("reversal_of", originalTx.id);
    reversalTx.set("paid_amount", 0);
    reversalTx.set("remaining_amount", originalTx.getFloat("amount"));
    reversalTx.set("payment_status", "unpaid");

    $app.dao().saveRecord(reversalTx);

    // 5. Project reversal to ledger using LedgerProjectionService
    // LedgerProjectionService will automatically flip debit/credit because is_reversal = true
    LedgerProjectionService.projectTransaction($app.dao(), reversalTx);

    logAudit(e, AuditActions.SALES_ORDER_RETURNED, orderId, {
      status: "returned",
      reversal_transaction_id: reversalTx.id,
    });
  }
}, "sales_orders");

// ==========================================
// 3. PROTECT ITEMS AFTER CONFIRMATION
// ==========================================
onRecordBeforeUpdateRequest((e) => {
  if (e.collection.name === "sales_order_items") {
    const orderId = e.record.get("sales_order_id");
    try {
      const order = $app.dao().findRecordById("sales_orders", orderId);
      const status = order.get("status");

      if (status !== "draft") {
        throw new Error(
          `Cannot modify items of a ${status} order. Only draft orders can have items modified.`,
        );
      }
    } catch (err) {
      if (err.message.includes("Cannot modify items")) {
        throw err;
      }
      throw new Error(`Order not found: ${orderId}`);
    }
  }
}, "sales_order_items");

onRecordBeforeDeleteRequest((e) => {
  if (e.collection.name === "sales_order_items") {
    const orderId = e.record.get("sales_order_id");
    try {
      const order = $app.dao().findRecordById("sales_orders", orderId);
      const status = order.get("status");

      if (status !== "draft") {
        throw new Error(
          `Cannot delete items from a ${status} order. Only draft orders can have items deleted.`,
        );
      }
    } catch (err) {
      if (err.message.includes("Cannot delete items")) {
        throw err;
      }
      throw new Error(`Order not found: ${orderId}`);
    }
  }
}, "sales_order_items");
