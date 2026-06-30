// pb_hooks/utils/audit_helper.pb.js
const AuditService = require(`${__hooks}/services/audit_service.pb.js`);
const { OperationTypes } = require(`${__hooks}/core/operation_types.pb.js`);

/**
 * Compares specific fields between oldRecord and record, 
 * and logs an audit entry only if actual changes are detected.
 */
function logChanges(e, action, fieldsToTrack) {
  const oldData = {};
  const newData = {};

  for (const field of fieldsToTrack) {
    // e.oldRecord is null on Create, but always exists on Update
    const oldVal = e.oldRecord ? e.oldRecord.get(field) : null;
    const newVal = e.record.get(field);

    // ✅ JSON.stringify safely handles primitives, arrays (relations), and objects (JSON fields)
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      oldData[field] = oldVal;
      newData[field] = newVal;
    }
  }

  // Only log if something actually changed
  if (Object.keys(oldData).length > 0) {
    AuditService.log({
      userId: e.auth?.id || null,
      action: action,
      operationType: OperationTypes.UPDATE,
      collectionName: e.collection.name, // ✅ Dynamic! No hardcoding 'products'
      recordId: e.record.id,
      oldData: oldData, // ✅ Just the old values
      newData: newData, // ✅ Just the new values
    });
  }
}

module.exports = { logChanges };