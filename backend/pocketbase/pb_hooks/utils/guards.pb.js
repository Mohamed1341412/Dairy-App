// pb_hooks/utils/guards.pb.js

const Helpers = require(`${__hooks}/utils/helpers.pb.js`);
const AuditService = require(`${__hooks}/services/audit_service.pb.js`);
const { OperationTypes } = require(`${__hooks}/core/operation_types.pb.js`);

const Guards = {
  /**
   * Guard against updates/deletes on locked records.
   */
  lockGuard: (e) => {
    if (Helpers.canBypass(e)) return;

    if (e.record.get("is_locked") === true) {
      AuditService.log({
        userId: e.auth?.id,
        action: "IMMUTABLE_COLLECTION_UPDATE_BLOCKED",
        operationType: OperationTypes.PERMISSION,
        collectionName: e.collection.name,
        recordId: e.record.id,
      });
      throw new BadRequestError("Record is locked. Cannot update or delete.");
    }
  },

  /**
   * Guard against any updates on immutable collections.
   */
  immutabilityGuard: (e, options = {}) => {
    const message =
      options.reason ||
      "Financial records are immutable. Create a reversal transaction instead.";

    AuditService.log({
      userId: e.auth?.id,
      action: "IMMUTABLE_COLLECTION_UPDATE_BLOCKED",
      operationType: OperationTypes.PERMISSION,
      collectionName: e.collection.name,
      recordId: e.record.id,
    });

    throw new BadRequestError(message);
  },

  /**
   * Guard against any deletions.
   * STRICT: Financial and core records can NEVER be deleted, even by super_admin.
   */
  deletionGuard: (e, isStrict = true) => {
    // Only allow bypass if NOT strict and user has bypass rights
    if (!isStrict && Helpers.canBypass(e)) return;

    AuditService.log({
      userId: e.auth?.id,
      action: "IMMUTABLE_COLLECTION_UPDATE_BLOCKED",
      operationType: OperationTypes.PERMISSION,
      collectionName: e.collection.name,
      recordId: e.record.id,
    });

    throw new BadRequestError(
      "Physical deletion is strictly prohibited for this record. Use archiving instead.",
    );
  },
};

module.exports = Guards;
