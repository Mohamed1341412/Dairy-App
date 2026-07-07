// pb_hooks/services/transaction_service.pb.js

const ReferenceNumberService = require(
  `${__hooks}/services/reference_number_service.pb.js`,
);

/**
 * Domain Constants - Single Source of Truth
 */
const PARTY_TYPES = Object.freeze(["client", "vendor", "worker"]);
const DIRECTIONS = Object.freeze(["in", "out"]);

/**
 * Fields to copy from original transaction to reversal transaction
 * Ordered according to pb_schema_V_2.1.3.json for easy maintenance
 */
const FIELDS_TO_COPY = Object.freeze([
  "account_id",
  "type",
  "transaction_category",
  "party_type",
  "client_id",
  "vendor_id",
  "worker_id",
  "car_id",
  "equipment_id",
  "amount",
  "transaction_source",
  "direction",
  "affects_cashflow",
  "reference_number",
  "reference_collection",
  "reference_id",
]);

/**
 * TransactionService (v2.1 - Final Production-Ready)
 *
 * ⚠️ ARCHITECTURAL BOUNDARY:
 * - مسؤول فقط عن إنشاء Transactions والتحقق من صحتها
 * - ينشئ Reversal Transactions كـ Business Operation مشتركة
 * - لا يضع قيم افتراضية للـ Business Logic (payment_status, paid_amount, etc.)
 * - يضع فقط الثوابت الحقيقية: status='posted', transaction_number=generated, is_reversal=false
 *
 * ⚠️ ATOMICITY RULE:
 * يجب استدعاء هذا الـ Service داخل runInTransaction من قِبَل Domain Hook.
 *
 * ⚠️ RESPONSIBILITIES:
 * - Transaction creation
 * - Transaction number generation (auto)
 * - Status setting (auto: 'posted')
 * - is_reversal setting (auto: false)
 * - Validation (party, account, reference, amount, direction, affects_cashflow)
 * - Reversal transaction creation (Business Operation)
 */

