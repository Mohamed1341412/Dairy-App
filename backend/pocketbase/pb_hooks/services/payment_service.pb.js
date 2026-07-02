// pb_hooks/services/payment_service.pb.js

const EPSILON = 0.0001;

/**
 * PaymentService
 *
 * مسؤول عن إدارة تخصيص المدفوعات (Allocations) وتحديث Projections الفواتير.
 *
 * ⚠️ القاعدة الذهبية:
 * - مصدر الحقيقة المطلق هو: payment_allocations
 * - حقول (paid_amount, remaining_amount, payment_status) في transactions هي Projections.
 * - يجب استدعاء هذا الـ Service داخل $app.dao().runInTransaction().
 */

const PaymentService = {
  // ==========================================
  // 1. ALLOCATION MANAGEMENT
  // ==========================================

  /**
   * تخصيص جزء من دفعة لسداد فاتورة.
   */
  allocatePayment: function (dao, paymentId, transactionId, amount) {
    if (amount <= 0)
      throw new Error("Allocation amount must be greater than zero.");

    const payment = dao.findRecordById("payments", paymentId);
    const totalPaymentAmount = payment.getFloat("amount");

    // التحقق من عدم تجاوز مبلغ الدفعة الإجمالي
    const currentAllocated = this.calculateAllocatedAmount(dao, paymentId);
    if (currentAllocated + amount > totalPaymentAmount) {
      throw new Error(
        `Cannot allocate ${amount}. Exceeds total payment amount of ${totalPaymentAmount}.`,
      );
    }

    // 1. إنشاء سجل التخصيص
    const allocation = new $classes.Record(
      dao.findCollectionByNameOrId("payment_allocations"),
    );
    allocation.set("payment_id", paymentId);
    allocation.set("transaction_id", transactionId);
    allocation.set("allocated_amount", amount);
    allocation.set("allocated_at", new Date().toISOString().split("T")[0]);
    dao.saveRecord(allocation);

    // 2. تحديث Projection الفاتورة
    this.refreshTransactionProjection(dao, transactionId);
  },

  /**
   * إلغاء تخصيص دفعة (حذف السجل وإعادة حساب الفاتورة).
   */
  unallocatePayment: function (dao, allocationId) {
    const allocation = dao.findRecordById("payment_allocations", allocationId);
    const transactionId = allocation.get("transaction_id");

    // 1. حذف سجل التخصيص
    dao.deleteRecord(allocation);

    // 2. إعادة حساب Projection الفاتورة
    this.refreshTransactionProjection(dao, transactionId);
  },

  // ==========================================
  // 2. CALCULATIONS (Source of Truth Queries)
  // ==========================================

  /**
   * حساب إجمالي المبلغ المخصص من دفعة معينة (للتحقق من الرصيد المتاح للدفعة).
   */
  calculateAllocatedAmount: function (dao, paymentId) {
    const allocations = dao.findRecordsByFilter(
      "payment_allocations",
      `payment_id = "${paymentId}"`,
    );
    let total = 0;
    for (const alloc of allocations) {
      total += alloc.getFloat("allocated_amount");
    }
    return total;
  },

  /**
   * حساب إجمالي المبلغ المسدد لفاتورة معينة.
   */
  calculatePaidAmount: function (dao, transactionId) {
    const allocations = dao.findRecordsByFilter(
      "payment_allocations",
      `transaction_id = "${transactionId}"`,
    );
    let total = 0;
    for (const alloc of allocations) {
      total += alloc.getFloat("allocated_amount");
    }
    return total;
  },

  /**
   * حساب المبلغ المتبقي للفاتورة.
   */
  calculateRemainingAmount: function (dao, transactionId) {
    const transaction = dao.findRecordById("transactions", transactionId);
    const totalAmount = transaction.getFloat("amount");
    const paidAmount = this.calculatePaidAmount(dao, transactionId);
    let remaining = totalAmount - paidAmount;

    // ✅ إذا كان الفرق ضئيلاً جداً (أقل من EPSILON)، نعتبره صفراً لتجنب أخطاء الفاصلة العائمة
    if (Math.abs(remaining) < EPSILON) {
      remaining = 0;
    }

    return remaining;
  },

  /**
   * تحديد حالة الدفع بناءً على المعطيات.
   */
  calculatePaymentStatus: function (totalAmount, paidAmount) {
    // 1. لم يتم دفع شيء (أو المبلغ المدفوع صفر تقريباً)
    if (paidAmount <= EPSILON) return "unpaid";

    // 2. المبلغ المدفوع يطابق الإجمالي (ضمن هامش الخطأ)
    if (Math.abs(totalAmount - paidAmount) < EPSILON) return "paid";

    // 3. تم دفع جزء أقل من الإجمالي
    if (paidAmount < totalAmount) return "partial";

    // 4. تم دفع أكثر من الإجمالي (Overpayment)
    return "overpaid";
  },

  // ==========================================
  // 3. PROJECTION REFRESH
  // ==========================================

  /**
   * دالة داخلية لتحديث حقول Projection في الفاتورة (Transaction).
   */
  refreshTransactionProjection: function (dao, transactionId) {
    const transaction = dao.findRecordById("transactions", transactionId);
    const totalAmount = transaction.getFloat("amount");
    const paidAmount = this.calculatePaidAmount(dao, transactionId);
    const remainingAmount = totalAmount - paidAmount;
    const status = this.calculatePaymentStatus(totalAmount, paidAmount);

    transaction.set("paid_amount", paidAmount);
    transaction.set("remaining_amount", remainingAmount);
    transaction.set("payment_status", status);

    dao.saveRecord(transaction);
  },
};

module.exports = PaymentService;
