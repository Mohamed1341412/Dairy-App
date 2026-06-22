// pb_hooks/hooks/users/user_hooks.pb.js
const { AuditActions } = require(`${__hooks}/core/audit_actions.pb.js`);
const { OperationTypes } = require(`${__hooks}/core/operation_types.pb.js`);
const AuditService = require(`${__hooks}/services/audit_service.pb.js`);

onRecordAfterCreateRequest((e) => {
  AuditService.log({
    userId: AuditService.getUserId(e),
    action: AuditActions.USER_CREATED,
    operationType: OperationTypes.CREATE,
    collectionName: "users",
    recordId: e.record.id,
  });
  return e.next();
}, "users");

onRecordAfterUpdateRequest((e) => {
  let oldRecord = e.oldRecord || e.record.original?.();
  if (!oldRecord) return e.next();

  const oldRole = oldRecord.get("role");
  const newRole = e.record.get("role");
  if (oldRole !== newRole) {
    AuditService.log({
      userId: AuditService.getUserId(e),
      action: AuditActions.ROLE_CHANGED,
      operationType: OperationTypes.PERMISSION,
      collectionName: "users",
      recordId: e.record.id,
    });
  }
  return e.next();
}, "users");
