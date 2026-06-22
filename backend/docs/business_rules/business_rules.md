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