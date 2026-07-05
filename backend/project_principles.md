# Dairy ERP – Development Instructions

## Project Identity

This project is an Offline-First Dairy ERP System built using:

### Frontend

- Flutter 3.44+
- Dart 3.12+
- Material 3
- Bloc/Cubit State Management
- Drift Local Database
- PocketBase SDK

### Backend

- PocketBase
- SQLite
- JavaScript Hooks
- Local Network Deployment
- No Internet Dependency

The system is intended for real-world business operations, not for demonstration purposes.

All implementation decisions must prioritize:

1. Simplicity
2. Reliability
3. Auditability
4. Maintainability
5. Business correctness

---

# Fundamental Rule

Do not over-engineer.

When multiple valid solutions exist:

Choose the simplest solution that:

- Solves the current business requirement
- Remains maintainable
- Does not create technical debt
- Does not introduce unnecessary abstractions

Avoid building for hypothetical future requirements.

Build only what is currently needed.

---

# Architecture Philosophy

Follow pragmatic Clean Architecture.

Use Clean Architecture where it provides value.

Do NOT create layers, classes, wrappers, or abstractions that do not solve an actual problem.

Architecture exists to simplify development, not to satisfy theoretical purity.

---

# Flutter Architecture

Use Feature-First Structure.

Example:

lib/
├── core/
├── shared/
├── features/
│ ├── products/
│ ├── clients/
│ ├── vendors/
│ ├── inventory/
│ ├── sales/
│ ├── purchases/
│ ├── workers/
│ ├── payroll/
│ ├── expenses/
│ ├── analytics/
│ └── settings/

Inside each feature:

feature/
├── data/
├── domain/
├── presentation/

---

# State Management Rules

Use Bloc/Cubit.

Default choice:

- Cubit

Use Bloc only when:

- Multiple event sources exist
- Complex workflows exist
- State transitions become difficult to manage inside Cubit

Never create Bloc simply because Bloc exists.

Prefer Cubit.

---

# State Design Rules

State must be:

- Immutable
- Equatable
- Small
- Explicit

Avoid:

- Massive state objects
- Deep nesting
- God States

Split responsibilities when needed.

---

# UI Rules

The application is a business tool.

UI priorities:

1. Speed
2. Clarity
3. Data density
4. Reliability

Not:

1. Fancy animations
2. Experimental UX
3. Visual gimmicks

Every extra click must be justified.

Every screen must optimize daily repetitive operations.

---

# Flutter Coding Standards

Prefer:

- StatelessWidget

Use StatefulWidget only when truly required.

Keep widgets small.

Extract reusable widgets only when reuse exists.

Avoid premature componentization.

Do not create a reusable widget after a single usage.

Rule of thumb:

Reuse ≥ 2 locations.

---

# Dependency Injection

Use GetIt.

Rules:

- Register once
- Keep dependency graph simple
- Avoid service locator abuse

No unnecessary repository wrappers.

No unnecessary facades.

No unnecessary managers.

---

# Routing

Use GoRouter.

Routing must:

- Be centralized
- Be typed where practical
- Support role protection

Avoid deeply nested route structures.

---

# Local Database

Use Drift.

Drift is the local source of truth on the device.

Responsibilities:

- Offline support
- Fast reads
- Local caching
- Sync staging

Avoid raw SQLite queries whenever possible.

Use Drift-generated APIs.

---

# Sync Philosophy

Current sync strategy:

Manual Sync.

Not automatic.

Do not introduce:

- Background Sync
- Event Streams
- Complex Conflict Engines

Unless explicitly requested.

Current principle:

Simple and reliable.

---

# Backend Philosophy

PocketBase is the central business authority.

PocketBase is the system source of truth.

Flutter must never bypass backend business rules.

All business-critical validation belongs to PocketBase Hooks.

Never trust frontend validation alone.

---

# PocketBase Rules

Business invariants belong in hooks.

Examples:

- Stock validation
- Negative stock prevention
- Lock protection
- Immutability protection
- Reversal rules
- Sync duplication protection

Frontend validates UX.

Backend validates truth.

---

# Financial System Rules

Financial records are immutable.

Never:

- Update transactions
- Update payments
- Update ledgers

Corrections must occur through reversal records.

Append-only design is mandatory.

Auditability is more important than convenience.

---

# Inventory Rules

Inventory movements are the source of truth.

Physical stock changes only through inventory movements.

Reservation changes only through StockService reservation methods.

Stock fields are cached projections.

Never edit directly:

- current_stock
- reserved_stock
- available_stock

StockService maintains all stock projections.

---

### Transaction Ownership

- Services never open transactions
- Domain hooks own transaction boundaries and coordinate services inside a single transaction
- Movement creation and projection updates happen atomically
- Either all operations succeed or all fail

### Append-Only Records

- `inventory_movements` are append-only (cannot be updated or deleted)
- `transactions` are append-only (corrections via reversals)
- `payment_allocations` are append-only

### Projection Rules

- Projections are never edited manually
- Only the designated service may update projections
- Projections can be rebuilt from source of truth records

---

# Deletion Rules

Default policy:

Soft Delete

Use:

is_archived

Do not physically delete operational records.

Historical references must remain intact.

---

# Locking Rules

Locked records are immutable.

If:

is_locked = true

Then:

- No updates
- No deletes

Must be enforced by backend hooks.

---

# Audit Rules

All critical operations must be traceable.

Important actions:

- Create
- Archive
- Restore
- Lock
- Reverse
- Blocked actions

Must generate audit logs.

Auditability is a first-class requirement.

---

# Error Handling

Never swallow exceptions.

Always:

- Log
- Categorize
- Surface meaningful messages

Avoid:

try {
} catch (\_) {}

Never ignore failures.

---

# Performance Rules

Optimize for simplicity first.

Only optimize after identifying a real bottleneck.

Avoid:

- Premature caching
- Premature optimization
- Complex state orchestration

Measure before optimizing.

---

# Naming Rules

Names must describe business meaning.

Prefer:

SalesOrder

ClientLedger

InventoryMovement

Avoid:

Manager

Helper

Util

Processor

Thing

DataObject

Names must communicate intent.

---

# Testing Philosophy

Prioritize testing:

1. Business rules
2. Financial calculations
3. Inventory calculations
4. Sync logic

UI testing is secondary.

Business correctness is primary.

---

# SOLID Rules

Apply SOLID pragmatically.

Do not create interfaces solely to satisfy SOLID.

Create abstractions only when:

- Multiple implementations exist
- Multiple implementations are expected soon

Avoid interface inflation.

---

# DRY Rule

Do not duplicate business logic.

However:

Prefer small duplication over harmful abstraction.

A little repetition is acceptable.

Bad abstraction is expensive.

---

# YAGNI Rule

You Aren't Gonna Need It.

Do not build:

- Plugin systems
- Generic frameworks
- Workflow engines
- Dynamic form builders
- Dynamic permission engines

Unless explicitly required.

---

# Preferred Development Approach

For every task:

1. Understand business requirement
2. Identify simplest solution
3. Verify compatibility with existing architecture
4. Implement cleanly
5. Keep code readable
6. Avoid unnecessary abstractions
7. Preserve auditability
8. Preserve offline-first behavior

---

# Code Generation Rule

Whenever generating code:

- Prefer readability over cleverness
- Prefer explicitness over magic
- Prefer maintainability over brevity
- Prefer business clarity over technical sophistication

Future developers must understand the code quickly.

---

# Final Principle

This project is a business operating system.

Every technical decision must improve:

- Business correctness
- Data integrity
- Reliability
- Maintainability

Reject solutions that increase complexity without providing proportional business value.
