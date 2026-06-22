# ADR-002: Soft Delete Only (is_archived)

## Status
**Accepted** (MVP)

## Context
Records such as products, clients, vendors, workers, cars, and equipment should not be physically deleted because they are referenced by historical transactions (sales, purchases, payroll).

## Decision
Implement soft delete using an `is_archived` boolean field. Physical deletion is prohibited by hooks.

## Consequences
- Queries must filter `is_archived = false` by default.
- UI must provide option to show archived records.
- No foreign key violations.
- Database size grows, but acceptable.

## Alternative Considered
- Physical deletion with cascade – rejected due to loss of audit trail.