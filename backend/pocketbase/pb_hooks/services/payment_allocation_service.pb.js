// pb_hooks/services/payment_allocation_service.pb.js

/**
 * PaymentAllocationService (v1.1 - Final Production-Ready)
 *
 * ⚠️ ARCHITECTURAL BOUNDARY:
 * - مسؤول فقط عن تنفيذ وإلغاء التوزيعات (Allocations)
 * - المالك الوحيد لـ:
 *   - payment_allocations table
 *   - transactions.paid_amount
 *   - transactions.remaining_amount
 *   - transactions.payment_status
 *   - payments.unallocated_amount
 *
 * ⚠️ ATOMICITY RULE:
 * يجب استدعاء هذا الـ Service داخل runInTransaction من قِبَل Domain Hook.
 *
 * ⚠️ DESIGN PRINCIPLES:
 * - Fail-Fast: Validation كاملة قبل أي تعديل
 * - Single Source of Truth: إعادة حساب unallocated_amount من DB
 * - No Duplicate Queries: جلب الـ Transactions مرة واحدة
 * - Dumb Execution: _applyAllocation و _restoreAllocation لا تقومان بأي save()
 * - Clear Ownership: Service واحد يتحكم في كل التعديلات
 */

const PaymentAllocationService = {
  // ==========================================
  // 1. VALIDATION HELPERS
  // ==========================================

  _validatePayment: function (payment) {
    if (!payment || !payment.id) {
      throw new Error("Payment is required.");
    }
    if (payment.get("status") !== "confirmed") {
      throw new Error(
        `Payment must be confirmed. Current status: ${payment.get("status")}`,
      );
    }
  },

  _validateAllocations: function (allocations) {
    if (!allocations || allocations.length === 0) {
      throw new Error("At least one allocation is required.");
    }

    // Validate allocated_amount > 0
    allocations.forEach((alloc) => {
      const amount = alloc.getFloat("allocated_amount");
      if (!amount || amount <= 0 || isNaN(amount)) {
        throw new Error(
          `Invalid allocated_amount: ${amount}. Must be greater than 0.`,
        );
      }
    });
  },

  _validateNoDuplicateTransactions: function (allocations) {
    const txIds = allocations.map((a) => a.get("transaction_id"));
    const uniqueTxIds = [...new Set(txIds)];

    if (txIds.length !== uniqueTxIds.length) {
      throw new Error(
        "Cannot allocate to same transaction multiple times in one operation.",
      );
    }
  },

  _validateTransactions: function (allocationsWithTx, isReverse) {
    allocationsWithTx.forEach(({ allocation, transaction }) => {
      // Transaction must not be cashflow (only for execute, not reverse)
      if (!isReverse && transaction.get("affects_cashflow")) {
        throw new Error(
          `Cannot allocate to cashflow transaction: ${transaction.id}`,
        );
      }

      // Transaction must not be reversed (only for execute, not reverse)
      if (!isReverse && transaction.get("status") === "reversed") {
        throw new Error(
          `Cannot allocate to reversed transaction: ${transaction.id}`,
        );
      }

      // Allocation must not exceed remaining (only for execute, not reverse)
      if (!isReverse) {
        const allocated = allocation.getFloat("allocated_amount");
        const remaining = transaction.getFloat("remaining_amount");
        if (allocated > remaining) {
          throw new Error(
            `Allocation ${allocated} exceeds remaining ${remaining} for transaction ${transaction.id}`,
          );
        }
      }
    });
  },

  _getPaymentParty: function (payment) {
    if (payment.get("client_id")) {
      return { type: "client", id: payment.get("client_id") };
    }
    if (payment.get("vendor_id")) {
      return { type: "vendor", id: payment.get("vendor_id") };
    }
    if (payment.get("worker_id")) {
      return { type: "worker", id: payment.get("worker_id") };
    }
    throw new Error("Payment must have a party (client, vendor, or worker).");
  },

  _getTransactionParty: function (transaction) {
    const partyType = transaction.get("party_type");
    const partyId = transaction.get(`${partyType}_id`);
    return { type: partyType, id: partyId };
  },

  _validatePartyConsistency: function (payment, allocationsWithTx) {
    const paymentParty = this._getPaymentParty(payment);

    allocationsWithTx.forEach(({ transaction }) => {
      const txParty = this._getTransactionParty(transaction);

      if (
        paymentParty.type !== txParty.type ||
        paymentParty.id !== txParty.id
      ) {
        throw new Error(
          `Cannot allocate payment from ${paymentParty.type} ${paymentParty.id} ` +
            `to transaction of ${txParty.type} ${txParty.id}.`,
        );
      }
    });
  },

  _validateTotals: function (payment, allocations, isReverse) {
    // Only validate totals for execute, not reverse
    if (!isReverse) {
      const totalAllocated = allocations.reduce(
        (sum, alloc) => sum + alloc.getFloat("allocated_amount"),
        0,
      );

      if (totalAllocated > payment.getFloat("amount")) {
        throw new Error(
          `Total allocations ${totalAllocated} exceed payment amount ${payment.getFloat("amount")}.`,
        );
      }
    }
  },

  _validate: function (dao, payment, allocations, isReverse = false) {
    // 1. Basic validations
    this._validatePayment(payment);
    this._validateAllocations(allocations);
    this._validateNoDuplicateTransactions(allocations);

    // 2. Fetch transactions once (avoid duplicate queries)
    const allocationsWithTx = allocations.map((alloc) => {
      const tx = dao.findRecordById(
        "transactions",
        alloc.get("transaction_id"),
      );
      if (!tx) {
        throw new Error(
          `Transaction not found: ${alloc.get("transaction_id")}`,
        );
      }
      return { allocation: alloc, transaction: tx };
    });

    // 3. Business validations
    this._validateTransactions(allocationsWithTx, isReverse);
    this._validatePartyConsistency(payment, allocationsWithTx);
    this._validateTotals(payment, allocations, isReverse);

    // 4. Return enriched data
    return allocationsWithTx;
  },

  // ==========================================
  // 2. PUBLIC API
  // ==========================================

  /**
   * تنفيذ التوزيعات على الفواتير.
   * ⚠️ يجب استدعاؤها داخل runInTransaction من قِبَل Domain Hook.
   *
   * @param {Object} dao - Transaction DAO
   * @param {Record} payment - Payment record
   * @param {Array} allocations - Array of payment_allocation records
   */
  executeAllocations: function (dao, payment, allocations) {
    // 1. Validate everything (fail-fast)
    const allocationsWithTx = this._validate(dao, payment, allocations, false);

    // 2. Apply allocations (no save here)
    allocationsWithTx.forEach(({ allocation, transaction }) => {
      this._applyAllocation(allocation, transaction);
      dao.saveRecord(transaction);
    });

    // 3. Recalculate unallocated_amount from DB
    this._recalculateUnallocatedAmount(dao, payment);
  },

  /**
   * إلغاء التوزيعات (عند إلغاء Payment).
   * ⚠️ يجب استدعاؤها داخل runInTransaction من قِبَل Domain Hook.
   *
   * @param {Object} dao - Transaction DAO
   * @param {Record} payment - Payment record
   * @param {Array} allocations - Array of payment_allocation records
   */
  reverseAllocations: function (dao, payment, allocations) {
    // 1. Validate (isReverse = true)
    const allocationsWithTx = this._validate(dao, payment, allocations, true);

    // 2. Restore transactions (no save here)
    allocationsWithTx.forEach(({ allocation, transaction }) => {
      this._restoreAllocation(allocation, transaction);
      dao.saveRecord(transaction);
      dao.deleteRecord(allocation);
    });

    // 3. Recalculate unallocated_amount from DB
    this._recalculateUnallocatedAmount(dao, payment);
  },

  // ==========================================
  // 3. EXECUTION HELPERS
  // ==========================================

  /**
   * تعديل Transaction لإضافة التوزيع.
   * ⚠️ لا تقوم بأي save() - الحفظ في الـ Public API.
   */
  _applyAllocation: function (allocation, transaction) {
    const allocatedAmount = allocation.getFloat("allocated_amount");

    const paidAmount = transaction.getFloat("paid_amount") + allocatedAmount;
    const remainingAmount =
      transaction.getFloat("remaining_amount") - allocatedAmount;
    const paymentStatus = this._calculateTransactionPaymentStatus(
      paidAmount,
      transaction.getFloat("amount"),
    );

    transaction.set("paid_amount", paidAmount);
    transaction.set("remaining_amount", remainingAmount);
    transaction.set("payment_status", paymentStatus);
  },

  /**
   * تعديل Transaction لاستعادة التوزيع.
   * ⚠️ لا تقوم بأي save() - الحفظ في الـ Public API.
   */
  _restoreAllocation: function (allocation, transaction) {
    const allocatedAmount = allocation.getFloat("allocated_amount");

    const paidAmount = transaction.getFloat("paid_amount") - allocatedAmount;
    const remainingAmount =
      transaction.getFloat("remaining_amount") + allocatedAmount;
    const paymentStatus = this._calculateTransactionPaymentStatus(
      paidAmount,
      transaction.getFloat("amount"),
    );

    transaction.set("paid_amount", paidAmount);
    transaction.set("remaining_amount", remainingAmount);
    transaction.set("payment_status", paymentStatus);
  },

  // ==========================================
  // 4. CALCULATION HELPERS
  // ==========================================

  /**
   * حساب حالة الدفع للـ Transaction.
   */
  _calculateTransactionPaymentStatus: function (paidAmount, totalAmount) {
    if (paidAmount === 0) return "unpaid";
    if (paidAmount < totalAmount) return "partial";
    return "paid";
  },

  /**
   * إعادة حساب unallocated_amount من DB (Single Source of Truth).
   */
  _recalculateUnallocatedAmount: function (dao, payment) {
    const allocations = dao.findRecordsByFilter(
      "payment_allocations",
      `payment_id = "${payment.id}"`,
    );

    const totalAllocated = allocations.reduce(
      (sum, alloc) => sum + alloc.getFloat("allocated_amount"),
      0,
    );

    payment.set(
      "unallocated_amount",
      payment.getFloat("amount") - totalAllocated,
    );
    dao.saveRecord(payment);
  },
};

module.exports = PaymentAllocationService;
