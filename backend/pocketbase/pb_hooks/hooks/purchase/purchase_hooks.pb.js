// pb_hooks/hooks/purchase/purchase_hooks.pb.js

const StockService = require(`${__hooks}/services/stock_service.pb.js`);
const MaterialService = require(`${__hooks}/services/material_service.pb.js`);
const LedgerService = require(`${__hooks}/services/ledger_service.pb.js`);
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
// 1. BEFORE CREATE: Reference Number Generation
// ==========================================
onRecordBeforeCreateRequest((e) => {
  if (!e.record.get("reference_number")) {
    e.record.set("reference_number", ReferenceNumberService.generate("PO"));
  }
  if (!e.record.get("status")) {
    e.record.set("status", "draft");
  }
}, "purchase_orders");

// ==========================================
// 2. BEFORE UPDATE: Status Transition & Side Effects
// ==========================================
onRecordBeforeUpdateRequest((e) => {
  const oldStatus = e.oldRecord.get("status");
  const newStatus = e.record.get("status");

  if (oldStatus === newStatus) return;

  // A. Validate Status Transitions (simplified lifecycle)
  const validTransitions = {
    draft: ["received", "cancelled"],
    received: ["returned"],
    returned: [],
    cancelled: [],
  };

  if (!validTransitions[oldStatus]?.includes(newStatus)) {
    throw new Error(
      `Invalid status transition from '${oldStatus}' to '${newStatus}'.`,
    );
  }

  // B. Protect Financial Fields After Receipt
  if (oldStatus !== "draft" && newStatus !== "draft") {
    const protectedFields = ["vendor_id", "net_amount"];
    for (const field of protectedFields) {
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
  const businessDate =
    e.record.get("business_date") || e.record.get("purchase_date");

  // ==========================================
  // EVENT: Draft → Received (Stock IN + Payable)
  // ==========================================
  if (oldStatus === "draft" && newStatus === "received") {
    const items = $app
      .dao()
      .findRecordsByFilter(
        "purchase_order_items",
        `purchase_order_id = "${orderId}"`,
      );

    // Process each item based on line_type
    for (const item of items) {
      const lineType = item.get("line_type");
      const qty = item.getFloat("quantity");

      if (lineType === "product") {
        // Create inventory movement for product
        const movementCollection = $app
          .dao()
          .findCollectionByNameOrId("inventory_movements");
        const movement = new $classes.Record(movementCollection);
        movement.set("product_id", item.get("product_id"));
        movement.set("direction", "in");
        movement.set("quantity", qty);
        movement.set("movement_type", "purchase");
        movement.set("business_date", businessDate);
        movement.set("reference_number", orderRef);
        $app.dao().saveRecord(movement);

        // Apply stock projection
        StockService.applyMovement($app.dao(), movement);
      } else if (lineType === "material") {
        // Create material movement
        const movementCollection = $app
          .dao()
          .findCollectionByNameOrId("material_movements");
        const movement = new $classes.Record(movementCollection);
        movement.set("material_id", item.get("material_id"));
        movement.set("direction", "in");
        movement.set("quantity", qty);
        movement.set("movement_type", "purchase");
        movement.set("business_date", businessDate);
        movement.set("reference_number", orderRef);
        $app.dao().saveRecord(movement);

        // Apply material stock projection
        MaterialService.applyMovement($app.dao(), movement);
      }
    }

    // Create financial transaction (Payable)
    const txCollection = $app.dao().findCollectionByNameOrId("transactions");
    const txRecord = new $classes.Record(txCollection);
    txRecord.set("transaction_number", ReferenceNumberService.generate("TX"));
    txRecord.set("type", "purchase");
    txRecord.set("party_type", "vendor");
    txRecord.set("vendor_id", vendorId);
    txRecord.set("amount", netAmount);
    txRecord.set("direction", "out"); // We owe the vendor
    txRecord.set("affects_cashflow", false); // Invoice doesn't move cash yet
    txRecord.set("status", "posted");
    txRecord.set("business_date", businessDate);
    txRecord.set("transaction_date", businessDate);
    txRecord.set("transaction_source", "purchase_order");
    txRecord.set("reference_collection", "purchase_orders");
    txRecord.set("reference_id", orderId);
    txRecord.set("reference_number", orderRef);
    txRecord.set("paid_amount", 0);
    txRecord.set("remaining_amount", netAmount);
    $app.dao().saveRecord(txRecord);

    // Project to ledger
    const reference = {
      type: "purchase_orders",
      id: orderId,
      number: orderRef,
    };
    LedgerService.projectTransaction(
      $app.dao(),
      txRecord,
      "payable",
      reference,
    );

    AuditService.log({
      userId: AuditService.getUserId(e),
      action: AuditActions.PURCHASE_ORDER_RECEIVED,
      operationType: OperationTypes.UPDATE,
      collectionName: "purchase_orders",
      recordId: orderId,
      newData: { status: "received", transaction_id: txRecord.id },
    });
  }

  // ==========================================
  // EVENT: Received → Returned (Reverse Movement + Reversal)
  // ==========================================
  else if (oldStatus === "received" && newStatus === "returned") {
    const items = $app
      .dao()
      .findRecordsByFilter(
        "purchase_order_items",
        `purchase_order_id = "${orderId}"`,
      );

    // Process each item based on line_type
    for (const item of items) {
      const lineType = item.get("line_type");
      const qty = item.getFloat("quantity");

      if (lineType === "product") {
        // Create reverse inventory movement
        const movementCollection = $app
          .dao()
          .findCollectionByNameOrId("inventory_movements");
        const movement = new $classes.Record(movementCollection);
        movement.set("product_id", item.get("product_id"));
        movement.set("direction", "out");
        movement.set("quantity", qty);
        movement.set("movement_type", "return");
        movement.set("business_date", businessDate);
        movement.set("reference_number", orderRef);
        $app.dao().saveRecord(movement);

        // Apply stock projection
        StockService.applyMovement($app.dao(), movement);
      } else if (lineType === "material") {
        // Create reverse material movement
        const movementCollection = $app
          .dao()
          .findCollectionByNameOrId("material_movements");
        const movement = new $classes.Record(movementCollection);
        movement.set("material_id", item.get("material_id"));
        movement.set("direction", "out");
        movement.set("quantity", qty);
        movement.set("movement_type", "return");
        movement.set("business_date", businessDate);
        movement.set("reference_number", orderRef);
        $app.dao().saveRecord(movement);

        // Apply material stock projection
        MaterialService.applyMovement($app.dao(), movement);
      }
    }

    // Find original transaction
    const originalTx = $app
      .dao()
      .findFirstRecordByFilter(
        "transactions",
        `reference_collection = "purchase_orders" && reference_id = "${orderId}"`,
      );

    // Create reversal transaction
    const txCollection = $app.dao().findCollectionByNameOrId("transactions");
    const reversalTx = new $classes.Record(txCollection);
    reversalTx.set("transaction_number", ReferenceNumberService.generate("TX"));
    reversalTx.set("type", originalTx.get("type"));
    reversalTx.set("party_type", "vendor");
    reversalTx.set("vendor_id", vendorId);
    reversalTx.set("amount", originalTx.getFloat("amount"));
    reversalTx.set("direction", "in"); // Opposite direction
    reversalTx.set("affects_cashflow", false);
    reversalTx.set("status", "posted");
    reversalTx.set("business_date", businessDate);
    reversalTx.set("transaction_date", businessDate);
    reversalTx.set("transaction_source", "purchase_order");
    reversalTx.set("reference_collection", "purchase_orders");
    reversalTx.set("reference_id", orderId);
    reversalTx.set("reference_number", orderRef);
    reversalTx.set("is_reversal", true);
    reversalTx.set("reversal_of", originalTx.id);
    reversalTx.set("paid_amount", 0);
    reversalTx.set("remaining_amount", originalTx.getFloat("amount"));
    $app.dao().saveRecord(reversalTx);

    // Project reversal to ledger
    const reference = {
      type: "purchase_orders",
      id: orderId,
      number: orderRef,
    };
    LedgerService.projectTransaction(
      $app.dao(),
      reversalTx,
      "reversal",
      reference,
    );

    AuditService.log({
      userId: AuditService.getUserId(e),
      action: AuditActions.PURCHASE_ORDER_RETURNED,
      operationType: OperationTypes.UPDATE,
      collectionName: "purchase_orders",
      recordId: orderId,
      newData: { status: "returned", reversal_transaction_id: reversalTx.id },
    });
  }

  // ==========================================
  // EVENT: Draft → Cancelled (No side effects)
  // ==========================================
  else if (oldStatus === "draft" && newStatus === "cancelled") {
    AuditService.log({
      userId: AuditService.getUserId(e),
      action: AuditActions.PURCHASE_ORDER_CANCELLED,
      operationType: OperationTypes.UPDATE,
      collectionName: "purchase_orders",
      recordId: orderId,
      newData: { status: "cancelled" },
    });
  }
}, "purchase_orders");

// ==========================================
// 3. PROTECT ITEMS: Create/Update/Delete After Receipt
// ==========================================

// Prevent creating items after receipt
onRecordBeforeCreateRequest((e) => {
  const orderId = e.record.get("purchase_order_id");
  try {
    const order = $app.dao().findRecordById("purchase_orders", orderId);
    const status = order.get("status");

    if (status !== "draft") {
      throw new Error(
        `Cannot add items to a ${status} order. Only draft orders can have items added.`,
      );
    }
  } catch (err) {
    if (err.message.includes("Cannot add items")) throw err;
    throw new Error(`Order not found: ${orderId}`);
  }
}, "purchase_order_items");

// Prevent updating items after receipt
onRecordBeforeUpdateRequest((e) => {
  const orderId = e.record.get("purchase_order_id");
  try {
    const order = $app.dao().findRecordById("purchase_orders", orderId);
    const status = order.get("status");

    if (status !== "draft") {
      throw new Error(
        `Cannot modify items of a ${status} order. Only draft orders can have items modified.`,
      );
    }
  } catch (err) {
    if (err.message.includes("Cannot modify items")) throw err;
    throw new Error(`Order not found: ${orderId}`);
  }
}, "purchase_order_items");

// Prevent deleting items after receipt
onRecordBeforeDeleteRequest((e) => {
  const orderId = e.record.get("purchase_order_id");
  try {
    const order = $app.dao().findRecordById("purchase_orders", orderId);
    const status = order.get("status");

    if (status !== "draft") {
      throw new Error(
        `Cannot delete items from a ${status} order. Only draft orders can have items deleted.`,
      );
    }
  } catch (err) {
    if (err.message.includes("Cannot delete items")) throw err;
    throw new Error(`Order not found: ${orderId}`);
  }
}, "purchase_order_items");
