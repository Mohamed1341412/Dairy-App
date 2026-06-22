# Audit Logging

## Logging Targets
1. **PocketBase internal logger** – stored in `pb_data/logs/` (JSON format).
   - Used by `AuditLogger` and `EventLogger` via `$app.logger().info()`.
2. **Future**: External file logs (`desktop/logs/audit.log`) – planned but not yet implemented.

## Event Categories

### Audit Events (Who did what)
Logged by `AuditLogger` with prefix `[AUDIT]`:
- Blocked actions: update/delete on immutable collections, locked records, duplicate sync_id.
- Security events: login, role change, permission change.
- Critical data changes: archiving, restoring.

### System Events (What happened in the system)
Logged by `EventLogger` with prefix `[EVENT]`:
- Stock updates (`INCREMENTAL_STOCK_UPDATE`).
- Automatic reference number generation.
- Scheduled tasks (none in MVP).

## Log Structure (audit events)
```json
{
  "timestamp": "2026-06-08T10:30:00Z",
  "action": "IMMUTABLE_COLLECTION_UPDATE_BLOCKED",
  "collection": "transactions",
  "recordId": "abc123",
  "userId": "user_xyz",
  "details": { "reason": "Financial records are immutable" }
}

Retention & Access
Logs are retained indefinitely in pb_data/logs/.

Accessible via file system (desktop) or via PocketBase admin UI.

No automated log rotation in MVP.

Future
External log files with rotation.

In-database system_logs collection for easier querying (planned for v2).