// pb_hooks/hooks/locking/locking_hooks.pb.js

const { Collections } = require(`${__hooks}/core/collections.pb.js`);
const Guards = require(`${__hooks}/utils/guards.pb.js`);

/**
 * Collections subject to lock protection.
 */
const lockableCollections = [
  Collections.SALES_ORDERS,
  Collections.PURCHASE_ORDERS,
  Collections.PAYROLL_RECORDS
];

lockableCollections.forEach((collectionName) => {
  // Prevent UPDATE if record is locked
  onRecordBeforeUpdateRequest((e) => {
    Guards.lockGuard(e);
    return e.next();
  }, collectionName);

  // Prevent DELETE if record is locked
  onRecordBeforeDeleteRequest((e) => {
    Guards.lockGuard(e);
    return e.next();
  }, collectionName);
});
