# **ADR-017: Append-Only Inventory Corrections**

## **Status**

Accepted

## **Context**

In the Dairy ERP system, inventory_movements are strictly append-only and serve as the Source of Truth for stock projections.  
When a mistake occurs during an inventory operation (e.g., recording a sale of 50 units instead of 45), the system must correct the error without violating the append-only rule. We need a standardized, traceable way to handle inventory corrections that does not involve editing or deleting original movement records.  
Unlike financial transactions (which use strict 1:1 reversal records via reversal_of), inventory corrections often involve adjusting a _difference_ in quantity rather than reversing the entire original movement.

## **Decision**

We will correct inventory errors by creating a **new adjustment movement** that explicitly links back to the original movement using the corrects_movement_id field.

### **Correction Rules:**

1. **Never modify or delete** the original inventory_movement.
2. The correction movement must have:
   - movement_type \= 'adjustment'
   - direction \= opposite of the original (if correcting the full amount) OR the appropriate direction to fix the difference.
   - quantity \= the exact quantity needed to fix the error (the difference).
   - corrects_movement_id \= the id of the original movement.
3. **No Correction Chains:** A correction movement (movement_type \= 'adjustment') cannot itself be corrected. If an adjustment is wrong, a new adjustment must correct the original movement.
4. **Same Product:** The correction movement must reference the same product_id as the original.

### **Database Enforcement:**

A Partial Unique Index is applied to corrects_movement_id in the inventory_movements collection:

SQL  
CREATE UNIQUE INDEX idx_inventory_movements_corrects  
ON inventory_movements (corrects_movement_id)  
WHERE corrects_movement_id \!= ''

This guarantees at the database level that an original movement can only be corrected once.

## **Example Scenario**

**The Error:**  
Movement \#100 is created: product: Yogurt, direction: out, quantity: 50, movement_type: sale.  
_Correction needed:_ The actual quantity sold was 45\.  
**The Fix:**  
Movement \#101 is created:

- product: Yogurt
- direction: in (Putting 5 units back)
- quantity: 5 (The difference)
- movement_type: adjustment
- corrects_movement_id: \#100

**Result:**

- StockService.applyMovement() processes Movement \#101, adding 5 units back to products.current_stock.
- Movement \#100 remains untouched in the database (preserving history).
- The audit trail clearly shows Movement \#101 was an adjustment for Movement \#100.

## **Consequences**

### **Positive:**

- **Traceability:** Every correction is explicitly linked to its original movement.
- **Immutability:** Original records are never altered, preserving a perfect audit trail.
- **Simplicity:** Avoids the complexity of full financial-style reversal chains for inventory.
- **Flexibility:** The adjustment type can also be used for inventory counts, damage write-offs, or spontaneous stock discoveries, not just corrections.
- **Data Integrity:** The Partial Unique Index prevents duplicate corrections at the database level.

### **Negative:**

- Requires developers to remember that inventory corrections use corrects_movement_id \+ adjustment, while financial corrections use reversal_of \+ is_reversal. (Mitigated by clear documentation and separate ADRs).

## **Alternatives Considered**

1. **Full Reversal \+ New Record:** Delete/Reverse the original 50 units, then create a new 45-unit sale. _Rejected: Breaks append-only rule and creates unnecessary record bloat._
2. **In-place Modification:** Edit the quantity of Movement \#100 directly. _Rejected: Destroys historical audit trail._
3. **Using notes field only:** Write "Correction for \#100" in the notes. _Rejected: Not programmatically queryable, prone to human error, and lacks database-level enforcement._
