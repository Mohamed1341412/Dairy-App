// pb_hooks/hooks/users/user_hooks.pb.js
const { AuditActions } = require(`${__hooks}/core/audit_actions.pb.js`);
const { OperationTypes } = require(`${__hooks}/core/operation_types.pb.js`);
const AuditService = require(`${__hooks}/services/audit_service.pb.js`);

// 1. Audit User Creation
onRecordAfterCreateRequest((e) => {
  AuditService.log({
    userId: AuditService.getUserId(e),
    action: AuditActions.USER_CREATED,
    operationType: OperationTypes.CREATE,
    collectionName: "users",
    recordId: e.record.id,
    // ✅ Capture initial state for audit trail
    newData: {
      email: e.record.get("email"),
      role: e.record.get("role"),
      name: e.record.get("name"),
    },
  });
}, "users");

// 2. Audit User Updates (Role Changes & Soft Deletes)
onRecordAfterUpdateRequest((e) => {
  // ✅ e.oldRecord is natively provided by PocketBase JS
  const oldRecord = e.oldRecord;
  if (!oldRecord) return;

  const userId = AuditService.getUserId(e);
  const recordId = e.record.id;

  // A. Audit Role Changes (Permission Event)
  const oldRole = oldRecord.get("role");
  const newRole = e.record.get("role");
  if (oldRole !== newRole) {
    AuditService.log({
      userId: userId,
      action: AuditActions.ROLE_CHANGED,
      operationType: OperationTypes.PERMISSION,
      collectionName: "users",
      recordId: recordId,
      oldData: { role: oldRole }, // ✅ Pass old value
      newData: { role: newRole }, // ✅ Pass new value
    });
  }

  // B. Audit Soft Delete / Restore (Lifecycle Event)
  // ✅ Required by project_principles.md: "Important actions: Create, Archive, Restore... Must generate audit logs."
  const oldArchived = oldRecord.get("is_archived");
  const newArchived = e.record.get("is_archived");

  if (oldArchived !== newArchived) {
    const isArchiving = newArchived === true;

    AuditService.log({
      userId: userId,
      // Note: Ensure USER_ARCHIVED and USER_RESTORED exist in your audit_actions.pb.js
      action: isArchiving
        ? AuditActions.USER_ARCHIVED
        : AuditActions.USER_RESTORED,
      operationType: isArchiving
        ? OperationTypes.ARCHIVE
        : OperationTypes.RESTORE,
      collectionName: "users",
      recordId: recordId,
      oldData: { is_archived: oldArchived },
      newData: { is_archived: newArchived },
    });
  }
}, "users");
