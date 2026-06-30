# Event & Side Effects Matrix

**Purpose:** Defines which hook triggers which side effects for each business event.

---

| Event | Trigger | Owner Hook | Side Effects |
|-------|---------|------------|--------------|
| **Sales Confirm** | `sales_orders.status` → `confirmed` | `sales_hooks.pb.js` | Update `products.reserved_stock` (increase)
                                                                                  Update `products.available_stock` (decrease) |
																				  
| **Sales Deliver** | `sales_orders.status` → `delivered` | `sales_hooks.pb.js` | Create `inventory_movements` (OUT)
																				  Create `transaction` (income)
																				  Update `products.reserved_stock` (decrease)
																				  Update `products.available_stock` (increase) |
																				  
| **Sales Cancel (confirmed)** | `sales_orders.status` → `cancelled` | `sales_hooks.pb.js` | Release reservations |
| **Sales Cancel (delivered)** | `sales_orders.status` → `cancelled` (admin) | `sales_hooks.pb.js` | Create reversal `inventory_movements` (IN) <br> Create reversal `transaction` |
| **Sales Cancel** | `sales_orders.status` → `cancelled` | `sales_hooks.pb.js` | Reverse the above stock updates (decrease reserved, increase available) |
| **Purchase Deliver** | `purchase_orders.status` → `delivered` | `purchase_hooks.pb.js` | Create `material_movements` (IN) <br> Create `transaction` (expense, payment_status = unpaid) |
| **Purchase Cancel** | `purchase_orders.status` → `cancelled` | `purchase_hooks.pb.js` | Reversal movements + reversal transaction |
| **Production Complete** | `production_batches.status` → `completed` | `production_hooks.pb.js` | Create `material_movements` (OUT) <br> Create `product_batches` <br> Create `inventory_movements` (IN) |
| **Payment Confirm** | `payments.status` → `confirmed` | `payment_hooks.pb.js` | Create `payment_allocations` <br> Update `transactions.payment_status` <br> Update `remaining_amount` |
| **Payroll Approve** | `payroll_records.status` → `approved` | `payroll_hooks.pb.js` | Create `transaction` (payroll expense, payment_status = unpaid) |
| **Raw Milk Approve** | `raw_milk_receiving.status` → `approved` | `raw_milk_hooks.pb.js` | Create `material_movements` (IN) <br> Create `transaction` (expense) |
| **Transaction Created** | `transactions` created | `finance_hooks.pb.js` | Create `client_ledgers` <br> Create `vendor_ledgers` <br> Create `financial_account_ledgers` |
| **Inventory Movement** | `inventory_movements` created | `inventory_hooks.pb.js` | Update `products.current_stock` <br> Update `product_batches.quantity_remaining` |
| **Material Movement** | `material_movements` created | `material_hooks.pb.js` | Update `materials.current_stock` |

**Golden Rule:** Only inventory_hooks may modify current_stock.
				 sales_hooks may modify reserved_stock and available_stock. 