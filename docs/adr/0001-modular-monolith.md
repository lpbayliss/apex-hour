# ADR-0001: Modular monolith in one runtime process

- **Status:** Accepted
- **Date:** 2026-07-28
- **Decision owner:** Luke Bayliss
- **Requirements/tasks:** QR-002; TASK-001, TASK-003–TASK-015
- **Supersession:** Replace only with a new ADR linked from the specification; never edit this accepted history after release.

## Context

Apex Hour needs separable simulation logic, a web/API application, live streams, durable scheduling, and one lightweight portable Docker image. A separate simulation service would add deployment and consistency complexity without a current scaling requirement.

## Decision

Use npm-workspace package boundaries inside one Node 24 process. The server composition root bootstraps the pure simulation package through explicit ports and owns scheduling, persistence, telemetry, tRPC/Hono, and static UI serving.

## Consequences

- Simulation is independently testable and potentially reusable.
- Transactions and post-commit publication remain local and simple.
- One process/container is the supported production topology.
- Package-boundary static checks are mandatory because runtime isolation does not enforce them.

## Alternatives

- **Microservices:** rejected for v1; operational cost and distributed consistency do not solve an evidenced need.
- **One package:** rejected; makes domain/infrastructure coupling likely.
