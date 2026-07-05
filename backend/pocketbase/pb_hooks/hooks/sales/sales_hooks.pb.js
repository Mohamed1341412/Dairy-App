// pb_hooks/hooks/sales/sales_hooks.pb.js

const StockService = require(`${__hooks}/services/stock_service.pb.js`);
const LedgerService = require(`${__hooks}/services/ledger_service.pb.js`);
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
 */

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
    delivered: ["returned"], // ✅ Removed 'cancelled' - delivered orders cannot be cancelled
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

  // C. Protect Items After Confirmation
  if (oldStatus !== "draft" && newStatus !== "draft") {
    // Check if items were modified (this requires comparing with old state)
    // Note: PocketBase doesn't provide easy access to old related records
    // This validation should be done at the API level or via custom logic
    // For now, we document this as a business rule
  }

  // D. Execute Side Effects Based on Transition
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
    const items = $app
      .dao()
      .findRecordsByFilter(
        "sales_order_items",
        `sales_order_id = "${orderId}"`,
      );

    // Reserve stock (reserveStock already calls ensureAvailableStock internally)
    for (const item of items) {
      StockService.reserveStock(
        $app.dao(),
        "products",
        item.get("product_id"),
        item.getFloat("quantity"),
      );
    }

    AuditService.log({
      userId: AuditService.getUserId(e),
      action: AuditActions.SALES_ORDER_CONFIRMED,
      operationType: OperationTypes.UPDATE,
      collectionName: "sales_orders",
      recordId: orderId,
      newData: { status: "confirmed", reference_number: orderRef },
    });
  }

  // ==========================================
  // EVENT: Confirmed → Delivered (Convert Reservation to Movement)
  // ==========================================
  else if (oldStatus === "confirmed" && newStatus === "delivered") {
    const items = $app
      .dao()
      .findRecordsByFilter(
        "sales_order_items",
        `sales_order_id = "${orderId}"`,
      );

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

    // 4. Create financial transaction
    const txCollection = $app.dao().findCollectionByNameOrId("transactions");
    const txRecord = new $classes.Record(txCollection);
    txRecord.set("transaction_number", ReferenceNumberService.generate("TX"));
    txRecord.set("type", "sale");
    txRecord.set("party_type", "client");
    txRecord.set("client_id", clientId);
    txRecord.set("amount", netAmount);
    txRecord.set("direction", "in");
    txRecord.set("affects_cashflow", false);
    txRecord.set("status", "posted");
    txRecord.set("business_date", businessDate);
    txRecord.set("transaction_date", businessDate);
    txRecord.set("transaction_source", "sales_order");
    txRecord.set("reference_collection", "sales_orders");
    txRecord.set("reference_id", orderId);
    txRecord.set("reference_number", orderRef);
    txRecord.set("paid_amount", 0);
    txRecord.set("remaining_amount", netAmount);
    $app.dao().saveRecord(txRecord);

    // 5. Project to ledger
    const reference = { type: "sales_orders", id: orderId, number: orderRef };
    LedgerService.projectTransaction(
      $app.dao(),
      txRecord,
      "receivable",
      reference,
    );

    AuditService.log({
      userId: AuditService.getUserId(e),
      action: AuditActions.SALES_ORDER_DELIVERED,
      operationType: OperationTypes.UPDATE,
      collectionName: "sales_orders",
      recordId: orderId,
      newData: { status: "delivered", transaction_id: txRecord.id },
    });
  }

  // ==========================================
  // EVENT: Confirmed → Cancelled (Release Reservation)
  // ==========================================
  else if (oldStatus === "confirmed" && newStatus === "cancelled") {
    const items = $app
      .dao()
      .findRecordsByFilter(
        "sales_order_items",
        `sales_order_id = "${orderId}"`,
      );

    // Release reservation
    for (const item of items) {
      StockService.releaseReservation(
        $app.dao(),
        "products",
        item.get("product_id"),
        item.getFloat("quantity"),
      );
    }

    AuditService.log({
      userId: AuditService.getUserId(e),
      action: AuditActions.SALES_ORDER_CANCELLED,
      operationType: OperationTypes.UPDATE,
      collectionName: "sales_orders",
      recordId: orderId,
      newData: { status: "cancelled" },
    });
  }

  // ==========================================
  // EVENT: Delivered → Returned (Reverse Movement & Transaction)
  // ==========================================
  else if (oldStatus === "delivered" && newStatus === "returned") {
    const items = $app
      .dao()
      .findRecordsByFilter(
        "sales_order_items",
        `sales_order_id = "${orderId}"`,
      );

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

    // 4. Create reversal transaction
    const txCollection = $app.dao().findCollectionByNameOrId("transactions");
    const reversalTx = new $classes.Record(txCollection);
    reversalTx.set("transaction_number", ReferenceNumberService.generate("TX"));
    reversalTx.set("type", originalTx.get("type"));
    reversalTx.set("party_type", "client");
    reversalTx.set("client_id", clientId);
    reversalTx.set("amount", originalTx.getFloat("amount"));
    reversalTx.set("direction", "out");
    reversalTx.set("affects_cashflow", false);
    reversalTx.set("status", "posted");
    reversalTx.set("business_date", businessDate);
    reversalTx.set("transaction_date", businessDate);
    reversalTx.set("transaction_source", "sales_order");
    reversalTx.set("reference_collection", "sales_orders");
    reversalTx.set("reference_id", orderId);
    reversalTx.set("reference_number", orderRef);
    reversalTx.set("is_reversal", true);
    reversalTx.set("reversal_of", originalTx.id);
    reversalTx.set("paid_amount", 0);
    reversalTx.set("remaining_amount", originalTx.getFloat("amount"));
    $app.dao().saveRecord(reversalTx);

    // 5. Project reversal to ledger
    const reference = { type: "sales_orders", id: orderId, number: orderRef };
    LedgerService.projectTransaction(
      $app.dao(),
      reversalTx,
      "reversal",
      reference,
    );

    AuditService.log({
      userId: AuditService.getUserId(e),
      action: AuditActions.SALES_ORDER_RETURNED,
      operationType: OperationTypes.UPDATE,
      collectionName: "sales_orders",
      recordId: orderId,
      newData: { status: "returned", reversal_transaction_id: reversalTx.id },
    });
  }
  // temporary test:
  //    if (e.oldRecord.get('status') === 'draft' && e.record.get('status') === 'confirmed') {
  //     // Test: Write to a test table
  //     const testRecord = new $classes.Record($app.dao().findCollectionByNameOrId('system_settings'));
  //     testRecord.set('key', 'test_atomic_' + Date.now());
  //     testRecord.set('value', 'test');
  //     $app.dao().saveRecord(testRecord);

  //     // Test: Force an error
  //     throw new Error("TEST: This should rollback everything");
  // }
}, "sales_orders");

// ==========================================
// 3. PROTECT ITEMS AFTER CONFIRMATION
// ==========================================
// Note: PocketBase doesn't provide easy access to old related records in hooks
// This validation should be implemented via:
// 1. API Rules (prevent updates to sales_order_items after order confirmation)
// 2. Custom endpoint that checks order status before allowing item updates
// 3. Frontend validation (but backend must enforce it too)

onRecordBeforeUpdateRequest((e) => {
  // Check if this is an item update
  if (e.collection.name === "sales_order_items") {
    const orderId = e.record.get("sales_order_id");
    try {
      const order = $app.dao().findRecordById("sales_orders", orderId);
      const status = order.get("status");

      // Items cannot be modified after confirmation
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
