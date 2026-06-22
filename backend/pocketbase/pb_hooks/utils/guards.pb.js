// pb_hooks/utils/guards.pb.js

const Helpers = require(`${__hooks}/utils/helpers.pb.js`);
const AuditLogger = require(`${__hooks}/services/audit_logger.pb.js`);

const Guards = {
  /**
   * Guard against updates/deletes on locked records.
   */
  lockGuard: (e) => {
    if (Helpers.canBypass(e)) return;

    if (e.record.get('is_locked') === true) {
      AuditLogger.log({
        action: 'LOCKED_RECORD_MODIFICATION_BLOCKED',
        collection: e.collection.name,
        recordId: e.record.id,
        userId: e.auth?.id
      });
      throw new BadRequestError("Record is locked. Cannot update or delete.");
    }
  },

  /**
   * Guard against any updates on immutable collections.
   */
  immutabilityGuard: (e, options = {}) => {
    const message = options.reason || "Financial records are immutable. Create a reversal transaction instead.";

    AuditLogger.log({
      action: 'IMMUTABLE_COLLECTION_UPDATE_BLOCKED',
      collection: e.collection.name,
      recordId: e.record.id,
      userId: e.auth?.id,
      details: { reason: message }
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

    AuditLogger.log({
      action: 'DELETION_BLOCKED',
      collection: e.collection.name,
      recordId: e.record.id,
      userId: e.auth?.id,
      details: { strict: isStrict }
    });

    throw new BadRequestError("Physical deletion is strictly prohibited for this record. Use archiving instead.");
  }
};

module.exports = Guards;
