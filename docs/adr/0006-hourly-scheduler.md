# ADR-0006: Fixed hourly slots with sequential recovered publication

- **Status:** Accepted
- **Date:** 2026-07-28
- **Decision owner:** Luke Bayliss
- **Requirements/tasks:** FR-002–FR-004, FR-021, OPS-005, OPS-007; TASK-011
- **Acceptance evidence:** `domain-rules.md` sections 1–2; downtime/property tests pending
- **Supersession:** New ADR and schedule migration only; planned historical instants never change.

## Context

Exactly 24 races and elapsed-hour starts conflict with downtime, DST, and non-overlap unless overdue behavior is deterministic.

## Decision

Create all 24 immutable planned slots. Use `(ordinal - 1) × 3,600 seconds`; the next season starts 24 elapsed hours later. Run at most one race. Overdue slots execute sequentially at compute speed in recovered publication mode without skipped outcomes or moved planned instants. Bounded recovery yields between event batches; excessive backlog suspends new claims. Timezone is labeling/anchor input, not interval arithmetic.

## Consequences

- Seasons remain complete/reproducible after ordinary downtime.
- Long downtime can create visible recovery lag rather than pretending events were live.
- The operator needs alerting and an explicit backlog suspension limit.

## Alternatives

Skipping races, overlapping races, and silently moving planned times were rejected because they break season/determinism contracts.
