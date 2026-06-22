# ADR-004: Central Transaction Engine

## Status
**Accepted** (MVP)

## Context
Multiple modules (sales, purchases, payroll, expenses) create financial events. Without centralisation, financial reporting becomes fragmented.

## Decision
All financial events must be recorded in a single `transactions` collection. Each module is responsible for creating the appropriate transaction record.

## Consequences
- Single source of truth for financial data.
- Easier to build reports and ledgers.
- Requires discipline from developers.

## Alternative Considered
- Separate financial tables per module – rejected due to reporting complexity.