const TransactionService = {
  // ==========================================
  // 1. VALIDATION HELPERS
  // ==========================================

  _validateAmount: function (options) {
    if (!options.amount || options.amount <= 0) {
      throw new Error(
        `Transaction amount must be positive. Got: ${options.amount}`,
      );
    }
  },

  _validateDirection: function (options) {
    if (!options.direction || !DIRECTIONS.includes(options.direction)) {
      throw new Error(
        `Transaction direction must be 'in' or 'out'. Got: ${options.direction}`,
      );
    }
  },

  _validateType: function (options) {
    if (!options.type) {
      throw new Error(`Transaction type is required.`);
    }
  },

  _validateSource: function (options) {
    if (!options.source) {
      throw new Error(`Transaction source is required.`);
    }
  },

  _validateDates: function (options) {
    if (!options.transactionDate) {
      throw new Error(`Transaction date is required.`);
    }
    if (!options.businessDate) {
      throw new Error(`Business date is required.`);
    }
  },

  _validateParty: function (options) {
    if (options.partyType) {
      if (!PARTY_TYPES.includes(options.partyType)) {
        throw new Error(
          `Invalid party_type: '${options.partyType}'. Must be one of: ${PARTY_TYPES.join(", ")}`,
        );
      }

      const partyId = options[`${options.partyType}Id`];
      if (!partyId) {
        throw new Error(
          `Transaction has party_type='${options.partyType}' but ${options.partyType}_id is missing.`,
        );
      }
    } else {
      if (options.clientId || options.vendorId || options.workerId) {
        throw new Error(`Party ID exists but party_type is missing.`);
      }
    }
  },

  _validateAccount: function (options) {
    if (
      options.affectsCashflow === undefined ||
      options.affectsCashflow === null
    ) {
      throw new Error(`affects_cashflow is required. Must be true or false.`);
    }

    if (options.affectsCashflow) {
      if (!options.accountId) {
        throw new Error(
          `Transaction affects_cashflow=true but account_id is missing.`,
        );
      }
    } else {
      if (options.accountId) {
        throw new Error(`account_id exists but affects_cashflow=false.`);
      }
    }
  },

  _validateReference: function (options) {
    const hasRefCollection = !!options.referenceCollection;
    const hasRefId = !!options.referenceId;
    const hasRefNumber = !!options.referenceNumber;

    if (hasRefCollection || hasRefId || hasRefNumber) {
      if (!hasRefCollection || !hasRefId || !hasRefNumber) {
        throw new Error(
          `Reference fields must be complete: referenceCollection, referenceId, and referenceNumber are all required together.`,
        );
      }
    }
  },

  _validate: function (options) {
    this._validateAmount(options);
    this._validateDirection(options);
    this._validateType(options);
    this._validateSource(options);
    this._validateDates(options);
    this._validateParty(options);
    this._validateAccount(options);
    this._validateReference(options);
  },

  // ==========================================
  // 2. CREATE TRANSACTION
  // ==========================================

  /**
   * إنشاء Transaction جديد.
   * ⚠️ يجب استدعاؤها داخل runInTransaction من قِبَل Domain Hook.
   *
   * ⚠️ VALUES SET AUTOMATICALLY (Constants):
   * - transaction_number (generated via ReferenceNumberService)
   * - status = 'posted'
   * - is_reversal = false
   *
   * ⚠️ VALUES NOT SET AUTOMATICALLY (Business Logic):
   * - paid_amount (caller sets if needed)
   * - remaining_amount (caller sets if needed)
   * - payment_status (caller sets if needed)
   * - transaction_category (caller sets if needed)
   */
  create: function (dao, options) {
    // ✅ Fail-Fast: DAO validation
    if (!dao) {
      throw new Error("DAO is required.");
    }

    this._validate(options);

    const txCollection = dao.findCollectionByNameOrId("transactions");
    const tx = new $classes.Record(txCollection);

    // Auto-generated constants
    tx.set("transaction_number", ReferenceNumberService.generate("TX"));
    tx.set("status", "posted");
    tx.set("is_reversal", false);

    // Required fields from options
    tx.set("type", options.type);
    tx.set("amount", options.amount);
    tx.set("direction", options.direction);
    tx.set("transaction_date", options.transactionDate);
    tx.set("business_date", options.businessDate);
    tx.set("transaction_source", options.source);

    // Business decision - no default, must be explicit
    tx.set("affects_cashflow", options.affectsCashflow);

    // Party fields (if provided)
    if (options.partyType) {
      tx.set("party_type", options.partyType);
      tx.set(`${options.partyType}_id`, options[`${options.partyType}Id`]);
    }

    // Account field (if affects cashflow)
    if (options.accountId) {
      tx.set("account_id", options.accountId);
    }

    // Reference fields (all-or-nothing)
    if (options.referenceCollection) {
      tx.set("reference_collection", options.referenceCollection);
      tx.set("reference_id", options.referenceId);
      tx.set("reference_number", options.referenceNumber);
    }

    // Business logic fields (caller must set if needed)
    if (options.paidAmount !== undefined) {
      tx.set("paid_amount", options.paidAmount);
    }

    if (options.remainingAmount !== undefined) {
      tx.set("remaining_amount", options.remainingAmount);
    }

    if (options.paymentStatus) {
      tx.set("payment_status", options.paymentStatus);
    }

    if (options.transactionCategory) {
      tx.set("transaction_category", options.transactionCategory);
    }

    // Optional relation fields
    if (options.carId) {
      tx.set("car_id", options.carId);
    }
    if (options.equipmentId) {
      tx.set("equipment_id", options.equipmentId);
    }
    if (options.notes) {
      tx.set("notes", options.notes);
    }

    dao.saveRecord(tx);

    return tx;
  },

  // ==========================================
  // 3. REVERSE TRANSACTION (Business Operation)
  // ==========================================

  /**
   * إنشاء Reversal Transaction من Transaction أصلي.
   * ⚠️ يجب استدعاؤها داخل runInTransaction من قِبَل Domain Hook.
   *
   * ⚠️ BUSINESS OPERATION:
   * - هذه ليست مجرد Factory، بل Business Operation مشتركة
   * - تستخدم في: sales, purchases, payroll, expenses, maintenance
   * - تنسخ جميع الحقول من الأصلي وتضيف reversal-specific fields
   *
   * ⚠️ VALIDATION:
   * - Original transaction must have id (saved)
   * - Original transaction must be 'posted'
   * - Original transaction must not be a reversal
   *
   * ⚠️ VALUES SET AUTOMATICALLY:
   * - transaction_number (generated)
   * - status = 'posted'
   * - is_reversal = true
   * - reversal_of = originalTx.id
   * - All fields in FIELDS_TO_COPY copied from original
   *
   * ⚠️ VALUES NOT SET AUTOMATICALLY (Business Logic - caller decides):
   * - paid_amount (caller sets via options if needed)
   * - remaining_amount (caller sets via options if needed)
   * - payment_status (caller sets via options if needed)
   * - notes (caller sets via options if needed)
   *
   * @param {Object} dao - Transaction DAO
   * @param {Record} originalTx - Original transaction to reverse
   * @param {Object} options - Optional overrides (businessDate, paidAmount, remainingAmount, paymentStatus, notes)
   * @returns {Record} Reversal transaction record
   */
  reverse: function (dao, originalTx, options = {}) {
    // ✅ Fail-Fast: DAO validation
    if (!dao) {
      throw new Error("DAO is required.");
    }

    // Validation - check id first
    if (!originalTx || !originalTx.id) {
      throw new Error("Cannot reverse an unsaved transaction.");
    }

    if (originalTx.get("status") !== "posted") {
      throw new Error(
        `Cannot reverse non-posted transaction. Current status: ${originalTx.get("status")}`,
      );
    }

    if (originalTx.get("is_reversal")) {
      throw new Error(`Cannot reverse a reversal transaction.`);
    }

    // Create reversal transaction
    const txCollection = dao.findCollectionByNameOrId("transactions");
    const reversalTx = new $classes.Record(txCollection);

    // Auto-generated values
    reversalTx.set("transaction_number", ReferenceNumberService.generate("TX"));
    reversalTx.set("status", "posted");
    reversalTx.set("is_reversal", true);
    reversalTx.set("reversal_of", originalTx.id);

    // Copy all fields from original using FIELDS_TO_COPY
    for (const field of FIELDS_TO_COPY) {
      reversalTx.set(field, originalTx.get(field));
    }

    // ✅ BUG FIX: Override dates with proper fallback using || (not ??)
    reversalTx.set(
      "business_date",
      options.businessDate || originalTx.get("business_date"),
    );
    reversalTx.set(
      "transaction_date",
      options.transactionDate ||
        options.businessDate ||
        originalTx.get("transaction_date"),
    );

    // Business logic fields (caller decides via options)
    if (options.paidAmount !== undefined) {
      reversalTx.set("paid_amount", options.paidAmount);
    }

    if (options.remainingAmount !== undefined) {
      reversalTx.set("remaining_amount", options.remainingAmount);
    }

    if (options.paymentStatus) {
      reversalTx.set("payment_status", options.paymentStatus);
    }

    if (options.notes !== undefined) {
      reversalTx.set("notes", options.notes);
    }

    dao.saveRecord(reversalTx);

    return reversalTx;
  },
};

module.exports = TransactionService;
