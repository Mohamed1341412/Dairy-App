# ADR-007: Payment Direction Field

## Status
**Accepted** (MVP)

## Context
Payments can be incoming (from clients) or outgoing (to vendors/workers). Without explicit direction, reporting is ambiguous.

## Decision
Add a `direction` field to `payments` with values `in` (money received) or `out` (money paid).

## Consequences
- Simplifies cash flow queries.
- Reduces risk of misinterpretation.

## Alternative Considered
- Derive direction from party type (client = in, vendor = out) – less explicit, error-prone.