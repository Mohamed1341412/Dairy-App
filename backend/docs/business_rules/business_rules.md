# Business Rules – Dairy ERP

## Financial Rules
- Ledgers are immutable.
- Financial movements are append-only.
- No direct balance editing (cached fields only).
- Corrections via reversal transactions only (single reversal, no chains).
- Every transaction must have a valid direction (`in` or `out`).

## Inventory Rules
- No direct stock editing (current_stock, reserved_stock, available_stock).
- Stock is derived from movement tables (`inventory_movements`, `material_movements`).
- Batch core fields (`quantity_remaining`, `unit_cost`, `total_cost`) are immutable.
- Negative stock is prevented.

## Lock Rules
- Locked records (`is_locked == true`) cannot be updated or deleted.
- Applies to: `sales_orders`, `purchase_orders`, `payroll_records`.

## Sync Rules
- `sync_id` must be unique across each collection.
- Duplicate `sync_id` blocks record creation.

## Audit Rules
- All critical actions (create, update, archive, restore) are logged.
- Blocked actions (immutability, lock, duplicate) are logged.
- Logs written to PocketBase internal logger.

## Archive vs Delete
- Physical deletion is prohibited for all operational and financial records.
- Use `is_archived` for operational entities (products, clients, vendors, workers, etc.).

## State Transition Rules
- State transitions must follow the approved state machine.
- Invalid status transitions are rejected.
- Completed and cancelled states are terminal unless explicitly reopened by an authorized process.

## Immutability Rules
- Immutable fields cannot be modified after record creation.
- Financial amounts become immutable once the record is locked.
- Inventory movement quantities become immutable after posting.

## Reversal Rules
- Reversals create compensating transactions.
- Original transactions are never modified.
- A transaction can only be reversed once.
- Reversal transactions cannot themselves be reversed.

## Ownership Rules
- Derived data must not be edited directly.
- Source collections own their business truth.
- Projections, ledgers, summaries and cached balances are read models only.

## Authorization Rules
- Only admins may archive or restore records.
- Only admins may unlock records.
- Sensitive financial data is restricted by role permissions.

## Idempotency Rules
- Repeated requests with the same idempotency key must produce the same result.
- Duplicate financial posting operations are rejected.