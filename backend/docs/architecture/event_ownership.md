# Event Ownership Hierarchy

**Purpose:** Defines the strict flow of business events and who is allowed to create what.

---

UI / Flutter
↓
Domain Hooks (sales_hooks, purchase_hooks, etc.)
↓
├── Open Transaction (runInTransaction)
├── Create Source Records (movements, transactions)
├── Call Services (StockService, LedgerService)
└── Commit Transaction
↓
Services (StockService, LedgerService, PaymentAllocationService)
↓
├── Update Projections (stock, balances, ledgers)
└── Maintain Data Integrity
↓
Audit Engine (AuditService)
↓
└── Log to activity_logs

---

## Service Responsibilities

### StockService

**Owns:**

- `products.current_stock`
- `products.available_stock`
- `products.reserved_stock`
- `product_batches.quantity_remaining`

**Methods:**

- `applyMovement()` - Updates stock from inventory movements
- `reserveStock()` - Reserves stock for sales orders
- `releaseReservation()` - Releases reserved stock
- `ensureAvailableStock()` - Validates stock availability

**Called By:**

- Domain Hooks (inside their transactions)

---

### LedgerService

**Owns:**

- `clients.cached_balance`
- `vendors.cached_balance`
- `workers.cached_balance`
- `financial_accounts.cached_balance`
- All ledger records (client_ledgers, vendor_ledgers, etc.)

**Methods:**

- `projectTransaction()` - Creates ledger entries from transactions

**Called By:**

- Domain Hooks (inside their transactions)

---

### PaymentAllocationService

**Owns:**

- `transactions.payment_status`
- `transactions.paid_amount`
- `transactions.remaining_amount`

**Methods:**

- `allocatePayment()` - Links payments to transactions
- `refreshTransactionProjection()` - Updates payment projections

**Called By:**

- `payment_hooks` (inside transaction)

---

### MaterialService

**Owns:**

- `materials.current_stock`
- `materials.available_stock`
- `materials.reserved_stock`

**Methods:**

- `applyMovement()` - Updates material stock from material movements
- `reserve()` - Reserves materials for production batches
- `releaseReservation()` - Releases reserved materials
- `ensureAvailable()` - Validates material availability

**Called By:**

- Domain Hooks (inside their transactions)

---

## Hook Responsibilities

### Domain Hooks (Orchestrators)

**Examples:**

- `sales_hooks`
- `purchase_hooks`
- `production_hooks`
- `payroll_hooks`
- `expense_hooks`
- `payment_hooks`

**Responsibilities:**

1. Open transaction boundary (`runInTransaction`)
2. Create source-of-truth records:
   - `inventory_movements`
   - `material_movements`
   - `transactions`
   - `payments`
3. Call Services to update projections:
   - `StockService.applyMovement()`
   - `MaterialService.applyMovement()`
   - `LedgerService.projectTransaction()`
   - `PaymentAllocationService.allocatePayment()`
4. Coordinate multi-step

---

### Integrity Hooks (Guards)

**Examples:**

- `finance_hooks`
- `inventory_hooks`

**Responsibilities:**

1. **Validate data integrity**
   - Check field values
   - Enforce business rules

2. **Enforce immutability**
   - Prevent editing posted transactions
   - Prevent editing delivered orders

3. **Enforce append-only**
   - Prevent updating `inventory_movements`
   - Prevent deleting `transactions`

4. **Generate reference numbers**
   - `ReferenceNumberService.generate('TX')`
   - `ReferenceNumberService.generate('SO')`

5. **Log audit events**
   - Track critical operations
   - Record state changes

**Must NOT:**

- Execute business logic
- Update projections
- Create ledgers or movements

---

## Must NOT Rules

| Violation                            | Reason                                              |
| ------------------------------------ | --------------------------------------------------- |
| ❌ UI → Ledger                       | Flutter must never update ledgers directly          |
| ❌ UI → Stock                        | Flutter must never modify stock fields directly     |
| ❌ UI → Projections                  | Flutter must never update cached balances directly  |
| ❌ Domain Hooks → Direct Calculation | Hooks must call Services, not calculate projections |
| ❌ Integrity Hooks → Business Logic  | Guards must validate, not execute workflows         |
| ❌ Services → Open Transactions      | Services must receive dao from hooks                |
| ❌ finance_hooks → Create Ledgers    | finance_hooks only protects transactions            |
| ❌ inventory_hooks → Update Stock    | inventory_hooks only audits movements               |

---

**Transaction Boundaries**

Rule: Domain Hooks own transaction boundaries.
Why:
Ensures atomicity (all-or-nothing)
Prevents partial updates
Maintains data consistency
Example:
sales_hooks opens transaction
↓
├── Create movement
├── Update stock
├── Create transaction
├── Project ledgers
↓
Commit (all succeed) OR Rollback (any fails)

## Summary

| Component           | Role          | Example                            |
| ------------------- | ------------- | ---------------------------------- |
| **Domain Hooks**    | Orchestrators | `sales_hooks`, `purchase_hooks`    |
| **Integrity Hooks** | Guards        | `finance_hooks`, `inventory_hooks` |
| **Services**        | Executors     | `StockService`, `LedgerService`    |
| **UI**              | Consumer      | Flutter app                        |

**Flow** :

UI → Domain Hook → Service → Database
↓
Integrity Hook (validation)

## End of Document

```

```
