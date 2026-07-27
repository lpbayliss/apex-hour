# ADR-0004: tRPC tracked SSE mounted in Hono

- **Status:** Proposed — executable spike required
- **Date:** 2026-07-28
- **Decision owner:** Luke Bayliss
- **Requirements/tasks:** FR-017–FR-018, QR-004–QR-005, SEC-001–SEC-002, INT-004; TASK-002, TASK-013
- **Decision deadline/evidence:** TASK-002 report at `docs/spikes/trpc-hono-sse.md`
- **Supersession:** If no adapter passes, supersede this ADR before production code; do not work around failed wire behavior.

## Context

Spectators need one-way live race events and reconnect recovery. Hono and tRPC are fixed stack choices. There is no v1 client-to-server live interaction requiring a WebSocket.

## Decision

Use tRPC v11 SSE subscriptions with tracked event IDs, mounted in the Hono Node server. The subscription registers its live listener before database catch-up, yields missed persisted events, then tails committed events. Slow consumers have bounded queues and disconnect resumably.

The implementation adapter is delegated to TASK-002. Prefer the official tRPC Fetch adapter mounted in Hono. Select `@hono/trpc-server` only if it passes the same tracked-subscription, abort, reconnect, post-header error, and Vite-client tests with less project glue.

## Consequences

- One type-safe API surface covers queries and subscriptions.
- Native EventSource/proxy compatibility is simpler than WebSockets.
- Publication must remain post-commit and event IDs durable.
- Errors after headers require stream-local handling.

## Alternatives

- **WebSockets:** rejected for v1 as bidirectional complexity without product need.
- **Polling:** rejected for live commentary and unnecessary repeated reads.
- **Raw Hono SSE:** credible fallback but duplicates tRPC contract/subscription behavior.
