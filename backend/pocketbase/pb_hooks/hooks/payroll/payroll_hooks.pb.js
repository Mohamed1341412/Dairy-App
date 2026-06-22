// pb_hooks/hooks/payroll/payroll_hooks.pb.js
const { Collections } = require(`${__hooks}/core/collections.pb.js`);
const { AuditActions } = require(`${__hooks}/core/audit_actions.pb.js`);
const { OperationTypes } = require(`${__hooks}/core/operation_types.pb.js`);
const AuditService = require(`${__hooks}/services/audit_service.pb.js`);

onRecordAfterCreateRequest((e) => {
  AuditService.log({
    userId: AuditService.getUserId(e),
    action: AuditActions.WORKER_SALARY_ADJUSTED,
    operationType: OperationTypes.ADJUST,
    collectionName: Collections.SALARY_ADJUSTMENTS,
    recordId: e.record.id,
  });
  return e.next();
}, Collections.SALARY_ADJUSTMENTS);
