// pb_hooks/hooks/validation/sync_guard.pb.js

const { Collections } = require(`${__hooks}/core/collections.pb.js`);

/**
 * Prevents duplicate records based on sync_id.
 */
const syncProtectedCollections = [
  Collections.TRANSACTIONS,
  Collections.PAYMENTS,
  Collections.INVENTORY_MOVEMENTS,
  Collections.MATERIAL_MOVEMENTS
];

syncProtectedCollections.forEach((collectionName) => {
  onRecordBeforeCreateRequest((e) => {
    const syncId = e.record.get('sync_id');
    if (!syncId) return e.next();

    try {
      const existing = $app.dao().findFirstRecordByData(collectionName, 'sync_id', syncId);
      if (existing) {
        throw new BadRequestError(`Duplicate record detected for sync_id: ${syncId}`);
      }
    } catch (err) {
      // In PocketBase JS, findFirstRecordByData throws if not found.
      // We only rethrow if it's NOT a "not found" error.
      // However, to be safe and avoid swallowing unexpected DB errors,
      // we check if the error message contains 'sql: no rows in result set'
      // which is the standard Go/PocketBase "not found" indicator.
      if (err && err.message && !err.message.includes('sql: no rows in result set')) {
        throw err;
      }
    }

    return e.next();
  }, collectionName);
});
