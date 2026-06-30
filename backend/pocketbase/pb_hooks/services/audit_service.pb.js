const { OperationTypes } = require(`${__hooks}/core/operation_types.pb.js`); // optional, for consistency

const AuditService = {
  log({
    userId = null,
    action,
    operationType,
    collectionName,
    recordId,
    oldData = null,
    newData = null,
  }) {
    if (!action || !operationType || !collectionName || !recordId) {
      console.error("[AuditService] Missing required fields", {
        action,
        operationType,
        collectionName,
        recordId,
      });
      return;
    }
    if (collectionName === "activity_logs") return;

    try {
      const logsCollection = $app
        .dao()
        .findCollectionByNameOrId("activity_logs");
      const record = new Record(logsCollection);
      record.set("user_id", userId);
      record.set("action", action);
      record.set("operation_type", operationType);
      record.set("collection_name", collectionName);
      record.set("record_id", recordId);
      // Save the JSON data
      if (oldData) record.set("old_data", oldData);
      if (newData) record.set("new_data", newData);
      $app.dao().saveRecord(record);
    } catch (err) {
      console.error("[AuditService] Failed to save audit log:", err);
    }
  },

  // Helper للحصول على userId من سياق الـ hook
  getUserId(e) {
    return e.auth?.id || e.requestInfo?.auth?.id || null;
  },
};

module.exports = AuditService;
