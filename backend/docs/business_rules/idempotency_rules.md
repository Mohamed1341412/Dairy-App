# Idempotency Rules

**Purpose:** Ensure that business events (confirm, deliver, complete, etc.) execute only once, even if triggered multiple times (e.g., double-click, retry).

---

## Idempotency Keys

| Event Type                   | Key                                   | Check Before Execution                                           |
| ---------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| **Sales Confirm**            | `sales_order_id` + `event:confirm`    | If `products.reserved_stock` already includes this order → abort |
| **Sales Deliver**            | `sales_order_id` + `event:deliver`    | If `inventory_movements` exists for this order → abort           |
| **Sales Cancel (confirmed)** | `sales_order_id` + `event:cancel`     | If reservations already released → abort                         |
| **Sales Cancel (delivered)** | `sales_order_id` + `event:cancel`     | If reversal transaction exists → abort                           |
| **Purchase Deliver**         | `purchase_order_id` + `event:deliver` | If `material_movements` exists → abort                           |
| **Production Complete**      | `production_batch_id`                 | If `inventory_movements` exists → abort                          |
| **Payment Confirm**          | `payment_id`                          | If `payment_allocations` exists → abort                          |
| **Payroll Approve**          | `payroll_record_id`                   | If `transaction` exists → abort                                  |
| **Raw Milk Approve**         | `raw_milk_receiving_id`               | If `material_movements` exists → abort                           |

**Implementation Rule:**

    ## MVP Idempotency Strategy

    For MVP, idempotency for state transitions (like Sales Confirm, Purchase Deliver) is enforced by the **State Machine**.
    Hooks are triggered by `onRecordAfterUpdateRequest` only when `oldStatus` transitions to `newStatus`.
    If a request is retried, the status is already updated, so the hook will not execute again.

    The `event_key` / unique constraint pattern described below is reserved for **v2**,
    when we implement dedicated event tables (like `inventory_reservations` or an `events` log).

    Hooks MUST NOT perform a `SELECT` to check existence before `INSERT`.
    Instead, the hook should:

    1- Set the `event_key` on the new record.

    2- Attempt the `INSERT` directly.

    3- Catch the unique constraint violation error (e.g., `sql: duplicate key` or PocketBase's `Dao` error).

    4- If a duplicate key error occurs, treat the operation as successful (no-op) and return gracefully.

    This approach is fully idempotent and safe under concurrent requests (race condition free).
