# ADR-014 — Offline-First Architecture

## Status:

Accepted

## Decision:

The application is Offline-First.

## Rationale

Factory operations must continue even when the PocketBase server is temporarily unavailable.

## Consequences:

- Drift is the local database.
- Users can continue working offline.
- Data synchronization occurs manually during MVP.
- Local data is considered operational storage, not business authority.
