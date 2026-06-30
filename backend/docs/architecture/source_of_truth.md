# Source of Truth

Version: 1.0

Purpose:
Defines the authoritative owner for every critical business concept in the system.

---

## Financial Truth

Source:
- transactions
- transaction_lines (if implemented)

Derived:
- client_ledgers
- vendor_ledgers
- worker_ledgers
- financial_account_ledgers
- cached balances

Rule:
Ledgers are projections.
Transactions are the source of truth.

---

## Product Stock Truth

Source:
- inventory_movements

Derived:
- products.available_stock is derived from:
  - products.current_stock
  - products.reserved_stock

Rule:
Inventory movements are the source of truth.
Stock fields are cached projections.

---

## Material Stock Truth

Source:
- material_movements

Derived:
- materials.current_stock

Rule:
Material movements are the source of truth.

---

## Reserved Stock Truth (MVP)

Source:
- confirmed sales_orders
- sales_order_items

Projection:
- products.reserved_stock

Owner:
- sales_hooks.pb.js

Rule:
No other hook may modify reserved_stock.

Future:
Move to inventory_reservations collection in v2.

---

## Payment Truth

Source:
- payments
- payment_allocations

Derived:
- transactions.payment_status
- transactions.remaining_amount

Rule:
payment_hooks.pb.js is the only owner.

---

## Attendance Truth

Source:
- attendance

Derived:
- payroll calculations
- absence reports

Rule:
Attendance becomes immutable after lock.

---

## Payroll Truth

Source:
- payroll_records

Derived:
- payroll transactions
- salary reports

Rule:
Approved payroll creates financial transactions.

---

## Production Truth

Source:
- production_batches

Derived:
- inventory movements
- material movements
- product batches

Rule:
Production never updates stock directly.

---

## Audit Truth

Source:
- activity_logs

Rule:
Business records are operational truth.
Audit logs are historical truth.

---

### Ledger Rebuild & Replay Rule

1. **Absolute Ordering**: Ledger entries MUST NEVER be ordered by `created`, `business_date`, or `transaction_date` during a rebuild. These fields can be modified, backdated, or arrive out-of-order during Offline Sync.
2. **The Only Truth**: The ONLY acceptable ordering for replaying ledger entries to reconstruct `cached_balance` is by the immutable integer field `posting_sequence` (ASC).
3. **Sequence Generation**: The `posting_sequence` is generated globally via `system_settings` inside a Database Transaction. It is strictly monotonically increasing and immutable once saved.
4. **Reversal Handling**: When rebuilding, entries where `is_reversal = true` are treated as normal mathematical offsets. The system does not "delete" the original entry; it mathematically neutralizes it via the reversal entry's `posting_sequence`.

---

## Ownership Summary

| Domain | Source of Truth | Owner |
|----------|----------|----------|
| Product Stock | inventory_movements | inventory_hooks |
| Material Stock | material_movements | material_hooks |
| Reserved Stock | confirmed sales_orders + sales_order_items | sales_hooks |
| Financial Records | transactions | finance_hooks |
| Payments | payments + allocations | payment_hooks |
| Production | production_batches | production_hooks |
| Attendance | attendance | payroll_hooks |
| Audit | activity_logs | AuditService |

---

Golden Rule:

When a cached field conflicts with its source,
the source wins.
Always.
