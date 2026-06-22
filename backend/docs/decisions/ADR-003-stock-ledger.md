# ADR-003: Stock Ledger Architecture

## Status
**Accepted** (MVP)

## Context
Stock levels must be reliable and auditable. Direct editing of stock fields can cause inconsistencies.

## Decision
Stock levels are **derived from movement tables** (`inventory_movements` and `material_movements`). The fields `current_stock`, `reserved_stock`, and `available_stock` are **cached projections** updated incrementally by `StockService`.

## Consequences
- Source of truth is the movement tables.
- Cached fields are only for fast reads.
- Hooks block direct HTTP updates to stock fields.

## Alternatives Considered
- Full recalculation on every read – too slow for large history.
- Event sourcing with projections – overkill for MVP.

## Future Consideration
- A stock rebuild utility may be added in future versions to regenerate cached stock fields from movement history.