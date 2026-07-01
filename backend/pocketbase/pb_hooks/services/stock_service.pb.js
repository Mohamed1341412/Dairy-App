// pb_hooks/services/stock_service.pb.js

const { Collections, MovementDirections } = require(
  `${__hooks}/core/collections.pb.js`,
);
const EventLogger = require(`${__hooks}/services/event_logger.pb.js`);

/**
 * Simplified Stock & Inventory Engine Service
 * Handles incremental stock updates and negative stock validation.
 */
const StockService = {
  /**
   * Performs an incremental stock update based on a single movement.
   * @param {models.Record} movement - The inventory movement record.
   */
  incrementalUpdate: (movement) => {
    const productId = movement.get("product_id");
    const qty = movement.getFloat("quantity");
    const direction = movement.get("direction"); // 'in' or 'out'

    try {
      $app.dao().runInTransaction((dao) => {
        const product = dao.findRecordById(Collections.PRODUCTS, productId);
        const oldStock = product.getFloat("current_stock");
        const oldReserved = product.getFloat("reserved_stock");

        let newStock = oldStock;
        if (direction === MovementDirections.IN) {
          newStock += qty;
        } else if (direction === MovementDirections.OUT) {
          newStock -= qty;
          // ✅ VALIDATE INSIDE THE TRANSACTION!
          const newAvailable = newStock - oldReserved;
          if (newAvailable < 0) {
            throw new Error(
              `Insufficient stock for product: '${product.get("name")}'. Available: ${newAvailable + qty}, Requested: ${qty}.`,
            );
          }
        }

        // Auto-calculate available stock
        const newAvailable = newStock - oldReserved;

        product.set("current_stock", newStock);
        product.set("available_stock", newAvailable);

        // Save with internal context to bypass hooks
        dao.saveRecord(product);

        EventLogger.log("INCREMENTAL_STOCK_UPDATE", {
          productId,
          movementId: movement.id,
          oldStock,
          newStock,
          qty,
          direction,
        });
      });
    } catch (err) {
      console.error(
        `Failed incremental stock update for product ${productId}:`,
        err,
      );
      throw err;
    }
  },

  /**
   * Validates if there is enough available stock for a requested quantity.
   * @param {string} productId
   * @param {number} requestedQty
   */
  validateNegativeStock: (productId, requestedQty) => {
    let product;
    try {
      product = $app.dao().findRecordById(Collections.PRODUCTS, productId);
    } catch (err) {
      throw new Error(
        `Stock validation failed: Product with ID '${productId}' not found.`,
      );
    }

    const available = product.getFloat("available_stock");
    if (available < requestedQty) {
      throw new Error(
        `Insufficient stock for product: '${product.get("name")}'. Available: ${available}, Requested: ${requestedQty}.`,
      );
    }
  },
};

module.exports = StockService;
