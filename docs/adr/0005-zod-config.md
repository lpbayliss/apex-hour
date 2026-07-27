# ADR-0005: Zod-first data and typed configuration

- **Status:** Accepted
- **Date:** 2026-07-28
- **Decision owner:** Luke Bayliss
- **Requirements/tasks:** FR-019, INT-001–INT-002, SEC-003–SEC-005; TASK-001, TASK-003, TASK-010, TASK-012
- **Acceptance evidence:** `operations-contract.md` section 9; executable schema/config tests pending
- **Supersession:** New ADR only; public/persisted schema changes also follow ADR-0007.

## Context

The product is intentionally data-driven and accepts YAML/environment configuration. Static TypeScript types alone cannot validate disk, environment, API, event, or catalog data.

## Decision

Use Zod as the runtime contract for configuration, external inputs, domain commands/events, tRPC inputs/outputs, and public projections. Infer TypeScript types from schemas. Drizzle remains authoritative for relational schema, with `drizzle-zod` derivation where runtime DB validation adds value.

Configuration precedence is defaults < YAML < environment, followed by exactly one root parse. YAML is data-only, unknown keys fail, arrays replace unless documented, and effective-config diagnostics redact sensitive/path values.

## Consequences

- Runtime and compile-time contracts stay aligned.
- Schema compatibility/versioning must be deliberate for persisted events.
- Relational and domain schemas are not forced into one abstraction where their constraints differ.

## Alternatives

- **Type aliases/interfaces plus handwritten validation:** rejected as duplication.
- **Executable config files:** rejected for portability and security.
- **Custom validation library:** rejected in favor of the fixed known tool.
