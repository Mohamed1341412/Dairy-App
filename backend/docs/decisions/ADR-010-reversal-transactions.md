# ADR-010: Reversal Transactions for Error Correction

## Status
**Accepted** (MVP)

## Context
Financial records are immutable. Mistakes (wrong amount, wrong client, etc.) cannot be fixed by updating or deleting.

## Decision
Corrections are made by creating a **reversal transaction** (`is_reversal = true`, `reversal_of` points to the original). The reversal cancels out the original transaction (e.g., opposite direction, same amount).

## Rules Enforced by Hooks
- Original transaction must exist.
- Original must not already have a reversal.
- Cannot reverse a reversal.
- Reversal must have a valid `reversal_of` reference.

## Consequences
- Complete audit trail.
- More work for users to correct errors.
- Requires UI to support creating reversals.

## Alternative Considered
- Updating transactions in place – rejected (breaks audit).
- Negative entry without link – hard to trace.