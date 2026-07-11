# Business Invariants

## Purpose

This document defines the core invariants of the Dairy ERP system.

An invariant is a rule that must always be true.

State transitions may change data.  
Business workflows may create records.  
Hooks may update projections.

However, no operation is allowed to violate an invariant.

If an invariant would be broken, the operation must fail.

## Financial Invariants

### INV-001: Financial Transactions are Append-Only

**Rule**: Posted transactions cannot be modified or deleted.

**Enforcement**:

- `finance_hooks.pb.js`: Immutability Guard
- `immutability_hooks.pb.js`: Strict immutability

**Violation**: Attempting to update a posted transaction throws an error.

---

### INV-002: Cancelled Transactions Cannot Become Active

**Rule**: Once a transaction is cancelled/reversed, it cannot be reactivated.

**Enforcement**:

- `finance_hooks.pb.js`: Status transition validation

**Violation**: Attempting to change status from "cancelled" to "posted" throws an error.

---

### INV-003: Ledger Is Always Derived

**Rule**: Ledger entries are projections from transactions, never created directly.

**Enforcement**:

- `LedgerProjectionService`: Sole owner of ledger creation
- Hooks never write to ledger tables directly

**Violation**: No direct API to create ledger entries.

---

## Business Document Invariants

### INV-004: Business Documents Never Move Cash

**Rule**: Business documents (Sales, Purchase, Expense) create obligations, not cash movements.

**Enforcement**:

- `TransactionService.create()`: `affects_cashflow = false` for business documents
- Payment Module: Creates cash movements

**Violation**: Business document transactions always have `affects_cashflow = false`.

---

### INV-005: Approved Purchase Cannot Be Edited

**Rule**: Once a purchase order is received, core fields cannot be modified.

**Enforcement**:

- `purchase_hooks.pb.js`: Immutability Guard

**Violation**: Attempting to modify `vendor_id` or `net_amount` after receipt throws an error.

---

### INV-006: Payments Never Modify History

**Rule**: Payments settle obligations but do not modify original transactions.

**Enforcement**:

- `PaymentAllocationService`: Updates `paid_amount` and `remaining_amount`
- Original transaction remains immutable

**Violation**: Payments only update payment-related fields.

---

## Inventory Invariants

### INV-007: Inventory Is Calculated Only Through Movements

**Rule**: Stock levels are derived from `inventory_movements`, never modified directly.

**Enforcement**:

- `StockService.applyMovement()`: Sole owner of stock updates
- `inventory_hooks.pb.js`: Append-only protection

**Violation**: No direct API to modify `current_stock`.

---

### INV-008: Available Stock Is a Projection

**Rule**: `available_stock = current_stock - reserved_stock`

**Enforcement**:

- `StockService._recalculateAndSave()`: Always recalculates

**Violation**: `available_stock` is never set directly.

---

## Audit Invariants

### INV-009: All Changes Are Logged

**Rule**: Every create/update/delete operation is logged in `activity_logs`.

**Enforcement**:

- `AuditService.log()`: Called in all hooks
- `activity_logs` table: Immutable

**Violation**: No operation bypasses audit logging.

---

### INV-010: Soft Delete for Operational Entities

**Rule**: Products, materials, clients, vendors, workers cannot be physically deleted.

**Enforcement**:

- `immutability_hooks.pb.js`: Deletion Guard
- Use `is_archived` field instead

**Violation**: Attempting to delete operational entities throws an error.

---

## Atomicity Invariants

### INV-011: All Side Effects Are Atomic

**Rule**: Status changes and side effects happen in the same transaction.

**Enforcement**:

- `e.dao`: Transaction-scoped DAO
- `BeforeUpdate` hooks: All operations in same transaction

**Violation**: Partial failures trigger rollback.

---

### INV-012: No Global DAO in Hooks

**Rule**: Hooks must use `e.dao`, never `$app.dao()`.

**Enforcement**:

- Code review
- Linting rules

**Violation**: Using `$app.dao()` breaks atomicity.
