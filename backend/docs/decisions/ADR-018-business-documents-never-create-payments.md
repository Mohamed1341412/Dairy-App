**المحتوى:**

```markdown
# ADR-018: Business Documents Never Create Payments

## Status

Accepted

## Context

In many ERP systems, business documents (Sales Orders, Purchase Orders, Expenses) directly trigger cash movements. This creates tight coupling between business events and financial transactions.

## Decision

Business documents **never** create cash movements. They only create financial obligations.

### Business Documents Create:

- Financial Obligations (Transactions with `affects_cashflow = false`)
- Ledger Entries (via LedgerProjectionService)
- Inventory Movements (for Sales/Purchase)

### Payment Module Creates:

- Cash Movements (Transactions with `affects_cashflow = true`)
- Payment Allocations (linking payments to obligations)

## Reason

Complete separation between:

1. **Business Event** (e.g., "We received goods")
2. **Financial Obligation** (e.g., "We owe the vendor $1000")
3. **Cash Movement** (e.g., "We paid $1000 from bank")

## Consequences

### Positive:

- ✅ Decoupled architecture
- ✅ Same payment can settle multiple obligations
- ✅ Easy to track unpaid obligations
- ✅ Supports partial payments
- ✅ Clear audit trail

### Negative:

- ⚠️ Requires explicit payment creation
- ⚠️ More steps in the workflow

## Examples

### Purchase Flow:

Purchase Received
↓
Create Transaction (affects_cashflow = false)
↓
Ledger Projection (Accounts Payable increases)
↓
[Later] Create Payment
↓
Payment Allocation (links payment to purchase transaction)
↓
Ledger Projection (Accounts Payable decreases, Bank decreases)

### Expense Flow:

Expense Approved
↓
Create Transaction (affects_cashflow = false)
↓
Ledger Projection (Expense increases, Liability increases)
↓
[Later] Create Payment
↓
Payment Allocation
↓
Ledger Projection (Liability decreases, Bank decreases)

## Related ADRs

- ADR-008: Transaction Engine
- ADR-012: Ledger Projection
- ADR-015: Payment Allocation
```
