// pb_hooks/hooks/inventory/inventory_hooks.pb.js
const { AuditActions } = require(`${__hooks}/core/audit_actions.pb.js`);
const { OperationTypes } = require(`${__hooks}/core/operation_types.pb.js`);
const AuditService = require(`${__hooks}/services/audit_service.pb.js`);

// ==========================================
// 0. PRODUCTS: Audit Creation (Initial State)
// ==========================================
onRecordAfterCreateRequest((e) => {
  AuditService.log({
    userId: AuditService.getUserId(e),
    action: AuditActions.PRODUCT_CREATED,
    operationType: OperationTypes.CREATE,
    collectionName: "products",
    recordId: e.record.id,
    // ✅ Capture the initial financial and operational state
    newData: {
      name: e.record.get("name"),
      selling_price: e.record.get("selling_price"),
      cost_price: e.record.get("cost_price"),
      is_active: e.record.get("is_active"),
    },
  });
}, "products");

// ==========================================
// 1. PRODUCTS: Audit Master Data Changes
// ==========================================
onRecordAfterUpdateRequest((e) => {
  const oldRecord = e.oldRecord;
  if (!oldRecord) return;

  const userId = AuditService.getUserId(e);
  const recordId = e.record.id;

  // A. Audit Price Changes (Financial Impact)
  const oldPrices = {};
  const newPrices = {};

  if (oldRecord.get("selling_price") !== e.record.get("selling_price")) {
    oldPrices.selling_price = oldRecord.get("selling_price");
    newPrices.selling_price = e.record.get("selling_price");
  }
  if (oldRecord.get("cost_price") !== e.record.get("cost_price")) {
    oldPrices.cost_price = oldRecord.get("cost_price");
    newPrices.cost_price = e.record.get("cost_price");
  }

  if (Object.keys(oldPrices).length > 0) {
    AuditService.log({
      userId: userId,
      action: AuditActions.PRODUCT_PRICE_CHANGED,
      operationType: OperationTypes.UPDATE,
      collectionName: "products",
      recordId: recordId,
      oldData: oldPrices,
      newData: newPrices,
    });
  }

  // B. Audit Lifecycle (Active / Inactive)
  if (oldRecord.get("is_active") !== e.record.get("is_active")) {
    const isActive = e.record.get("is_active");
    AuditService.log({
      userId: userId,
      action: isActive
        ? AuditActions.PRODUCT_ACTIVATED
        : AuditActions.PRODUCT_DEACTIVATED,
      operationType: OperationTypes.UPDATE,
      collectionName: "products",
      recordId: recordId,
      oldData: { is_active: oldRecord.get("is_active") },
      newData: { is_active: isActive },
    });
  }

  // C. Audit Soft Delete / Restore
  if (oldRecord.get("is_archived") !== e.record.get("is_archived")) {
    const isArchived = e.record.get("is_archived");
    AuditService.log({
      userId: userId,
      action: isArchived
        ? AuditActions.PRODUCT_ARCHIVED
        : AuditActions.PRODUCT_RESTORED,
      operationType: isArchived
        ? OperationTypes.ARCHIVE
        : OperationTypes.RESTORE,
      collectionName: "products",
      recordId: recordId,
      oldData: { is_archived: oldRecord.get("is_archived") },
      newData: { is_archived: isArchived },
    });
  }
}, "products");

// ==========================================
// 2. INVENTORY MOVEMENTS: Audit Source of Truth
// ==========================================
onRecordAfterCreateRequest((e) => {
  // Movements are the actual source of truth for stock changes.
  // We audit the creation of the movement, NOT the cached stock fields on the product.
  AuditService.log({
    userId: AuditService.getUserId(e),
    action: AuditActions.INVENTORY_MOVEMENT_CREATED,
    operationType: OperationTypes.CREATE,
    collectionName: "inventory_movements",
    recordId: e.record.id,
    newData: {
      product_id: e.record.get("product_id"),
      direction: e.record.get("direction"),
      quantity: e.record.get("quantity"),
      movement_type: e.record.get("movement_type"),
      reference_number: e.record.get("reference_number"),
    },
  });
}, "inventory_movements");
