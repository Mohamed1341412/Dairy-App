# Offline-First Strategy

## Current Implementation (MVP)

### Deployment Architecture
Desktop PC (PocketBase) ←→ Local Wi-Fi Router ←→ Mobile/Desktop Clients (Flutter)
No internet required. All data stays inside the factory network.

### Offline Capabilities
- Flutter app uses **Drift** (SQLite) as local database.
- Users can create, edit, and delete records while offline.
- All operations are stored locally with a unique `sync_id` (if needed).
- Manual sync button: user triggers synchronization when back online.

### Sync Mechanism (Manual)
- **Pull**: Fetch records from PocketBase that were updated after `last_sync_time`.
- **Push**: Upload local records that have not been synced.
- **Duplicate prevention**: Server checks `sync_id` and rejects duplicates.
- **Conflict resolution**: 
	Operational Records:
		Simple "last write wins" based on `updated` timestamp.
	Financial Records:
		Conflicts are rejected and require manual resolution.

### Current Limitations
- No automatic background sync (user must press sync button).
- No complex conflict resolution (e.g., merging changes).
- Sync only works when device is connected to the same local network as PocketBase.

## Future Enhancements (Planned)
- Background sync using WorkManager (Android) and BackgroundFetch (iOS).
- Automatic sync on network reconnection.
- Conflict resolution UI for admin.
- Sync status indicators and error recovery.

## Data Duplication Prevention
- `sync_id` field in `transactions`, `payments`, `inventory_movements`, `material_movements`.
- Unique constraint on `sync_id` to reject duplicates at database level.
- `sync_guard` hook blocks duplicate creation.