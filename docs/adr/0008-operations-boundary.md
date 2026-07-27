# ADR-0008: Single-replica production operations and public read boundary

- **Status:** Accepted
- **Date:** 2026-07-28
- **Decision owner:** Luke Bayliss
- **Requirements/tasks:** SEC-001–SEC-006, DATA-001–DATA-005, INT-005, OPS-001–OPS-007; TASK-003, TASK-010–TASK-016
- **Acceptance evidence:** `operations-contract.md`; executable fault/security/container evidence pending
- **Supersession:** New ADR with threat/recovery/migration analysis.

## Context

Read-only public APIs can still exhaust resources. SQLite correctness depends on storage semantics, writer fencing, migration/backup behavior, and bounded synchronous work. “Portable” cannot imply every network filesystem or multi-replica topology.

## Decision

Support one process on a local POSIX-locking SQLite volume. Enforce generation-fenced ownership, bounded pages/queues/transactions, explicit HTTP/SSE limits, sanitized health, internal/protected metrics, schema-driven config redaction, migration compatibility declarations, external-volume backups, non-root/read-only-root Docker, and native runtime tests on both target architectures.

## Consequences

- The deployment is operationally simple but intentionally not horizontally writable.
- Production-readiness claims require fault, restore, disk, signal, security, and architecture-specific evidence.
- Operators must supply ingress/TLS and a separate backup destination.
