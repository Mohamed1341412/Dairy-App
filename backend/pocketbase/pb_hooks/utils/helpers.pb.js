// pb_hooks/utils/helpers.pb.js

const AuditService = require(`${__hooks}/services/audit_service.pb.js`);
const { OperationTypes } = require(`${__hooks}/core/operation_types.pb.js`);

const Helpers = {
  /**
   * Safely retrieves the original record from the database.
   * This is more reliable than e.record.original() in production.
   */
  getOriginalRecord: (e) => {
    if (!e.record.id) return null;
    try {
      return $app.dao().findRecordById(e.collection.name, e.record.id);
    } catch (err) {
      return null;
    }
  },

  /**
   * Safely checks if a field has been modified.
   */
  isFieldModified: (e, fieldName) => {
    // If it's a new record, any non-null field is "modified"
    if (!e.record.id) return e.record.get(fieldName) !== null;

    const original = Helpers.getOriginalRecord(e);
    if (!original) return false;

    return original.get(fieldName) !== e.record.get(fieldName);
  },

  /**
   * Throws error if field is modified.
   */
  ensureFieldNotModified: (e, fieldName, message) => {
    if (Helpers.isFieldModified(e, fieldName)) {
      const errorMsg =
        message || `Direct editing of ${fieldName} is prohibited.`;

      AuditService.log({
        userId: e.auth?.id,
        action: "IMMUTABLE_COLLECTION_UPDATE_BLOCKED",
        operationType: OperationTypes.PERMISSION,
        collectionName: e.collection.name,
        recordId: e.record.id,
      });

      throw new BadRequestError(errorMsg);
    }
  },

  /**
   * Check for admin bypass.
   */
  canBypass: (e) => {
    // Check if user is super admin
    if (e.auth?.get("role") === "super_admin") return true;

    // Check if request is from system context (internal)
    if (e.requestInfo?.context === "system") return true;

    return false;
  },
};

module.exports = Helpers;
