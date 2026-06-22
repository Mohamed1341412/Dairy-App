# System Overview – Dairy ERP

## Purpose
The Dairy ERP system is a complete offline-first business management solution for a medium-sized dairy production facility. It handles raw milk receiving, material inventory, production batches, finished goods, sales (cash/credit), purchases, payroll, vehicle management, equipment maintenance, and financial accounting.

## Core Flow
Vendors (Raw milk, materials)
↓
Raw Milk Receiving / Purchase Orders
↓
Inventory (Materials: raw, packaging, consumable)
↓
Production Batches (consumption → outputs)
↓
Finished Products (with batch tracking & expiry)
↓
Sales Orders (cash or credit)
↓
Payments & Client Ledgers
↓
Financial Transactions & Reports


## Supporting Modules
- Workers & Attendance
- Payroll
- Cars & Deliveries
- Equipment & Maintenance
- Expenses (operational)
- Analytics & Notifications

## Key Architectural Principles
- **Offline-first**: All clients (Flutter) work offline; sync manually via local Wi-Fi.
- **Single source of truth**: PocketBase on a local desktop.
- **Immutable financial records**: No updates or deletions; corrections via reversal transactions.
- **Incremental stock engine**: Stock levels updated by movements, no full recalc in MVP.
- **Audit trail**: Every critical action logged.

## Deployment
- One desktop computer running PocketBase (Windows/Linux).
- 2-3 mobile devices (Android/iOS) and optional desktop clients (Windows/Linux) connected via same router.
- No internet required after initial setup.