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

**Example Flow (Sales Delivery):**

```javascript
onRecordAfterUpdateRequest((e) => {
    if (status changed to 'delivered') {
        $app.dao().runInTransaction((txDao) => {
            // 1. Create inventory movements
            for (item of items) {
                movement = createMovement(item);
                txDao.saveRecord(movement);

                // 2. Update stock projections
                StockService.applyMovement(txDao, movement);
            }

            // 3. Create financial transaction
            transaction = createTransaction(order);
            txDao.saveRecord(transaction);

            // 4. Project to ledgers
            LedgerService.projectTransaction(txDao, transaction);
        });
    }
});

---

### Example Flow (Purchase Receipt):

``javascript
onRecordBeforeUpdateRequest((e) => {
     if (status changed from 'draft' to 'received') {
         // All operations happen in same transaction (BeforeUpdate)

         // 1. Create movements for each item
         for (item of items) {
             if (item.line_type === 'product') {
                 movement = createInventoryMovement(item);
                 $app.dao().saveRecord(movement);
                 StockService.applyMovement($app.dao(), movement);
             } else if (item.line_type === 'material') {
                 movement = createMaterialMovement(item);
                 $app.dao().saveRecord(movement);
                 MaterialService.applyMovement($app.dao(), movement);
             }
         }

         // 2. Create financial transaction
         transaction = createTransaction(order);
         $app.dao().saveRecord(transaction);

         // 3. Project to ledgers
         LedgerService.projectTransaction($app.dao(), transaction, 'payable');
     }
 });


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

Example (finance_hooks):

onRecordBeforeUpdateRequest((e) => {
    // Prevent editing posted transactions
    if (e.oldRecord.get('status') === 'posted') {
        throw new Error("Posted transactions are immutable");
    }

    // Validate reversal rules
    if (e.record.get('is_reversal')) {
        validateReversal(e.record);
    }
});

---


## Must NOT Rules

| Violation | Reason |
|-----------|--------|
| ❌ UI → Ledger | Flutter must never update ledgers directly |
| ❌ UI → Stock  | Flutter must never modify stock fields directly |
| ❌ UI → Projections | Flutter must never update cached balances directly |
| ❌ Domain Hooks → Direct Calculation | Hooks must call Services, not calculate projections |
| ❌ Integrity Hooks → Business Logic | Guards must validate, not execute workflows |
| ❌ Services → Open Transactions | Services must receive dao from hooks |
| ❌ finance_hooks → Create Ledgers | finance_hooks only protects transactions |
| ❌ inventory_hooks → Update Stock | inventory_hooks only audits movements |

---

**Allowed Patterns**
- Pattern 1: Domain Hook with Services :

// sales_hooks.pb.js
onRecordAfterUpdateRequest((e) => {
    $app.dao().runInTransaction((txDao) => {
        // Create movement
        movement = createMovement(...);
        txDao.saveRecord(movement);

        // Update stock via Service
        StockService.applyMovement(txDao, movement);

        // Create transaction
        transaction = createTransaction(...);
        txDao.saveRecord(transaction);

        // Project to ledgers via Service
        LedgerService.projectTransaction(txDao, transaction);
    });
});
---

- Pattern 2: Integrity Hook Validation:

// inventory_hooks.pb.js
onRecordBeforeUpdateRequest((e) => {
    // Prevent modification
    throw new Error("inventory_movements are append-only");
});

onRecordAfterCreateRequest((e) => {
    // Audit only
    AuditService.log(...);
});
---

- Pattern 3: Service Method:

// stock_service.pb.js
applyMovement: function(dao, movement) {
    // Update projections
    product = dao.findRecordById('products', productId);
    product.set('current_stock', newStock);
    product.set('available_stock', newStock - reserved);
    dao.saveRecord(product);
}
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

| Component | Role | Example |
|-----------|------|---------|
| **Domain Hooks** | Orchestrators | `sales_hooks`, `purchase_hooks` |
| **Integrity Hooks** | Guards | `finance_hooks`, `inventory_hooks` |
| **Services** | Executors | `StockService`, `LedgerService` |
| **UI** | Consumer | Flutter app |


**Flow** :

UI → Domain Hook → Service → Database
              ↓
         Integrity Hook (validation)

## End of Document


```
