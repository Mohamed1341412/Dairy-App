# ADR-016 — Sync Protection

## Status:

Accepted

## Decision:

sync_id must be unique by using Unique Index in the schema.

## Consequences:

Duplicate synchronized records are rejected.

## Protected Collections:

- transactions
- payments
- inventory_movements
- material_movements
