// pb_hooks/hooks/inventory/inventory_hooks.pb.js

const { Collections, MovementTypes, MovementDirections } = require(
  `${__hooks}/core/collections.pb.js`,
);
const Helpers = require(`${__hooks}/utils/helpers.pb.js`);
const StockService = require(`${__hooks}/services/stock_service.pb.js`);

// إضافات الـ Audit
const { AuditActions } = require(`${__hooks}/core/audit_actions.pb.js`);
const { OperationTypes } = require(`${__hooks}/core/operation_types.pb.js`);
const AuditService = require(`${__hooks}/services/audit_service.pb.js`);

/**
 * 1. Prevent direct stock editing for Products and Raw Materials.
 * Stock must only be updated via movements.
 */
const stockProtectedCollections = [Collections.PRODUCTS, Collections.MATERIALS];

// Internal DAO updates from StockService are allowed.
// Only HTTP/API requests are blocked.
stockProtectedCollections.forEach((collectionName) => {
  onRecordBeforeUpdateRequest((e) => {
    if (!e.requestInfo) {
      return e.next();
    }

    const protectedFields = [
      "current_stock",
      "reserved_stock",
      "available_stock",
    ];
    protectedFields.forEach((field) => {
      Helpers.ensureFieldNotModified(
        e,
        field,
        `Direct editing of ${field} is prohibited.`,
      );
    });

    return e.next();
  }, collectionName);
});

/**
 * Audit: تسجيل إنشاء منتج
 */
onRecordAfterCreateRequest((e) => {
  AuditService.log({
    userId: AuditService.getUserId(e),
    action: AuditActions.PRODUCT_CREATED,
    operationType: OperationTypes.CREATE,
    collectionName: Collections.PRODUCTS,
    recordId: e.record.id,
  });
  return e.next();
}, Collections.PRODUCTS);

/**
 * Audit: تسجيل أرشفة/استعادة منتج
 */
onRecordAfterUpdateRequest((e) => {
  let oldRecord = e.oldRecord || e.record.original?.();
  if (!oldRecord) return e.next();

  const oldArchived = oldRecord.get("is_archived");
  const newArchived = e.record.get("is_archived");
  if (oldArchived !== newArchived) {
    const action = newArchived
      ? AuditActions.PRODUCT_ARCHIVED
      : AuditActions.PRODUCT_RESTORED;
    const opType = newArchived
      ? OperationTypes.ARCHIVE
      : OperationTypes.RESTORE;
    AuditService.log({
      userId: AuditService.getUserId(e),
      action,
      operationType: opType,
      collectionName: Collections.PRODUCTS,
      recordId: e.record.id,
    });
  }
  return e.next();
}, Collections.PRODUCTS);

/**
 * 2. Inventory Movement Logic
 */
onRecordBeforeCreateRequest((e) => {
  const productId = e.record.get("product_id");
  const qty = e.record.getFloat("quantity");
  const type = e.record.get("movement_type");
  const direction = e.record.get("direction");

  // 2.1 Validate Quantity
  if (qty <= 0) {
    throw new BadRequestError("Movement quantity must be greater than zero.");
  }

  // 2.2 Validate Movement Type & Direction
  const validTypes = Object.values(MovementTypes);
  if (!validTypes.includes(type)) {
    throw new BadRequestError(`Invalid movement type: ${type}.`);
  }
  if (!Object.values(MovementDirections).includes(direction)) {
    throw new BadRequestError(`Invalid movement direction: ${direction}.`);
  }

  // 2.3 Type ↔ Direction Enforcement
  const typeDirectionMap = {
    [MovementTypes.PRODUCTION]: MovementDirections.IN,
    [MovementTypes.SALE]: MovementDirections.OUT,
    [MovementTypes.RETURN]: MovementDirections.IN,
    [MovementTypes.WASTE]: MovementDirections.OUT,
    // ADJUSTMENT can be IN or OUT
  };

  if (type !== MovementTypes.ADJUSTMENT) {
    const expectedDirection = typeDirectionMap[type];
    if (direction !== expectedDirection) {
      throw new BadRequestError(
        `Invalid direction '${direction}' for movement type '${type}'. Expected '${expectedDirection}'.`,
      );
    }
  }

  // 2.4 Validate Negative Stock for OUT movements
  if (direction === MovementDirections.OUT) {
    StockService.validateNegativeStock(productId, qty);
  }

  return e.next();
}, Collections.INVENTORY_MOVEMENTS);

/**
 * 3. Post-Movement Stock Update
 */
onRecordAfterCreateRequest((e) => {
  StockService.incrementalUpdate(e.record);
  return e.next();
}, Collections.INVENTORY_MOVEMENTS);
