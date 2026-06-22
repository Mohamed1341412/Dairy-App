# ADR-005: Role-Based Access Control (RBAC)

## Status
**Accepted** (MVP)

## Context
Sensitive financial data (profit, payroll, expenses) must be protected. Not all employees should see everything.

## Decision
Three roles: `super_admin`, `admin`, `employee`. Permissions enforced via PocketBase API rules and UI logic.

## Consequences
- Clear separation of duties.
- Easier to implement than full ACL.

## Alternative Considered
- Fine-grained permissions per module – too complex for MVP.