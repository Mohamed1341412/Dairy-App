# Offline-First Sync Architecture

## Overview

The system is designed to work offline-first, with eventual consistency when connectivity is restored.

## Sync Mechanism

### Client-Side:

1. **Client IDs**: Every record has a unique `id` (UUID)
2. **sync_id**: Optional field for tracking sync status
3. **Local Storage**: SQLite database on device
4. **Queue**: Pending operations stored locally

### Server-Side:

1. **Unique Indexes**: Prevent duplicates
2. **Conflict Resolution**: Last-write-wins (configurable)
3. **Audit Trail**: All changes logged

## Duplicate Detection

### Strategy:

```sql
CREATE UNIQUE INDEX `transactions_sync`
ON `transactions` (`sync_id`);
```

## Flow:

Client creates record with sync_id
↓
Client attempts to sync
↓
Server checks if sync_id exists
↓
If exists: Reject (duplicate)
If not exists: Accept

## Conflict Resolution

Strategy: Last-Write-Wins

- Server accepts the latest version
- Client receives updated version
- No manual merge required

Future Enhancement:

- Field-level conflict resolution
- Merge strategies for specific fields

## Eventual Consistency

Guarantees:

- All operations will eventually be synced
- No data loss
- Audit trail preserved

Limitations:

- Temporary inconsistency during offline period
- Conflicts resolved automatically (may not be optimal)

Implementation:
Collections with sync_id:

- transactions
- payments
- inventory_movements
- material_movements

## Unique Indexes:

CREATE UNIQUE INDEX `transactions_sync` ON `transactions` (`sync_id`);
CREATE UNIQUE INDEX `payments_sync` ON `payments` (`sync_id`);
CREATE UNIQUE INDEX `inventory_movements_sync` ON `inventory_movements` (`sync_id`);
CREATE UNIQUE INDEX `material_movements_sync` ON `material_movements` (`sync_id`);

## Testing

Scenarios:

- Create record offline → Sync when online
- Create duplicate → Reject
- Update record offline → Sync when online
- Conflict resolution → Last-write-wins

## Related Documentation

- Transaction Engine
- Event Flow
