# Security Model

## Roles (PocketBase `role` field in `users`)
| Role | Permissions |
|------|-------------|
| `super_admin` | Full access to all data and settings, **except** cannot modify immutable financial records (enforced by hooks). Can bypass soft delete protection. |
| `admin` | Operational + financial access (create sales orders, view reports, manage workers), but cannot change system settings or bypass immutability. |
| `employee` | Operational only (create sales orders, view inventory, record attendance). No financial data access (transactions, ledgers, payments). |

## API Rules (PocketBase)
- List/view records: based on role (employees see only non-financial data).
- Create/update/delete: restricted by role and collection.
- For immutable collections, even `super_admin` cannot update/delete – enforced by hooks, not API rules.

## Sensitive Data
- Profit reports, expenses, payroll, client credit limits, vendor balances – visible only to `super_admin` and `admin`.
- Employee salaries – only `super_admin` can view/edit.

## Audit Logging
- Every blocked action (attempt to update immutable record, duplicate sync_id, locked record modification) is logged via `AuditLogger`.
- Successful critical actions (create, archive, restore) are also logged.

## Future Improvements
- More granular permissions per module (e.g., inventory manager vs sales rep).
- Two-factor authentication (if remote access needed, but not currently).