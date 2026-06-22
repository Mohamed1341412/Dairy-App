# Database Architecture

## Design Pattern
**Event-Driven Ledger Architecture** – core business facts (movements, transactions) are immutable; derived values (stock, balances) are cached.

## Core Collections

### Financial
| Collection | Purpose | Mutability |
|------------|---------|------------|
| `transactions` | Every financial movement (sale, purchase, salary, expense, reversal) | Immutable (append-only) |
| `payments` | Cash/bank/credit payments | Immutable (append-only) |
| `client_ledgers` | Client balance history | Immutable |
| `vendor_ledgers` | Vendor balance history | Immutable |
| `financial_account_ledgers` | Cash/bank account balance history | Immutable |

### Inventory
| Collection | Purpose | Mutability |
|------------|---------|------------|
| `inventory_movements` | Stock changes for finished products | Immutable |
| `material_movements` | Stock changes for raw/packaging materials | Immutable |
| `product_batches` | Production batches with expiry and cost | Immutable:
- production_quantity
- unit_cost
- total_cost
- manufacture_date
- expiry_date

Mutable:
- quantity_remaining
- status |

### Operational
| Collection | Purpose | Mutability |
|------------|---------|------------|
| `products` | Finished goods | Soft delete (`is_archived`) |
| `materials` | Raw materials, packaging, consumables | Soft delete |
| `sales_orders`, `purchase_orders` | Customer/supplier orders | Lockable (`is_locked`) |
| `workers`, `attendance`, `payroll_records` | HR | Lockable for payroll |

## Data Integrity Rules
- **No direct stock editing**: `current_stock` and `available_stock` are updated only by `StockService`.
- **Stock is derived from movements**: `inventory_movements` and `material_movements` are the source of truth.
- **Financial balances are derived from `transactions` and `payments`**: `cached_balance` fields are just caches.
- **Soft delete only**: Physical deletion is blocked for all operational records.

## Indexes
Important indexes:
- `idx_transactions_number` (unique), `idx_transactions_date`
- `idx_inventory_product`, `idx_inventory_batch`
- `idx_material_movements_material`
- `idx_sales_orders_client`, `idx_sales_orders_date`
- `idx_purchase_orders_vendor`
- `idx_worker_date_shift` (attendance)