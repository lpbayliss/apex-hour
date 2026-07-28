# Agent instructions

## Source of truth

1. Read `docs/specification.md`, `docs/domain-rules.md`, `docs/operations-contract.md`, and `docs/traceability.md` before changing product behaviour.
2. Read linked ADRs before changing architecture or public contracts. A Proposed ADR is not accepted evidence.
3. Treat Zod schemas as runtime contracts and infer TypeScript types from them where practical.
4. Do not invent unresolved product rules, numeric targets, security boundaries, or migration behaviour.

## Architecture invariants

- `packages/simulation` is deterministic domain code. It must not import Hono, tRPC, SQLite/Drizzle, logging, metrics, wall-clock time, environment variables, or filesystem APIs.
- Infrastructure bootstraps the simulation through explicit ports/interfaces inside one service process.
- Persist domain events before publishing them to subscribers.
- Public APIs are read-only in the initial product and obey the paging/resource limits in `docs/operations-contract.md`.
- Configuration precedence is defaults < YAML file < environment variables, followed by one Zod parse.
- High-cardinality IDs belong in logs/traces, not metric labels.

## Working method

- Work on one accepted task per iteration.
- For Ralph/autonomous backlog work, load the Hermes `bounded-ralph-loop` skill and execute the iteration directly in the current Hermes session.
- Do not launch shell loops, Claude/Codex CLIs, background coding agents, recursive Hermes sessions, or scheduled jobs to implement Ralph stories.
- Keep commits small and independently verifiable.
- Add or update tests before declaring a task complete.
- Run the repository checks named in `docs/implementation-plan.md`.
- Record new durable build/run knowledge here; record task progress in `.ralph/progress.md`.
- Foundation scaffolding and placeholder entrypoints are not a product vertical slice; report them as foundation only.
- Stop for unresolved destructive migration, public contract, data-loss, privacy, or hard-to-rollback decisions.

## Forbidden

- No real-world rider, team, circuit, sponsor, or manufacturer names.
- No live simulation mutation/admin controls unless the specification is amended.
- No unbounded autonomous loop.
- No skipped failing tests or fabricated verification results.
