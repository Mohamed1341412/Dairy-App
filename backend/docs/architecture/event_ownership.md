# Event Ownership Hierarchy

**Purpose:** Defines the strict flow of business events and who is allowed to create what.

---
UI / Flutter
↓
State Machine Hook (validates transition, creates orchestrator events)
↓
Business Engine (StockService, LedgerEngine) – executes core logic
↓
Transaction Engine (finance_hooks) – creates all ledgers
↓
Audit Engine (AuditService) – logs to activity_logs


## Must NOT Rules

| Violation | Reason |
|-----------|--------|
| ❌ UI → Ledger | Flutter must never update ledgers directly |
| ❌ Sales → Ledger | Sales hooks must never create ledgers |
| ❌ Purchase → Ledger | Purchase hooks must never create ledgers |
| ❌ Production → Ledger | Production hooks must never create ledgers |
| ❌ Sales → Current_Stock | Sales hooks must never modify `current_stock` directly |
| ❌ Purchase → Current_Stock | Purchase hooks must never modify stock directly |
| ❌ Production → Current_Stock | Production hooks must never modify stock directly |

**Allowed:** Only `finance_hooks` may create ledgers. Only `inventory_hooks`/`material_hooks` may update stock.