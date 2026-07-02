// pb_hooks/services/stock_service.pb.js

/**
 * StockService (v1.3 - Core Inventory Engine)
 *
 * ⚠️ القواعد الذهبية:
 * 1. هذا الـ Service لا يفتح Transactions بنفسه. يجب تمرير (dao) من الـ Hook.
 * 2. يدعم المنتجات فقط (products). المواد لها material_movements منفصلة.
 * 3. حقل (available_stock) هو Projection يُحسب دائماً ولا يُعدّل يدوياً.
 * 4. يفصل مرحلة التحقق (Validation) عن مرحلة التعديل (Mutation) لضمان Fail-Fast.
 *
 * ⚠️ ARCHITECTURAL BOUNDARY:
 * - inventory_movements هي Source of Truth للمنتجات
 * - هذا الـ Service يحافظ على Projections (current_stock, available_stock, quantity_remaining)
 * - Domain Hooks تستدعي هذا الـ Service داخل runInTransaction()
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
  // 3. RESERVATION LIFECYCLE
  // ==========================================

  /**
   * حجز كمية من المخزون (تزيد reserved_stock وتقلل available_stock).
   * يُستخدم عند إنشاء أمر بيع أو إنتاج مؤكد.
   */
  reserveStock: function (dao, collectionName, itemId, qty) {
    if (qty <= 0) throw new Error(`Reservation quantity must be positive.`);

    this.ensureAvailableStock(dao, collectionName, itemId, qty);

    const item = this._getItem(dao, collectionName, itemId);
    let reserved = item.getFloat("reserved_stock") || 0;

    reserved += qty;
    item.set("reserved_stock", reserved);
    this._recalculateAndSave(dao, item);
  },

  /**
   * تحرير حجز سابق (يقلل reserved_stock ويزيد available_stock).
   * يُستخدم عند إلغاء أمر بيع، أو عند تحويل الحجز إلى حركة خروج فعلية.
   */
  releaseReservation: function (dao, collectionName, itemId, qty) {
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

  // ==========================================
  // 4. MOVEMENT PROJECTION ENGINE
  // ==========================================

  /**
   * 🏭 PROJECTION ENGINE:
   * تطبيق حركة مخزون على المنتجات والدفعات.
   * ⚠️ يجب استدعاؤها داخل runInTransaction من قِبَل Domain Hook.
   *
   * هذه الدالة هي المحرك الرئيسي الذي يقوم بـ:
   * 1. تحديث products.current_stock
   * 2. تحديث products.available_stock (كـ Projection)
   * 3. تحديث product_batches.quantity_remaining
   *
   * ⚠️ هذه الدالة تدعم المنتجات فقط. المواد لها material_movements منفصلة.
   */
  applyMovement: function (dao, movement) {
    const productId = movement.get("product_id");
    const batchId = movement.get("batch_id");
    const direction = movement.get("direction"); // 'in' | 'out'
    const qty = movement.getFloat("quantity");

    if (qty <= 0) {
      throw new Error(`Movement quantity must be positive. Got: ${qty}`);
    }

    // ✅ 1. تحديث المخزون الفعلي للمنتج (current_stock)
    if (productId) {
      const product = this._getItem(dao, "products", productId);

      let current = product.getFloat("current_stock") || 0;

      if (direction === "in") {
        current += qty;
      } else if (direction === "out") {
        if (current < qty) {
          throw new Error(
            `Insufficient physical stock for product '${product.get("name")}'. Available: ${current}, Requested: ${qty}`,
          );
        }
        current -= qty;
      }

      product.set("current_stock", current);

      // ✅ Recalculate available_stock (Projection Invariant)
      const reserved = product.getFloat("reserved_stock") || 0;
      product.set("available_stock", current - reserved);

      dao.saveRecord(product);
    }

    // ✅ 2. تحديث الكمية المتبقية في الدفعة (Batch Projection)
    if (batchId) {
      const batch = this._getItem(dao, "product_batches", batchId);

      // التحقق من أن الدفعة تابعة للمنتج نفسه (Data Consistency Guard)
      if (productId && batch.get("product_id") !== productId) {
        throw new Error(
          `Batch ${batchId} does not belong to product ${productId}.`,
        );
      }

      let remaining = batch.getFloat("quantity_remaining") || 0;

      if (direction === "in") {
        remaining += qty;
      } else if (direction === "out") {
        if (remaining < qty) {
          throw new Error(
            `Insufficient quantity in batch. Available: ${remaining}, Requested: ${qty}`,
          );
        }
        remaining -= qty;
      }

      batch.set("quantity_remaining", remaining);

      // Auto-status update
      if (remaining <= 0 && batch.get("status") === "active") {
        batch.set("status", "sold_out");
      } else if (remaining > 0 && batch.get("status") === "sold_out") {
        batch.set("status", "active");
      }

      dao.saveRecord(batch);
    }
  },
};

module.exports = StockService;
