# Inventory Engine

## Source of Truth
- **For finished products**: `inventory_movements`
- **For raw/packaging materials**: `material_movements`

No other table is considered source of truth for stock levels.

## Movement Types (Finished Products)
| Type | Direction | Description |
|------|-----------|-------------|
| `production` | `in` | Output from production batch |
| `sale` | `out` | Sold to customer |
| `return` | `in` | Customer return |
| `adjustment` | `in` or `out` | Manual correction (inventory count) |
| `waste` | `out` | Spoilage, expiry, damage |

## Movement Types (Materials)
Defined in `material_movements.movement_type`:
- `purchase` (`in`)
- `production_consumption` (`out`)
- `adjustment` (`in`/`out`)
- `waste` (`out`)

## Stock Calculation
**Incremental updates** (MVP):
- On every `inventory_movements` creation, `StockService.incrementalUpdate()` adds/subtracts quantity to/from `products.current_stock`.
- `available_stock` = `current_stock - reserved_stock` (reserved_stock updated by order confirmations – future enhancement).

**No full recalculation** in MVP. A maintenance utility may be added later.

## Validation Rules
- Quantity > 0.
- Movement type must be one of the predefined values.
- Direction must match the type (e.g., `sale` requires `out`).
- Negative stock prevented: before an `out` movement, `validateNegativeStock` checks `available_stock`.

## Cached Stock Fields
- `products.current_stock`, `products.available_stock`
- `materials.current_stock`, `materials.available_stock`
These are updated automatically by hooks. **Never edit them directly.**
Cached stock fields can be rebuilt from movement history if corruption is detected or a future maintenance utility is introduced.