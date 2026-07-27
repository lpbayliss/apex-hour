# ADR-0003: SQLite with Drizzle and better-sqlite3

- **Status:** Accepted
- **Date:** 2026-07-28
- **Decision owner:** Luke Bayliss
- **Requirements/tasks:** DATA-001–DATA-006, OPS-006–OPS-007; TASK-010, TASK-015, TASK-016
- **Acceptance evidence:** `operations-contract.md`; executable migration/fencing/restore evidence pending
- **Supersession:** New ADR plus migration/rollback plan; never silently change the durable store.

## Context

The accepted topology is one portable container with a mounted database. The application needs migrations, foreign keys, transactions, deterministic ordering, backups, and high read volume with one simulation writer.

## Decision

Use SQLite in WAL mode through `better-sqlite3`, with Drizzle schemas/migrations and `drizzle-zod` at selected DB boundaries. Run one active writer process, short explicit transactions, foreign keys, busy timeout, startup migration, ownership heartbeat, integrity checks, and online backup/restore rehearsal.

## Consequences

- Deployment remains one file/volume and one container.
- Native module packaging requires Debian slim and multi-architecture smoke tests.
- Horizontal replicas writing one file are unsupported.
- A future Postgres migration must preserve domain/event contracts rather than leak driver details into simulation.

## Alternatives

- **Node `node:sqlite`:** deferred while Node documentation still marks the API release-candidate stability.
- **Postgres:** unnecessary operational dependency for accepted single-replica scale.
- **Custom SQL mapper:** rejected; Drizzle provides known schema/migration/query tooling.
