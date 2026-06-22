# Backend Architecture

## Platform
- **PocketBase** (Go binary, single executable)
- **Embedded SQLite** database (managed by PocketBase)
- **JavaScript Hooks** for business logic (`.pb.js` files)

## Layers
HTTP API (REST)
↓
PocketBase Core (Auth, Collections, Rules)
↓
Hooks (Validation, Immutability, Locking, Sync)
↓
Services (Stock, Reference Number, Audit/Event Logging)
↓
SQLite Database

## Key Components

### Collections (Tables)
- **Immutable (append-only)**: `transactions`, `payments`, `client_ledgers`, `vendor_ledgers`, `financial_account_ledgers`, `inventory_movements`, `material_movements`
- **Operational (soft delete via `is_archived`)**: `products`, `materials`, `clients`, `vendors`, `workers`, `cars`, `equipment`, `sales_orders`, `purchase_orders`, `payroll_records`
- **Supporting**: `units`, `stores`, `system_settings`, `notifications`, `analytics_cache`

### Hooks (enforce business invariants)
- `immutability_hooks`: Block UPDATE/DELETE on immutable collections.
- `inventory_hooks`: Prevent direct stock edits; validate movement type/direction; prevent negative stock.
- `finance_hooks`: Validate transaction direction; enforce reversal rules (single reversal, no chains).
- `locking_hooks`: Block updates/deletes when `is_locked = true` on orders and payroll.
- `sync_guard`: Reject duplicate `sync_id`.

### Services
- `stock_service`: Incremental stock update (`incrementalUpdate`) and negative stock validation.
- `reference_number_service`: Generate unique reference numbers (e.g., `TR-20260608-1234`).
- `audit_logger`: Log security events (blocked actions, permission changes) to PocketBase logger.
- `event_logger`: Log system events (stock updates, recalculations).

## Deployment
- Run `pocketbase serve` on desktop (port 8090).
- Clients connect to `http://<desktop-ip>:8090`.