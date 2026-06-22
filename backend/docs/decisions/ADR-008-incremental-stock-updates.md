# ADR-008: Incremental Stock Updates (Instead of Versioning)

## Status
**Accepted** (MVP)

## Context
Initial plan included `stock_version` and `last_stock_calculated_at` for concurrency control and debugging. However, for MVP scale (3 devices, manual sync), this is over-engineering.

## Decision
Use **incremental stock updates** only. Stock fields (`current_stock`, `available_stock`) are updated immediately after each movement by adding/subtracting quantity. No versioning or full recalculation.

## Alternatives Considered
- **Stock versioning** – rejected for MVP (would add complexity without immediate benefit).
- **Full recalculation on every read** – rejected for performance.
- **Event sourcing with rebuild** – too heavy.

## Consequences
- Simpler code and fewer fields.
- Potential for drift if a movement is lost (but movements are immutable).
- Future: add rebuild utility if needed.