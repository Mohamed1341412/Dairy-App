// pb_hooks/utils/helpers.pb.js

/**
 * Helpers Utility Module
 *
 * Contains shared, pure functions used across multiple hooks.
 * Adheres to the DRY principle without creating harmful abstractions.
 */

const Helpers = {
  // ==========================================
  // 1. ROBUST DATA COMPARISON
  // ==========================================

  /**
   * Robust equality check for PocketBase records.
   * Safely handles primitives, nulls, arrays (Relations), and objects (JSON fields).
   *
   * Why this is needed:
   * Standard === fails for Arrays/Objects with the same content but different memory references.
   * JSON.stringify fails if object keys are in a different order.
   */
  valuesEqual: function (val1, val2) {
    // 1. Strict equality (handles primitives, undefined, and same reference)
    if (val1 === val2) return true;

    // 2. Null/Undefined check
    if (val1 == null || val2 == null) return val1 === val2;

    // 3. Handle Arrays (PocketBase Relations are arrays of IDs)
    if (Array.isArray(val1) && Array.isArray(val2)) {
      if (val1.length !== val2.length) return false;
      // Sort to ensure order doesn't affect equality (e.g., multi-select relations)
      return (
        JSON.stringify(val1.slice().sort()) ===
        JSON.stringify(val2.slice().sort())
      );
    }

    // 4. Handle Objects (JSON fields)
    if (typeof val1 === "object" && typeof val2 === "object") {
      // Stable stringify: sorts keys recursively to prevent false negatives
      const sortKeys = (obj) => {
        if (typeof obj !== "object" || obj === null) return obj;
        if (Array.isArray(obj)) return obj.map(sortKeys);
        return Object.keys(obj)
          .sort()
          .reduce((acc, key) => {
            acc[key] = sortKeys(obj[key]);
            return acc;
          }, {});
      };
      return JSON.stringify(sortKeys(val1)) === JSON.stringify(sortKeys(val2));
    }

    return false;
  },

  // ==========================================
  // 2. EVENT CONTEXT UTILITIES
  // ==========================================

  /**
   * Safely extracts the authenticated user's ID from the event context.
   * Returns null if the action was triggered by the system/API without auth.
   */
  getUserId: function (e) {
    return e.auth?.id || null;
  },

  /**
   * Formats a Date object or string to 'YYYY-MM-DD' for PocketBase date fields.
   */
  formatDate: function (dateInput) {
    if (!dateInput) return new Date().toISOString().split("T")[0];
    const d = new Date(dateInput);
    return d.toISOString().split("T")[0];
  },

  // ==========================================
  // 3. RECORD STATE & VALIDATION
  // ==========================================

  /**
   * Safely checks if a specific field has been modified during an update.
   * ✅ PERFORMANCE: Uses native e.oldRecord instead of querying the DB.
   */
  isFieldModified: function (e, fieldName) {
    // If it's a new record (Create), any non-null field is considered "modified"
    if (!e.record.id) return e.record.get(fieldName) !== null;

    // For updates, compare with the native oldRecord
    const oldRecord = e.oldRecord;
    if (!oldRecord) return false;

    return !this.valuesEqual(oldRecord.get(fieldName), e.record.get(fieldName));
  },

  /**
   * Throws an error if a protected field is modified.
   * ✅ FIX: Uses standard Error instead of non-existent BadRequestError.
   */
  ensureFieldNotModified: function (e, fieldName, message) {
    if (this.isFieldModified(e, fieldName)) {
      const errorMsg =
        message || `Direct editing of '${fieldName}' is prohibited.`;
      // Throw standard Error. PocketBase automatically translates this to a 400 Bad Request.
      throw new Error(errorMsg);
    }
  },

  // ==========================================
  // 4. AUTHORIZATION & BYPASS
  // ==========================================

  /**
   * Check for admin bypass or system context.
   */
  canBypass: function (e) {
    // Check if user is super admin (assuming 'role' field exists in users collection)
    if (e.auth?.get("role") === "super_admin") return true;

    // Check if request is from system context (internal API calls, hooks triggering other hooks)
    if (e.requestInfo?.context === "system") return true;

    return false;
  },
};

module.exports = Helpers;
