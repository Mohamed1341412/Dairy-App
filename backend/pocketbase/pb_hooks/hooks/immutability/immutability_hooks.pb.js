// pb_hooks/hooks/immutability/immutability_hooks.pb.js

const { Collections } = require(`${__hooks}/core/collections.pb.js`);
const Guards = require(`${__hooks}/utils/guards.pb.js`);
const Helpers = require(`${__hooks}/utils/helpers.pb.js`);

/**
 * 1. Strict Collection-Level Immutability (Append-only)
 * No UPDATES, No DELETES.
 * No bypass allowed for these collections to ensure audit integrity.
 */
const strictImmutableCollections = [
  Collections.TRANSACTIONS,
  Collections.PAYMENTS,
  Collections.CLIENT_LEDGERS,
  Collections.VENDOR_LEDGERS,
  Collections.FINANCIAL_ACCOUNT_LEDGERS,
  Collections.INVENTORY_MOVEMENTS,
  Collections.MATERIAL_MOVEMENTS
];

strictImmutableCollections.forEach((collectionName) => {
  onRecordBeforeUpdateRequest((e) => {
    // Force strict immutability - no bypass
    Guards.immutabilityGuard(e, { reason: `${collectionName} records are immutable. Corrections must be made via reversal.` });
    return e.next();
  }, collectionName);

  onRecordBeforeDeleteRequest((e) => {
    // Force strict deletion ban - no bypass
    Guards.deletionGuard(e, true);
    return e.next();
  }, collectionName);
});

/**
 * 2. Field-Level Immutability (product_batches)
 * Allow metadata updates, block core financial/quantity fields.
 */
onRecordBeforeUpdateRequest((e) => {
  if (Helpers.canBypass(e)) return e.next();

  const immutableFields = [
	'quantity_produced',
	'unit_cost',
	'total_cost'
  ];

  immutableFields.forEach((field) => {
    Helpers.ensureFieldNotModified(e, field, `Field '${field}' is immutable in product batches.`);
  });

  return e.next();
}, Collections.PRODUCT_BATCHES);

// Still prevent deletion of batches
onRecordBeforeDeleteRequest((e) => {
  Guards.deletionGuard(e, true);
  return e.next();
}, Collections.PRODUCT_BATCHES);

/**
 * 3. Soft Delete Protection for Operational Entities
 * Physical deletion is banned; use is_archived instead.
 */
const operationalEntities = [
  Collections.PRODUCTS,
  Collections.MATERIALS,
  Collections.CLIENTS,
  Collections.VENDORS,
  Collections.WORKERS,
  Collections.CARS,
  Collections.EQUIPMENT
];

operationalEntities.forEach((collectionName) => {
  onRecordBeforeDeleteRequest((e) => {
    Guards.deletionGuard(e, true);
    return e.next();
  }, collectionName);
});
