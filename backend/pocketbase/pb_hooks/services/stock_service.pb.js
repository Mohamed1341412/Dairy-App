// pb_hooks/services/stock_service.pb.js

/**
 * StockService (v1.2 - Core Inventory Engine)
 *
 * ⚠️ القواعد الذهبية:
 * 1. هذا الـ Service لا يفتح Transactions بنفسه. يجب تمرير (dao) من الـ Hook.
 * 2. يدعم كلاً من (products) و (materials) عبر تمرير (collectionName).
 * 3. حقل (available_stock) هو Projection يُحسب دائماً ولا يُعدّل يدوياً.
 * 4. يفصل مرحلة التحقق (Validation) عن مرحلة التعديل (Mutation) لضمان Fail-Fast.
 */

const StockService = {
  // ==========================================
  // 1. INTERNAL HELPERS
  // ==========================================

  _getItem: function (dao, collectionName, itemId) {
    const item = dao.findRecordById(collectionName, itemId);
    if (!item) {
      throw new Error(`Item not found in ${collectionName}: ${itemId}`);
    }
    return item;
  },

  _recalculateAndSave: function (dao, item) {
    const current = item.getFloat("current_stock") || 0;
    const reserved = item.getFloat("reserved_stock") || 0;

    // ✅ Invariant: available_stock هو Projection
    const available = current - reserved;

    // ✅ لا نعيد تعيين current و reserved لأنهما تم تعديلهما مسبقاً في الدالة المستدعية
    item.set("available_stock", available);
    dao.saveRecord(item);
  },

  // ==========================================
  // 2. VALIDATION (Pre-flight checks)
  // ==========================================

  /**
   * التحقق من توفر كمية معينة قبل تنفيذ أي عملية خصم.
   * ⚠️ يجب استخدام (dao) الخاص بالـ Transaction لضمان قراءة البيانات المحدثة.
   */
  ensureAvailableStock: function (dao, collectionName, itemId, requestedQty) {
    // ✅ Fail-Fast: الكمية الصفرية أو السالبة تعتبر خطأً برمجياً
    if (requestedQty <= 0) {
      throw new Error(
        `Requested quantity must be positive. Got: ${requestedQty} for ${collectionName} ${itemId}`,
      );
    }

    const item = this._getItem(dao, collectionName, itemId);
    const current = item.getFloat("current_stock") || 0;
    const reserved = item.getFloat("reserved_stock") || 0;
    const available = current - reserved;

    if (available < requestedQty) {
      throw new Error(
        `Insufficient available stock for ${collectionName} ${itemId}. Available: ${available}, Requested: ${requestedQty}`,
      );
    }
  },

  // ==========================================
  // 3. CORE MUTATIONS
  // ==========================================

  /**
   * تحديث المخزون الفعلي بناءً على حركة مخزون (IN / OUT).
   */
  incrementalUpdate: function (
    dao,
    collectionName,
    itemId,
    direction,
    quantity,
  ) {
    if (quantity <= 0) throw new Error(`Quantity must be greater than zero.`);

    const item = this._getItem(dao, collectionName, itemId);
    let current = item.getFloat("current_stock") || 0;

    // ✅ استخدام switch لتسهيل إضافة اتجاهات مستقبلية (adjustment, transfer, etc.)
    switch (direction) {
      case "in":
        current += quantity;
        break;

      case "out":
        // ✅ Defense-in-depth: حماية أخيرة (Assertion)
        const reserved = item.getFloat("reserved_stock") || 0;
        const availableBefore = current - reserved;
        if (availableBefore < quantity) {
          throw new Error(
            `Critical: Attempted to deduct ${quantity} from ${collectionName} ${itemId}, but only ${availableBefore} was available.`,
          );
        }
        current -= quantity;
        break;

      default:
        throw new Error(
          `Invalid movement direction: ${direction}. Must be 'in' or 'out'.`,
        );
    }

    item.set("current_stock", current);
    this._recalculateAndSave(dao, item);
  },

  // ==========================================
  // 4. RESERVATION LIFECYCLE
  // ==========================================

  reserveStock: function (dao, collectionName, itemId, qty) {
    if (qty <= 0) throw new Error(`Reservation quantity must be positive.`);

    // ✅ DRY: نستخدم دالة التحقق بدلاً من تكرار المنطق (مصدر واحد للحقيقة)
    this.ensureAvailableStock(dao, collectionName, itemId, qty);

    const item = this._getItem(dao, collectionName, itemId);
    let reserved = item.getFloat("reserved_stock") || 0;

    reserved += qty;
    item.set("reserved_stock", reserved);
    this._recalculateAndSave(dao, item);
  },

  releaseReservation: function (dao, collectionName, itemId, qty) {
    // ✅ Fail-Fast: الكمية الصفرية أو السالبة تعتبر خطأً برمجياً
    if (qty <= 0) {
      throw new Error(
        `Release quantity must be positive. Got: ${qty} for ${collectionName} ${itemId}`,
      );
    }

    const item = this._getItem(dao, collectionName, itemId);
    let reserved = item.getFloat("reserved_stock") || 0;

    if (reserved < qty) {
      throw new Error(
        `Cannot release ${qty} for ${collectionName} ${itemId}. Currently reserved: ${reserved}`,
      );
    }

    reserved -= qty;
    item.set("reserved_stock", reserved);
    this._recalculateAndSave(dao, item);
  },
};

module.exports = StockService;
