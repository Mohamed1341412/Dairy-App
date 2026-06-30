# State Machines & Transition Rules

**Version:** v3.0  
**Purpose:** This document defines all allowed and forbidden state transitions for the core business entities. It does NOT include implementation details, idempotency, or ownership rules.

---

## 1. Sales Orders (`sales_orders`)

**States:** `draft`, `confirmed`, `processing`, `delivered`, `completed`, `cancelled`

**Allowed Transitions:**

| From | To | Condition | Notes |
|------|----|-----------|-------|
| `draft` | `confirmed` | Stock available | Reservations created, no transaction yet |
| `draft` | `cancelled` | No payments made | |
| `confirmed` | `processing` | Always allowed | |
| `confirmed` | `cancelled` | Not yet delivered | Release reservations |
| `processing` | `delivered` | Shipment created | **Revenue recognized here** (Transaction created, payment_status = unpaid) |
| `delivered` | `completed` | Payment fully received | Order closed |
| `processing` | `cancelled` | Not yet delivered | Reversal of transaction if created |
| `delivered` | `cancelled` | Admin override | Reversal movements + transaction |

**Forbidden Transitions:**
| From | To | Reason |
|------|----|--------|
| `confirmed` | `draft` | Once confirmed, cannot go back |
| `delivered` | `draft` | Already delivered |
| `cancelled` | Any | Final state |
| `completed` | Any | Final state |

---

## 2. Purchase Orders (`purchase_orders`)

**States:** `draft`, `confirmed`, `processing`, `delivered`, `completed`, `cancelled`

**Allowed Transitions:**

| From | To | Condition | Notes |
|------|----|-----------|-------|
| `draft` | `confirmed` | Supplier confirmation | |
| `draft` | `cancelled` | Before confirmation | |
| `confirmed` | `processing` | Supplier started | |
| `confirmed` | `cancelled` | Supplier agreed | |
| `processing` | `delivered` | Goods received | **Transaction created** (expense, payment_status = unpaid) |
| `delivered` | `completed` | Final payment | |
| `delivered` | `cancelled` | Return to supplier | Reversal movements + transaction |

**Forbidden:** Same logic as Sales.

---

## 3. Production Batches (`production_batches`)

**States:** `pending`, `in_progress`, `completed`, `cancelled`

**Allowed Transitions:**

| From | To | Condition | Notes |
|------|----|-----------|-------|
| `pending` | `in_progress` | Raw materials available | |
| `pending` | `cancelled` | Before start | |
| `in_progress` | `completed` | Quality pass | Consumes materials, produces products |
| `in_progress` | `cancelled` | Aborted | Return reserved materials |
| `completed` | `cancelled` | Admin override | Reverse all (rare) |

---

## 4. Payroll Records (`payroll_records`)

**States:** `draft`, `approved`, `paid`, `cancelled`

**Allowed Transitions:**

| From | To | Condition | Notes |
|------|----|-----------|-------|
| `draft` | `approved` | Manager approval | **Transaction created** (payment_status = unpaid) |
| `draft` | `cancelled` | Before approval | |
| `approved` | `paid` | Payment processed | |
| `approved` | `cancelled` | Before payment | Reverse transaction |
| `paid` | `cancelled` | Admin override | Reverse (rare) |

---

## 5. Payments (`payments`)

**States:** `pending`, `confirmed`, `cancelled`

**Allowed Transitions:**

| From | To | Condition | Notes |
|------|----|-----------|-------|
| `pending` | `confirmed` | Bank/cash confirmation | Creates allocations, updates transaction.payment_status |
| `pending` | `cancelled` | Before confirmation | |
| `confirmed` | `cancelled` | Admin reversal | Reverse allocations |

---

## 6. Transactions (`transactions`)

**States:** `draft` (optional, only for payroll/manual expense), `posted`, `reversed`

**Rules:**
- Most transactions (`sale`, `purchase`) are created directly as `posted`.
- Only `payroll` or `manual expense` may use `draft` → `posted`.
- `posted` → `reversed` only via reversal.

---

## 7. Raw Milk Receiving (`raw_milk_receiving`)

**States:** `pending`, `approved`, `rejected`

**Allowed Transitions:**

| From | To | Condition | Notes |
|------|----|-----------|-------|
| `pending` | `approved` | Quality pass | Creates material movement (IN) + transaction |
| `pending` | `rejected` | Quality fail | No stock impact |

---

## 8. Stock Transfers (`stock_transfers`)

**States:** `pending`, `completed`, `cancelled`

---

## 9. Deliveries (`deliveries`)

**States:** `pending`, `in_progress`, `delivered`, `cancelled`

---

## 10. Expenses (`expenses`)

**States:** `draft`, `approved`, `paid`, `cancelled`

---

## 11. Equipment Maintenance (`equipment_maintenance`)

**States:** `planned`, `in_progress`, `completed`, `cancelled`

---

## 12. Equipment (`equipment`)

**States:** `active`, `maintenance`, `retired`

---

## 13. Cars (`cars`)

**States:** `active`, `maintenance`, `inactive`

---

## 14. Attendance (`attendance`)

**States:** `draft`, `locked`

**Allowed Transitions:**

| From | To | Condition | Notes |
|------|----|-----------|-------|
| `draft` | `locked` | Payroll approval | **Only locks attendance records for the same payroll period (month/year).** No other attendance records are affected. |

**Forbidden:**
- `locked` → `draft` (cannot unlock once locked, unless admin override).
- Any → `deleted`.

**Important:** When a payroll is approved, the system must lock **only** the attendance records belonging to that payroll period (e.g., May 2026). Attendance for future months (e.g., June 2026) must remain editable.