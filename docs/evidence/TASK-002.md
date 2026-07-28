# TASK-002 evidence

Implementation evidence is append-only by story. TASK-002 is a transport spike and does not complete the production API.

## TRN-001 — official tRPC Fetch adapter through Hono

**Date:** 2026-07-28

### Delivered

- Actual ephemeral Node HTTP server via `@hono/node-server` 2.0.12.
- Hono 4.12.32 mount at `/trpc/*` delegating to tRPC 11.18.0 `fetchRequestHandler`.
- Read query and tracked SSE subscription.
- Race cursor format `race/<raceId>/publication/<sequence>`.
- Listener registration before captured high-water sequence.
- Bounded two-row DB-style catch-up pages and deterministic catch-up/live de-duplication.
- Request abort removes the store listener.
- SSE responses set `X-Accel-Buffering: no` and `Cache-Control: no-cache, no-transform`.

### Observed commands

```text
npm install
npx prettier --write 'spikes/trpc-hono-sse/**/*.{json,ts}' package.json package-lock.json .ralph/prd.json
npx eslint 'spikes/trpc-hono-sse/**/*.ts'
npm run spike:transport:server
git diff --check
```

**Observed result:** exit 0. npm audited 164 packages with 0 vulnerabilities. Strict TypeScript checking passed. One real HTTP/tRPC/SSE wire test passed. The test inserted an event during paged catch-up, deliberately republished an older event, asserted exact tracked cursor order 1–4 without duplication, checked streaming headers, unsubscribed, and observed listener count return to zero.

### Package matrix so far

| Package             | Version | Role                               |
| ------------------- | ------: | ---------------------------------- |
| Node target         |    24.x | server runtime target              |
| `@hono/node-server` |  2.0.12 | real ephemeral Node server         |
| `hono`              | 4.12.32 | HTTP router and tRPC mount         |
| `@trpc/server`      | 11.18.0 | Fetch handler, router, tracked SSE |
| `@trpc/client`      | 11.18.0 | query/subscription client          |
| `eventsource`       |   4.1.0 | Node wire-test EventSource         |
| `zod`               |   4.4.3 | subscription input validation      |
| Vitest              |  4.1.10 | executable wire test               |

Browser, proxy, reconnect, overflow, and post-header terminal-error evidence remain pending in TRN-002/TRN-003.
