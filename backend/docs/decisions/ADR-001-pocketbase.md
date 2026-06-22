# ADR-001: Use PocketBase as Backend

## Status
**Accepted** (MVP)

## Context
Need a lightweight, self-contained backend that can run on a local desktop without internet. Must provide REST API, authentication, real-time (optional), and ability to enforce complex business rules.

## Decision
Use **PocketBase** – an open-source Go backend with embedded SQLite, built-in auth, and JavaScript/Go hooks.

## Reasons
- Single executable – easy deployment and updates.
- No external dependencies (database included).
- Built-in admin UI for debugging.
- Hooks allow custom business logic.
- Good performance for small to medium datasets.

## Consequences
- Requires writing hooks in JavaScript (or Go) for business rules.
- Limited to SQLite (but sufficient for our scale).
- No built-in event sourcing or audit trails – must build manually.