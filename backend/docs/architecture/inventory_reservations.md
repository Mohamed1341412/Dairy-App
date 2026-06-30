# Inventory Reservations Design

**Purpose:** Centralizes the management of reserved stock to avoid multiple hooks modifying `reserved_stock` directly.

---

## Problem
Multiple hooks (sales, transfers, production) were previously modifying `products.reserved_stock` directly, leading to inconsistencies.

## Solution ( future )
Create a dedicated `inventory_reservations` collection.

**Schema:**
- `id` (autogenerate)
- `sales_order_id` (relation to `sales_orders`)
- `product_id` (relation to `products`)
- `batch_id` (relation to `product_batches`, optional)
- `quantity` (number)
- `reserved_at` (date, auto)
- `status` (select: `active`, `consumed`, `cancelled`)

**Flow:**
1. `sales_hooks` creates a reservation record when `sales_orders.status` → `confirmed`.
2. `sales_hooks` updates status to `consumed` when `sales_orders.status` → `delivered` (movement created).
3. `sales_hooks` updates status to `cancelled` when `sales_orders.status` → `cancelled` (before delivery).
4. `StockService` calculates `reserved_stock = SUM(quantity WHERE status = 'active')` and computes `available_stock = current_stock - reserved_stock`.

**Only `StockService` may write to `products.reserved_stock` and `products.available_stock`.** No other hook may touch these fields.