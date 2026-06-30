
# Business Invariants

**Version:** v1.0  
**Date:** 2026-06-22

## Purpose

This document defines the core invariants of the Dairy ERP system.

An invariant is a rule that must always be true.

State transitions may change data.  
Business workflows may create records.  
Hooks may update projections.

However, no operation is allowed to violate an invariant.

If an invariant would be broken, the operation must fail.

---

## 1. Inventory Invariants

### Product Stock

`products.current_stock >= 0`

A product can never have negative stock.

### Available Stock

`products.available_stock >= 0`

Available stock can never be negative.

### Reserved Stock

`products.reserved_stock >= 0`

Reserved stock can never be negative.

### Reservation Constraint

`reserved_stock <= current_stock`

Reserved quantity may never exceed physical stock.

### Product Batch Remaining Quantity

`product_batches.quantity_remaining >= 0`

A batch can never have negative remaining quantity.

### Batch Constraint

`quantity_remaining <= quantity_produced`

Remaining quantity cannot exceed originally produced quantity.

### Material Stock

`materials.current_stock >= 0`

Raw materials may never become negative.

---

## 2. Financial Invariants

### Transaction Amount

`transactions.amount > 0`

All transactions must have positive amounts.

Reversals are represented by reversal transactions, not negative values.

### Remaining Amount

`transactions.remaining_amount >= 0`

Remaining amount may never be negative.

### Payment Constraint

`transactions.paid_amount <= transactions.amount`

Paid amount cannot exceed transaction amount.

### Fully Paid Constraint

`payment_status = paid`

Requires:

`remaining_amount = 0`

### Unpaid Constraint

`payment_status = unpaid`

Requires:

`paid_amount = 0`

### Partial Constraint

`payment_status = partial`

Requires:

`0 < paid_amount < amount`

---

## 3. Sales Invariants

### Order Total

`sales_orders.total_amount = SUM(sales_order_items.line_total)`

Order total must equal the sum of all order lines.

### Delivered Order

If:

`sales_orders.status = delivered`

Then:

`inventory_movements` must exist

and

`transaction` must exist

### Completed Order

If:

`sales_orders.status = completed`

Then:

`payment_status = paid`

---

## 4. Purchase Invariants

### Purchase Total

`purchase_orders.total_amount = SUM(purchase_order_items.line_total)`

### Delivered Purchase

If:

`purchase_orders.status = delivered`

Then:

`material_movements` must exist

and

`transaction` must exist

---

## 5. Production Invariants

### Output Requirement

A completed production batch must contain at least one output.

`COUNT(production_outputs) > 0`

### Input Requirement

A completed production batch must contain at least one input.

`COUNT(production_inputs) > 0`

### Produced Quantity

`quantity_produced > 0`

### Product Batch Cost

`unit_cost > 0`

---

## 6. Payroll Invariants

### Net Salary

`net_salary >= 0`

### Payroll Total

`payroll_records.net_salary = base_salary + bonuses + allowances - deductions - penalties`

### Locked Attendance

If attendance is locked:

`attendance.status = locked`

Then:

attendance cannot be modified

---

## 7. Ledger Invariants

### Cached Balance

`cached_balance = SUM(all posted ledger entries)`

### Ledger Immutability

Posted ledger entries cannot be edited.

They may only be reversed.

---

## 8. Transaction Invariants

### Posted Transaction

If:

`transactions.status = posted`

Then:

transaction becomes immutable

### Reversed Transaction

If:

`transactions.status = reversed`

Then:

editing is forbidden

### Deletion Rule

Financial transactions must never be deleted.

Only reversals are allowed.

---

## 9. Audit Invariants

Every inventory event must be auditable.

Every financial event must be auditable.

Every state transition must be auditable.

Deletion of audit logs is forbidden.

---

## Golden Rule

If any operation violates an invariant:

`Operation = REJECTED`

Data integrity has priority over user convenience.
```

