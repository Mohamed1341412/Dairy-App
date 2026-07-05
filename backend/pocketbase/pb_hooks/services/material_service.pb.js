// pb_hooks/services/material_service.pb.js

/**
 * MaterialService - Core Material Engine
 *
 * Mirrors StockService API for materials.
 * material_movements are the source of truth.
 * Stock fields are cached projections.
 */

const MaterialService = {
  // ==========================================
  // 1. INTERNAL HELPERS
  // ==========================================

  _getMaterial: function (dao, materialId) {
    const material = dao.findRecordById("materials", materialId);
    if (!material) {
      throw new Error(`Material not found: ${materialId}`);
    }
    return material;
  },

  _recalculateAndSave: function (dao, material) {
    const current = material.getFloat("current_stock") || 0;
    const reserved = material.getFloat("reserved_stock") || 0;
    const available = current - reserved;

    material.set("available_stock", available);
    dao.saveRecord(material);
  },

  // ==========================================
  // 2. VALIDATION
  // ==========================================

  ensureAvailable: function (dao, materialId, requestedQty) {
    if (requestedQty <= 0) {
      throw new Error(
        `Requested quantity must be positive. Got: ${requestedQty} for material ${materialId}`,
      );
    }

    const material = this._getMaterial(dao, materialId);
    const current = material.getFloat("current_stock") || 0;
    const reserved = material.getFloat("reserved_stock") || 0;
    const available = current - reserved;

    if (available < requestedQty) {
      throw new Error(
        `Insufficient available material for ${materialId}. Available: ${available}, Requested: ${requestedQty}`,
      );
    }
  },

  // ==========================================
  // 3. RESERVATION LIFECYCLE
  // ==========================================

  reserve: function (dao, materialId, qty) {
    if (qty <= 0) throw new Error(`Reservation quantity must be positive.`);

    this.ensureAvailable(dao, materialId, qty);

    const material = this._getMaterial(dao, materialId);
    let reserved = material.getFloat("reserved_stock") || 0;

    reserved += qty;
    material.set("reserved_stock", reserved);
    this._recalculateAndSave(dao, material);
  },

  releaseReservation: function (dao, materialId, qty) {
    if (qty <= 0) {
      throw new Error(
        `Release quantity must be positive. Got: ${qty} for material ${materialId}`,
      );
    }

    const material = this._getMaterial(dao, materialId);
    let reserved = material.getFloat("reserved_stock") || 0;

    if (reserved < qty) {
      throw new Error(
        `Cannot release ${qty} for material ${materialId}. Currently reserved: ${reserved}`,
      );
    }

    reserved -= qty;
    material.set("reserved_stock", reserved);
    this._recalculateAndSave(dao, material);
  },

  // ==========================================
  // 4. MOVEMENT PROJECTION ENGINE
  // ==========================================

  applyMovement: function (dao, movement) {
    const materialId = movement.get("material_id");
    const direction = movement.get("direction");
    const qty = movement.getFloat("quantity");

    if (qty <= 0) {
      throw new Error(`Movement quantity must be positive. Got: ${qty}`);
    }

    if (!materialId) {
      throw new Error(`Material ID is required for material movements.`);
    }

    const material = this._getMaterial(dao, materialId);
    let current = material.getFloat("current_stock") || 0;

    if (direction === "in") {
      current += qty;
    } else if (direction === "out") {
      if (current < qty) {
        throw new Error(
          `Insufficient physical material for '${material.get("name")}'. Available: ${current}, Requested: ${qty}`,
        );
      }
      current -= qty;
    } else {
      throw new Error(
        `Invalid direction: ${direction}. Must be 'in' or 'out'.`,
      );
    }

    material.set("current_stock", current);
    this._recalculateAndSave(dao, material);
  },
};

module.exports = MaterialService;
