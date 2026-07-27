# ADR-0002: Deterministic event-driven simulation core

- **Status:** Accepted
- **Date:** 2026-07-28
- **Decision owner:** Luke Bayliss
- **Requirements/tasks:** FR-004–FR-007, QR-001–QR-003, DATA-006; TASK-003, TASK-005–TASK-007, TASK-010
- **Acceptance evidence:** `domain-rules.md`; executable golden/checkpoint/rebuild evidence pending
- **Supersession:** New ADR only; persisted ruleset/event compatibility cannot be rewritten in place.

## Context

An always-running fictional sport needs explainable outcomes, replay, restart recovery, live projections, and safe balance changes. Hidden wall-clock or global random state would make failures irreproducible.

## Decision

Model race and season behavior as pure state transitions with explicit logical time, validated inputs, and explicit maintained PRNG state. Emit ordered versioned Zod domain events. Persist canonical events before publication; use checkpoints/projections for read performance. Generate commentary as a deterministic projection, never as race authority.

## Consequences

- Same seed/ruleset/catalog produces reproducible outcomes.
- Recovery and subscriber replay share the canonical log.
- Ruleset/catalog hashes and event compatibility become operational data.
- Care is required to isolate random substreams so unrelated changes do not perturb every outcome.

## Alternatives

- **Mutable DB-first simulation:** simpler initially but weak replay and domain isolation.
- **General event-sourcing framework:** deferred; purpose-built append-only events plus projections are sufficient.
- **LLM commentary:** deferred optional projection due nondeterminism/cost/availability.
