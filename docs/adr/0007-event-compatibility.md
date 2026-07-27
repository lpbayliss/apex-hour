# ADR-0007: Versioned aggregate events and rebuildable projections

- **Status:** Accepted
- **Date:** 2026-07-28
- **Decision owner:** Luke Bayliss
- **Requirements/tasks:** FR-006–FR-007, QR-001–QR-003, DATA-002/DATA-006, INT-003–INT-004; TASK-003, TASK-005, TASK-007, TASK-010, TASK-013, TASK-014
- **Acceptance evidence:** `domain-rules.md` sections 3–5; compatibility/rebuild tests pending
- **Supersession:** New ADR plus compatibility fixtures and migration plan.

## Context

Race-only events cannot rebuild career, sponsorship, development, or season state. SSE also needs stable cursor semantics.

## Decision

Use versioned canonical aggregate streams with deterministic stream IDs/sequences/event IDs, optional contextual IDs, command/idempotency/causation fields, and database publication order. Persist immutable ruleset/catalog/template material, not only hashes. All release-v1 projections are rebuildable. Simulation and commentary versions are separate. Additive fields are compatible within a major schema version; semantic/removal changes require a new version and migration/upcaster evidence.

## Consequences

- History/replay spans race and career systems.
- Append/idempotency and compatibility tests are first-class.
- The project owns a narrow event contract but does not adopt a general event-sourcing framework.
