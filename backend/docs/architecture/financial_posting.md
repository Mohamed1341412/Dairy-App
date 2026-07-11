# Financial Posting Architecture

**Purpose:** Ensures that all financial records (transactions, ledgers) are created consistently through a central engine.

---

## Rule

- `sales_hooks`, `purchase_hooks`, `payroll_hooks`, `expense_hooks`, etc. may **ONLY** create `transactions`.
- They must **NEVER** create `client_ledgers`, `vendor_ledgers`, or `financial_account_ledgers` directly.
- `LedgerProjectionService` is the **sole owner** of ledger creation.
- `finance_hooks` MUST be idempotent.
- All generated ledgers must inherit the originating transaction `event_key`.

## Flow

Any Domain Hook (Sales, Purchase, Payroll, etc.)
↓
Open Transaction (runInTransaction)
↓

1. Create Transaction record (with party_type, amount, direction, reference)
2. Call LedgerProjectionService.projectTransaction(txDao, transaction)
   ├── LedgerProjectionService creates client_ledgers / vendor_ledgers / worker_ledgers
   ├── LedgerProjectionService creates financial_account_ledgers (if affects_cashflow = true)
   └── LedgerProjectionService updates cached_balance in clients/vendors/workers/financial_accounts
3. Commit Transaction

## `transaction` Status Rules

- Most transactions (`sale`, `purchase`) are created as `posted` directly.
- `payroll` and `manual expense` may use `draft` initially, then transition to `posted` on approval.

## Payment Status

- `transactions.payment_status` is managed **only** by `payment_hooks` when payments are confirmed.
- Values: `unpaid`, `partial`, `paid`.
