# ADR-011: Immutability After Posting

## Status
**Accepted** (MVP)

## Context
Once a financial transaction is recorded (posted), it must never be changed. This applies to `transactions`, `payments`, and all ledgers.

## Decision
- `transactions` and `payments` are **append-only** – no updates, no deletes.
- Ledgers are also append-only.
- Corrections only through reversal transactions.

## Enforcement
- `immutabilityGuard` in hooks blocks any UPDATE or DELETE on these collections, even for `super_admin`.

## Consequences
- No accidental data corruption.
- Users must be trained to use reversals.
- Historical reports remain accurate.

## Alternative Considered
- Soft delete with status – rejected because it still allows modification before deletion.
- Periodic snapshot + rollback – too complex.