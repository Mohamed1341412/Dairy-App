# ADR-019: Ledger Is Projection

## Status

Accepted

## Context

In traditional accounting systems, ledger entries are created directly by business logic. This creates multiple sources of truth and makes reconciliation difficult.

## Decision

Ledger entries are **projections** derived from Transactions. They are never created directly by business hooks.

### Flow:

Transaction (Source of Truth)
↓
LedgerProjectionService (Projection Engine)
↓
Ledger Entries (Derived Data)

## Reason

1. **Single Source of Truth**: Transactions are the only source
2. **Consistency**: Ledger entries are always derived from transactions
3. **Reconciliation**: Easy to verify ledger against transactions
4. **Reversal**: Reversing a transaction automatically reverses ledger entries

## Consequences

### Positive:

- ✅ No duplicate ledger entries
- ✅ Easy to rebuild ledger from transactions
- ✅ Consistent debit/credit logic
- ✅ Automatic reversal handling

### Negative:

- ⚠️ Requires LedgerProjectionService for all transactions
- ⚠️ Cannot create ledger entries without transactions

## Implementation

### LedgerProjectionService Responsibilities:

1. Calculate debit/credit based on transaction type and direction
2. Apply reversal logic (swap debit/credit if `is_reversal = true`)
3. Update `cached_balance` on parties and accounts
4. Create ledger entries with `posting_sequence`

### Hooks Never:

- ❌ Create ledger entries directly
- ❌ Update `cached_balance` directly
- ❌ Calculate debit/credit

## Related ADRs

- ADR-008: Transaction Engine
- ADR-012: Ledger Projection Service
