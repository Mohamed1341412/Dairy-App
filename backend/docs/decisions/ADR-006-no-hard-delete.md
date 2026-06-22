# ADR-006: No Hard Deletion for Financial Records

## Status
**Accepted** (MVP)

## Context
Financial records (`transactions`, `payments`, ledgers, movements) must never be physically deleted to maintain audit integrity.

## Decision
Physical deletion is **completely prohibited** for these collections. Even `super_admin` cannot delete. The only way to correct errors is via reversal transactions.

## Consequences
- Database never loses financial history.
- More complex error correction (reversal).
- Hooks enforce this strictly.

## Alternative Considered
- Soft delete with `is_archived` for financial tables – rejected because it still allows marking as deleted, which may hide audit trail.