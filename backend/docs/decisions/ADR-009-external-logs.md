# ADR-009: External Log Files

## Status
**Proposed** (Future)

## Context
PocketBase writes logs to `pb_data/logs/`. While sufficient, having separate external log files on the desktop could aid debugging, especially if the database becomes corrupted.

## Decision (Proposed)
Write audit and event logs to external files (e.g., `desktop/logs/audit.log`, `events.log`, `errors.log`) in JSON Lines format.

## Consequences
- Additional disk I/O.
- Logs survive database corruption.
- Easier to integrate with external monitoring.

## Current Implementation
Only PocketBase internal logger is used (`$app.logger().info()`). External logs are **not** implemented in MVP.