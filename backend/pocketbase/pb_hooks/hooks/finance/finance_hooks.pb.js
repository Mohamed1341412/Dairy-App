// pb_hooks/hooks/finance/finance_hooks.pb.js

const { Collections, TransactionDirections } = require(
  `${__hooks}/core/collections.pb.js`,
);
const Helpers = require(`${__hooks}/utils/helpers.pb.js`);
const ReferenceNumberService = require(
  `${__hooks}/services/reference_number_service.pb.js`,
);

// Audit additions.
const { AuditActions } = require(`${__hooks}/core/audit_actions.pb.js`);
const { OperationTypes } = require(`${__hooks}/core/operation_types.pb.js`);
const AuditService = require(`${__hooks}/services/audit_service.pb.js`);

/**
 * Validates transaction direction and reversal logic.
 */
onRecordBeforeCreateRequest((e) => {
  const direction = e.record.get("direction");
  const isReversal = e.record.get("is_reversal");
  const reversalOf = e.record.get("reversal_of");

  // 1. Direction Enforcement
  const validDirections = Object.values(TransactionDirections);
  if (!validDirections.includes(direction)) {
    throw new BadRequestError(`Invalid transaction direction: ${direction}.`);
  }

  // 2. Reversal Logic Enforcement
  if (isReversal === true) {
    if (!reversalOf) {
      throw new BadRequestError(
        "Reversal transactions must reference the original transaction ID in 'reversal_of'.",
      );
    }

    let original;
    try {
      original = $app
        .dao()
        .findRecordById(Collections.TRANSACTIONS, reversalOf);
    } catch (err) {
      throw new BadRequestError(
        `Original transaction with ID '${reversalOf}' not found.`,
      );
    }

    if (original.get("is_reversal") === true) {
      throw new BadRequestError("Cannot reverse a reversal transaction.");
    }

    // Check for existing reversals
    let existingReversal = null;
    try {
      existingReversal = $app
        .dao()
        .findFirstRecordByFilter(
          Collections.TRANSACTIONS,
          `reversal_of = "${reversalOf}"`,
        );
    } catch (err) {
      // إذا لم يتم العثور على سجل، فهذا هو المتوقع – لا نرمي خطأ.
    }
    if (existingReversal) {
      throw new BadRequestError("This transaction has already been reversed.");
    }
  }

  // 3. Auto-generate Reference Number if not provided
  if (!e.record.get("reference_number")) {
    e.record.set("reference_number", ReferenceNumberService.generate("TR"));
  }

  return e.next();
}, Collections.TRANSACTIONS);

/**
 * Auto-generate reference numbers for other operational collections.
 */
[
  Collections.SALES_ORDERS,
  Collections.PURCHASE_ORDERS,
  Collections.PAYROLL_RECORDS,
].forEach((collectionName) => {
  onRecordBeforeCreateRequest((e) => {
    if (!e.record.get("reference_number")) {
      const prefix = collectionName.split("_")[0].toUpperCase().slice(0, 2);
      e.record.set("reference_number", ReferenceNumberService.generate(prefix));
    }
    return e.next();
  }, collectionName);
});

// Note: finance_hooks delete section removed.
// deletionGuard in immutability_hooks is now the single source of truth.

/**
 * Audit logging for financial transactions (only after creation)
 */
onRecordAfterCreateRequest((e) => {
  const isReversal = e.record.get("is_reversal") === true;
  const action = isReversal
    ? AuditActions.TRANSACTION_REVERSED
    : AuditActions.TRANSACTION_POSTED;
  const opType = isReversal ? OperationTypes.REVERSE : OperationTypes.POST;
  AuditService.log({
    userId: AuditService.getUserId(e),
    action,
    operationType: opType,
    collectionName: Collections.TRANSACTIONS,
    recordId: e.record.id,
  });
  return e.next();
}, Collections.TRANSACTIONS);
