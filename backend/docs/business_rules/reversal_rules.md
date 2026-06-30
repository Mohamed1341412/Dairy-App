# Reversal Rules (Audit-Safe Corrections)

**Version:** v1.0  
**Purpose:** Defines the immutable, append-only pattern for correcting financial and inventory errors. No record is ever edited or deleted.

---

## Core Principles

1. **Immutability:** Original records (`transactions`, `inventory_movements`, `payments`, `ledgers`) are **never modified**.
2. **No Deletion:** Financial and inventory records are **never physically deleted**.
3. **New Record:** A correction is always a **new record** that cancels out the original.
4. **Net Zero Effect:** The original + reversal must sum to **zero** (or opposite effect for inventory).
5. **Traceability:** Every reversal links back to the original record.

---

## Reversal Metadata (Fields to use)

### On the Original Record:
- `reversed_by` (relation to the reversal record) – optional, but recommended.
- `status` → `reversed` (if applicable).

### On the Reversal Record:
- `reversal_of` (relation to the original record) – **required**.
- `amount` / `quantity` = **same as** original quantity (always positive)
- `direction` (required) = **opposite direction** of the original.

---

## Reversal Flows

### 1. Financial Reversal (`transactions`)

**Rules:**
- The reversal transaction must have:
  - `amount` = **same as** original amount (always positive).
  - `direction` = **opposite** of original direction (e.g., `in` → `out`).
  - `reversal_of` = `id` of the original transaction.
- `finance_hooks` will automatically:
  - Create a **reversal ledger entry** (opposite debit/credit).
  - Update `cached_balance` by subtracting/adding the amount.

**Example:**
- Original: Sale for `500`, `direction = in` (Client pays, cash increases).
- Reversal: Transaction for `500`, `direction = out` (Client is refunded, cash decreases).

### 2. Inventory Reversal (`inventory_movements`)

**Rules:**
- The reversal movement must have:
  - `quantity` = **same as** original quantity (always positive).
  - `direction` = **opposite** of original direction (e.g., `out` → `in`).
  - `reference_type` = `reversal`.
  - `reference_id` = `id` of the original movement.
- `inventory_hooks` will automatically:
  - Update `products.current_stock` (revert the change).
  - Update `product_batches.quantity_remaining` (if applicable).

**Example:**
- Original: Sale = `10 units`, `direction = out`.
- Reversal: Inventory Movement = `10 units`, `direction = in`.

### 3. Payment Allocation Reversal (`payment_allocations`)

**Rules:**
- A new allocation is created with the **same** `allocated_amount` but **opposite effect** (handled by linking to a reversal transaction).
- `payment_hooks` updates:
  - `transactions.payment_status` back to `unpaid` or `partial`.
  - `remaining_amount` increased by the allocated amount.

---
**Note:** Using `direction` as the sole indicator of reversal effect eliminates ambiguity and prevents double-counting errors.

---

## Must NOT Rules

| Violation | Why it's forbidden |
|-----------|-------------------|
| ❌ Editing original transaction | Breaks audit trail and immutability |
| ❌ Deleting original movement | Loses historical record |
| ❌ Reversing a reversal | Creates confusing chains (unless absolutely required, admin only) |
| ❌ Partial reversal of only one item | The entire financial event (order, batch) must be reversed as a whole, or split items but each with their own reversal reference |

---

## Idempotency & Reversal Safety

Just like regular events, **reversals must be idempotent**.
- Use the same `event_key` pattern (e.g., `sales_order:123:delivered:cancel`).
- A duplicate reversal attempt will be blocked by the unique index on `event_key`.

---

## When to Use Reversal vs Direct Status Change

| Scenario | Action |
|----------|--------|
| **Draft order cancelled** | ✅ Direct status change (`draft` → `cancelled`). No financial records exist yet. |
| **Confirmed order cancelled** | ✅ Update `reserved_stock`. No financial records exist yet. |
| **Delivered order cancelled** | ✅ **Create Reversal** (Transaction + Inventory Movement). |
| **Paid order cancelled** | ✅ **Create Reversal** + Refund payment (or separate refund transaction). |
| **Payroll approved** (mistake) | ✅ **Create Reversal** for the payroll transaction. |