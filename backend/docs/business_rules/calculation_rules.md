# Calculation Rules

**Version:** v1.0  
**Date:** 2026-06-22

## Purpose

This document defines the official formulas used throughout the Dairy ERP system.

All calculations must follow these rules.

No alternative formulas are allowed.

---

## 1. Product Stock Calculations

### Current Stock

`current_stock = SUM(IN inventory_movements) - SUM(OUT inventory_movements)`

Source of Truth:

`inventory_movements`

### Reserved Stock

reserved_stock = SUM(active reservations managed by StockService)

Source of Truth:
StockService maintains this projection via reserveStock() and releaseReservation()

Rule:
reserved_stock is a cached projection maintained exclusively by StockService.
It must never be modified directly by hooks or UI.

### Available Stock

`available_stock = current_stock - reserved_stock`

---

## 2. Material Stock Calculations

### Material Current Stock

`current_stock = SUM(IN material_movements) - SUM(OUT material_movements)`

Source of Truth:

`material_movements`

---

## 3. Sales Calculations

### Line Total

`line_total = quantity × unit_price`

### Order Subtotal

`subtotal = SUM(line_total)`

### Discount Amount

`discount_amount = subtotal × discount_percent / 100`

### Order Total

`total_amount = subtotal - discount_amount + additional_fees`

---

## 4. Purchase Calculations

### Purchase Line Total

`line_total = quantity × unit_cost`

### Purchase Total

`total_amount = SUM(line_total) + additional_costs`

---

## 5. Payment Calculations

### Paid Amount

`paid_amount = SUM(confirmed payment_allocations.amount)`

### Remaining Amount

`remaining_amount = transaction.amount - paid_amount`

### Payment Status

**Unpaid**

`paid_amount = 0`

Result:

`payment_status = unpaid`

**Partial**

`0 < paid_amount < amount`

Result:

`payment_status = partial`

**Paid**

`remaining_amount = 0`

Result:

`payment_status = paid`

---

## 6. Production Calculations

### Total Material Cost

`total_material_cost = SUM(consumed_material_quantity × unit_cost)`

### Production Cost

`production_cost = material_cost + labor_cost + overhead_cost`

### Unit Cost

`unit_cost = production_cost / total_output_quantity`

---

## 7. Payroll Calculations

### Total Bonuses

`total_bonuses = SUM(bonuses)`

### Total Deductions

`total_deductions = SUM(deductions) + SUM(penalties)`

### Net Salary

`net_salary = base_salary + total_bonuses + allowances - total_deductions`

---

## 8. Vendor Balance

### Vendor Cached Balance

`vendor.cached_balance = SUM(vendor_ledgers.amount)`

Meaning:

Positive = Factory owes vendor  
Negative = Vendor credit balance

---

## 9. Client Balance

### Client Cached Balance

`client.cached_balance = SUM(client_ledgers.amount)`

Meaning:

Positive = Client owes factory  
Negative = Client credit balance

---

## 10. Worker Balance

### Worker Cached Balance

`worker.cached_balance = SUM(worker_ledgers.amount)`

Meaning:

Positive = Factory owes worker  
Negative = Worker advance balance

---

## 11. Financial Account Balance

### Account Balance

`financial_account.balance = SUM(financial_account_ledgers.amount)`

---

## 12. Net Profit

### Formula

`net_profit = total_income - total_expenses`

### Total Income

`SUM(posted income transactions)`

### Total Expenses

`SUM(posted expense transactions)`

Including:

- Purchases
- Payroll
- Utilities
- Maintenance
- Miscellaneous Expenses

---

## Golden Rule

Derived values must never be edited manually.

Examples:

- `current_stock`
- `available_stock`
- `reserved_stock`
- `cached_balance`
- `remaining_amount`
- `net_profit`

These values are projections calculated from source records and business events.

```

```
