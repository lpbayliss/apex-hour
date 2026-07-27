# Apex Hour

A fictional, continuously running motorcycle-racing universe. Every season contains 24 hourly races, with each race unfolding live as structured events and commentary.

## Status

Specification accepted after independent product/domain, architecture/security/operations, and agent-readiness reviews. The governing contract is [`docs/specification.md`](docs/specification.md); implementation evidence remains explicitly tracked as Planned or Observed.

## Intended architecture

A production-oriented TypeScript modular monolith:

- Hono Node.js service
- tRPC API and SSE subscriptions
- Vite + React spectator UI
- deterministic simulation package isolated from web and persistence infrastructure
- SQLite on a mounted local POSIX-locking volume (single active replica)
- Zod-first contracts and typed YAML/environment configuration
- contextual structured logs and Prometheus-compatible metrics
- one portable Docker image

All riders, teams, manufacturers, sponsors, circuits, and brands are fictional.
