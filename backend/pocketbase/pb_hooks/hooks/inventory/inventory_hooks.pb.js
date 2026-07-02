// pb_hooks/hooks/inventory/inventory_hooks.pb.js

const { AuditActions } = require(`${__hooks}/core/audit_actions.pb.js`);
const { OperationTypes } = require(`${__hooks}/core/operation_types.pb.js`);
const AuditService = require(`${__hooks}/services/audit_service.pb.js`);

/**
 * Inventory Hooks - Audit & Validation Layer
 *
 * ⚠️ ARCHITECTURAL BOUNDARY:
 * - inventory_movements are the source of truth
 * - StockService maintains stock projections (current_stock, available_stock, quantity_remaining)
 * - This hook performs validation, enforces append-only, and logs audits
 * - No stock calculations, no transactions, no projections here
 */

// ==========================================
// 1. INVENTORY MOVEMENTS: Append-Only Protection
// ==========================================

onRecordBeforeUpdateRequest((e) => {
  throw new Error(
    "inventory_movements are strictly append-only. Cannot be updated. Create a correction movement instead.",
  );
}, "inventory_movements");

onRecordBeforeDeleteRequest((e) => {
  throw new Error(
    "inventory_movements are strictly append-only. Cannot be deleted. Historical integrity must be preserved.",
  );
}, "inventory_movements");

// ==========================================
// 2. INVENTORY MOVEMENTS: Validation
// ==========================================

onRecordBeforeCreateRequest((e) => {
  const record = e.record;
  const qty = record.getFloat("quantity");
  const direction = record.get("direction");

  // A. Quantity must be positive
  if (qty <= 0) {
    throw new Error("Movement quantity must be strictly positive.");
  }

  // B. Direction must be valid
  if (!["in", "out"].includes(direction)) {
    throw new Error("direction must be either 'in' or 'out'.");
  }

  // C. Correction validation (if this movement corrects another)
  const correctsMovementId = record.get("corrects_movement_id");
  if (correctsMovementId) {
    // Must be an adjustment
    if (record.get("movement_type") !== "adjustment") {
      throw new Error(
        "Only movements with type 'adjustment' can correct other movements.",
      );
    }

    // Original movement must exist and be for the same product
    try {
      const originalMovement = $app
        .dao()
        .findRecordById("inventory_movements", correctsMovementId);

      // Cannot correct an adjustment (prevents chains)
      if (originalMovement.get("movement_type") === "adjustment") {
        throw new Error(
          "Cannot correct an adjustment movement. Correct the original movement instead.",
        );
      }

      // Must be for the same product
      if (originalMovement.get("product_id") !== record.get("product_id")) {
        throw new Error(
          "Correction movement must be for the same product as the original.",
        );
      }
    } catch (err) {
      if (
        err.message.includes("Cannot correct") ||
        err.message.includes("same product")
      ) {
        throw err;
      }
      throw new Error(`Original movement not found: ${correctsMovementId}`);
    }
  }
}, "inventory_movements");

// ==========================================
// 3. INVENTORY MOVEMENTS: Audit Only
// ==========================================

onRecordAfterCreateRequest((e) => {
  AuditService.log({
    userId: AuditService.getUserId(e),
    action: AuditActions.INVENTORY_MOVEMENT_CREATED,
    operationType: OperationTypes.CREATE,
    collectionName: "inventory_movements",
    recordId: e.record.id,
    newData: {
      product_id: e.record.get("product_id"),
      batch_id: e.record.get("batch_id"),
      direction: e.record.get("direction"),
      quantity: e.record.get("quantity"),
      movement_type: e.record.get("movement_type"),
      reference_number: e.record.get("reference_number"),
      business_date: e.record.get("business_date"),
    },
  });
}, "inventory_movements");

// ==========================================
// 4. PRODUCTS: Audit Only (Business Events)
// ==========================================

onRecordAfterCreateRequest((e) => {
  AuditService.log({
    userId: AuditService.getUserId(e),
    action: AuditActions.PRODUCT_CREATED,
    operationType: OperationTypes.CREATE,
    collectionName: "products",
    recordId: e.record.id,
    newData: {
      name: e.record.get("name"),
      selling_price: e.record.get("selling_price"),
      cost_price: e.record.get("cost_price"),
      is_active: e.record.get("is_active"),
      current_stock: e.record.get("current_stock"),
      reserved_stock: e.record.get("reserved_stock"),
      available_stock: e.record.get("available_stock"),
    },
  });
}, "products");

onRecordAfterUpdateRequest((e) => {
  const old = e.oldRecord;
  const rec = e.record;
  if (!old) return;

  const userId = AuditService.getUserId(e);
  const id = rec.id;

  // A. Price Changes
  if (
    old.get("selling_price") !== rec.get("selling_price") ||
    old.get("cost_price") !== rec.get("cost_price")
  ) {
    AuditService.log({
      userId,
      action: AuditActions.PRODUCT_PRICE_CHANGED,
      operationType: OperationTypes.UPDATE,
      collectionName: "products",
      recordId: id,
      oldData: {
        selling_price: old.get("selling_price"),
        cost_price: old.get("cost_price"),
      },
      newData: {
        selling_price: rec.get("selling_price"),
        cost_price: rec.get("cost_price"),
      },
    });
  }

  // B. Status / Lifecycle Changes
  if (old.get("is_active") !== rec.get("is_active")) {
    AuditService.log({
      userId,
      action: rec.get("is_active")
        ? AuditActions.PRODUCT_ACTIVATED
        : AuditActions.PRODUCT_DEACTIVATED,
      operationType: OperationTypes.UPDATE,
      collectionName: "products",
      recordId: id,
      oldData: { is_active: old.get("is_active") },
      newData: { is_active: rec.get("is_active") },
    });
  }
  if (old.get("is_archived") !== rec.get("is_archived")) {
    const isArch = rec.get("is_archived");
    AuditService.log({
      userId,
      action: isArch
        ? AuditActions.PRODUCT_ARCHIVED
        : AuditActions.PRODUCT_RESTORED,
      operationType: isArch ? OperationTypes.ARCHIVE : OperationTypes.RESTORE,
      collectionName: "products",
      recordId: id,
      oldData: { is_archived: old.get("is_archived") },
      newData: { is_archived: isArch },
    });
  }
}, "products");
