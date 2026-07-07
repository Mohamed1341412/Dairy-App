// pb_hooks/services/transaction_service.pb.js

const ReferenceNumberService = require(`${__hooks}/services/reference_number_service.pb.js`);

/**
 * TransactionService (v1.1 - Transaction Factory & Validator)
 * 
 * ⚠️ ARCHITECTURAL BOUNDARY:
 * - مسؤول فقط عن إنشاء Transactions والتحقق من صحتها
 * - لا ينشئ Reversal Transactions (يتم في الـ Hooks)
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
 */

const TransactionService = {
    // ==========================================
    // 1. VALIDATION
    // ==========================================

    _validate: function(options) {
        // A. Amount validation
        if (!options.amount || options.amount <= 0) {
            throw new Error(`Transaction amount must be positive. Got: ${options.amount}`);
        }

        // B. Direction validation
        if (!options.direction || !['in', 'out'].includes(options.direction)) {
            throw new Error(`Transaction direction must be 'in' or 'out'. Got: ${options.direction}`);
        }

        // C. Type validation
        if (!options.type) {
            throw new Error(`Transaction type is required.`);
        }

        // D. Source validation
        if (!options.source) {
            throw new Error(`Transaction source is required.`);
        }

        // E. Date validation
        if (!options.transactionDate) {
            throw new Error(`Transaction date is required.`);
        }
        if (!options.businessDate) {
            throw new Error(`Business date is required.`);
        }

        // F. Party validation (bi-directional)
        if (options.partyType) {
            // Validate party_type value
            if (!['client', 'vendor', 'worker'].includes(options.partyType)) {
                throw new Error(`Invalid party_type: '${options.partyType}'. Must be 'client', 'vendor', or 'worker'.`);
            }
            
            const partyId = options[`${options.partyType}Id`];
            if (!partyId) {
                throw new Error(`Transaction has party_type='${options.partyType}' but ${options.partyType}_id is missing.`);
            }
        } else {
            // Check if any party ID exists without party_type
            if (options.clientId || options.vendorId || options.workerId) {
                throw new Error(`Party ID exists but party_type is missing.`);
            }
        }

        // G. Account validation (bi-directional)
        if (options.affectsCashflow === undefined || options.affectsCashflow === null) {
            throw new Error(`affects_cashflow is required. Must be true or false.`);
        }
        
        if (options.affectsCashflow) {
            if (!options.accountId) {
                throw new Error(`Transaction affects_cashflow=true but account_id is missing.`);
            }
        } else {
            if (options.accountId) {
                throw new Error(`account_id exists but affects_cashflow=false.`);
            }
        }

        // H. Reference validation (all-or-nothing business rule)
        const hasRefCollection = !!options.referenceCollection;
        const hasRefId = !!options.referenceId;
        const hasRefNumber = !!options.referenceNumber;

        if (hasRefCollection || hasRefId || hasRefNumber) {
            if (!hasRefCollection || !hasRefId || !hasRefNumber) {
                throw new Error(`Reference fields must be complete: referenceCollection, referenceId, and referenceNumber are all required together.`);
            }
        }
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
    create: function(dao, options) {
        // Validation
        this._validate(options);

        // Create transaction record
        const txCollection = dao.findCollectionByNameOrId('transactions');
        const tx = new $classes.Record(txCollection);

        // Auto-generated constants
        tx.set('transaction_number', ReferenceNumberService.generate('TX'));
        tx.set('status', 'posted');
        tx.set('is_reversal', false);

        // Required fields from options
        tx.set('type', options.type);
        tx.set('amount', options.amount);
        tx.set('direction', options.direction);
        tx.set('transaction_date', options.transactionDate);
        tx.set('business_date', options.businessDate);
        tx.set('transaction_source', options.source);

        // Business decision - no default, must be explicit
        tx.set('affects_cashflow', options.affectsCashflow);

        // Party fields (if provided)
        if (options.partyType) {
            tx.set('party_type', options.partyType);
            tx.set(`${options.partyType}_id`, options[`${options.partyType}Id`]);
        }

        // Account field (if affects cashflow)
        if (options.accountId) {
            tx.set('account_id', options.accountId);
        }

        // Reference fields (all-or-nothing)
        if (options.referenceCollection) {
            tx.set('reference_collection', options.referenceCollection);
            tx.set('reference_id', options.referenceId);
            tx.set('reference_number', options.referenceNumber);
        }

        // Business logic fields (caller must set if needed)
        if (options.paidAmount !== undefined) {
            tx.set('paid_amount', options.paidAmount);
        }
        
        if (options.remainingAmount !== undefined) {
            tx.set('remaining_amount', options.remainingAmount);
        }
        
        if (options.paymentStatus) {
            tx.set('payment_status', options.paymentStatus);
        }

        if (options.transactionCategory) {
            tx.set('transaction_category', options.transactionCategory);
        }

        // Optional relation fields
        if (options.carId) {
            tx.set('car_id', options.carId);
        }
        if (options.equipmentId) {
            tx.set('equipment_id', options.equipmentId);
        }
        if (options.notes) {
            tx.set('notes', options.notes);
        }

        // Save transaction
        dao.saveRecord(tx);

        return tx;
    }
};

module.exports = TransactionService;