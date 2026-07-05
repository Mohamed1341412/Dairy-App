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

# Source:

- inventory_movements (append-only event log)

Projection Owner:

- StockService

Derived Fields:

- products.current_stock
- products.available_stock
- product_batches.quantity_remaining

Rule:
Inventory movements are the source of truth.
Stock fields are cached projections maintained by StockService.

Transaction Rule:
Domain hooks create inventory movements and update projections
inside the same transaction.

# Correction Strategy:

- Errors are corrected via new adjustment movements with
- corrects_movement_id pointing to the original movement.

---

## Material Stock Truth

**Source:**

- `material_movements` (append-only event log)

**Projection Owner:**

- `MaterialService`

**Derived Fields:**

- `materials.current_stock`
- `materials.available_stock`
- `materials.reserved_stock`

**Rule:**
Material movements are the source of truth.
Material stock fields are cached projections maintained by MaterialService.

**Transaction Rule:**
Domain hooks create material movements and update projections
inside the same transaction.

**Correction Strategy:**
Errors are corrected via new adjustment movements with
`corrects_movement_id` pointing to the original movement.

---

## Reserved Stock Truth (MVP)

Source:

- Reservation operations performed through StockService

Projection:

- products.reserved_stock

Owner:

- StockService

Consumers:

- sales_hooks
- production_hooks (if production reservations are introduced later)

Rule:
reserved_stock is a cached projection maintained exclusively by StockService.
It must never be modified directly.

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

### Payment Projections & Allocations

1. **Absolute Source of Truth**: The financial reality of payments is strictly defined by:
   - `payments` (The total cash/value movement).
   - `payment_allocations` (The exact mapping of which payment covers which transaction).
2. **Derived Fields (Projections)**: The following fields in the `transactions` collection are **strictly read-only projections**:
   - `paid_amount`
   - `remaining_amount`
   - `payment_status` (`unpaid`, `partial`, `paid`, `overpaid`)
3. **Rebuild Rule**: These fields MUST NEVER be edited directly via API or UI. They are automatically recalculated by the `PaymentService.refreshTransactionProjection()` method whenever an allocation is created or deleted.
4. **Payment Boundaries**: A single `payment` can be allocated across multiple `transactions`. The system enforces that `SUM      (payment_allocations.allocated_amount)` for a single payment never exceeds `payment.amount`.

### Deprecated Projections (UI Convenience Only)

Fields like `sales_orders.payment_status` and `purchase_orders.payment_status` are **strictly deprecated projections**.
They exist _only_ to simplify Flutter UI list views and avoid complex joins on the frontend.
The **absolute source of truth** for payment status remains `transactions.payment_status` (derived from `payment_allocations`).
**Rule:** Never use the order's payment status for financial reporting, ledger generation, or backend logic.

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

| Domain            | Source of Truth        | Projection Owner                       |
| ----------------- | ---------------------- | -------------------------------------- |
| Product Stock     | inventory_movements    | StockService                           |
| Material Stock    | material_movements     | MaterialService (or StockService)      |
| Reserved Stock    | Reservation operations | StockService                           |
| Financial Records | transactions           | LedgerService (called by Domain Hooks) |
| Payments          | payments + allocations | PaymentService                         |
| Production        | production_batches     | production_hooks                       |
| Attendance        | attendance             | payroll_hooks                          |
| Audit             | activity_logs          | AuditService                           |

---

Golden Rule:

When a cached field conflicts with its source,
the source wins.
Always.
