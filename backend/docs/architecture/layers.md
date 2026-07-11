# System Architecture Layers

## Layer Diagram

┌─────────────────────────────────────────┐
│ Presentation Layer (Flutter) │
│ - UI Components │
│ - State Management │
│ - Offline Storage │
└─────────────────────────────────────────┘
↓
┌─────────────────────────────────────────┐
│ PocketBase API Layer │
│ - REST API │
│ - Authentication │
│ - Realtime (SSE) │
└─────────────────────────────────────────┘
↓
┌─────────────────────────────────────────┐
│ Business Hooks Layer │
│ - Lifecycle Orchestration │
│ - Status Transitions │
│ - Side Effects Coordination │
│ - Validation │
└─────────────────────────────────────────┘
↓
┌─────────────────────────────────────────┐
│ Services Layer │
│ - Business Operations │
│ - Domain Logic │
│ - Calculations │
└─────────────────────────────────────────┘
↓
┌─────────────────────────────────────────┐
│ DAO Layer (e.dao) │
│ - Transaction-scoped Operations │
│ - Atomicity │
│ - Rollback Support │
└─────────────────────────────────────────┘
↓
┌─────────────────────────────────────────┐
│ Database Layer (SQLite) │
│ - Persistent Storage │
│ - Indexes │
│ - Constraints │
└─────────────────────────────────────────┘

## Responsibility Matrix

| Layer        | Owns                              | Does NOT Own                 |
| ------------ | --------------------------------- | ---------------------------- |
| **Hooks**    | Orchestration, Validation, Audit  | Business Logic, Calculations |
| **Services** | Business Operations, Domain Logic | Persistence, Transactions    |
| **DAO**      | Atomicity, Rollback               | Business Rules               |
| **Database** | Storage, Constraints              | Business Logic               |
