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

Browser, proxy, reconnect, and abort behavior are observed in TRN-002; overflow and post-header terminal-error evidence remain pending in TRN-003.

## TRN-002 — Vite client, streaming proxy, and Playwright reconnect

**Date:** 2026-07-28

### Delivered

- Vite 8.1.5 builds a browser client using tRPC 11.18.0 `httpSubscriptionLink` and native browser EventSource.
- Vite preview runs as a real reverse proxy for `/trpc`; it preserves streaming, sets `X-Accel-Buffering: no` and `Cache-Control: no-cache, no-transform`, and uses a two-second proxy timeout while server heartbeats arrive every 100 ms.
- Pinned `@playwright/test` 1.62.0 launches downloaded Chromium 151.0.7922.34.

### Observed command

```text
npm install
npx playwright install chromium
npx prettier --write 'spikes/trpc-hono-sse/**/*.{html,json,ts}' package.json package-lock.json .ralph/prd.json
npx eslint 'spikes/trpc-hono-sse/**/*.ts'
npm run spike:transport:browser
git diff --check
```

**Observed result:** exit 0. Strict TypeScript passed. An actual headless Chromium page loaded the Vite-built client through the proxy, observed tracked cursors 1–2, unsubscribed and reduced the server listener count to zero, inserted events 3–4 while disconnected, then reconnected from cursor 2 and received 3–4 without gaps or duplicates. The browser response exposed `text/event-stream`, `X-Accel-Buffering: no`, and `no-transform`. No client errors were observed.

### Matrix update

| Case                                          | Status        |
| --------------------------------------------- | ------------- |
| Vite production build                         | observed pass |
| Actual browser through proxy                  | observed pass |
| Exact tracked-cursor reconnect                | observed pass |
| Browser abort/listener cleanup                | observed pass |
| Proxy buffering headers                       | observed pass |
| Heartbeat survives bounded proxy idle timeout | observed pass |
| Queue overflow/resume                         | observed pass |
| Terminal error after headers                  | observed pass |

## TRN-003 — resilience matrix and adapter decision

**Date:** 2026-07-28

### Delivered

- Bounded slow-consumer queue with a stable `SSE_QUEUE_OVERFLOW` terminal error and resumable last-delivered tracked cursor.
- Recovery test reconnects from that cursor and receives every remaining persisted event.
- Non-retryable post-header error test receives one tracked event before the serialized error and observes listener cleanup.
- Browser heartbeat test remains connected beyond the proxy's two-second idle timeout and receives a later event.
- Committed Nginx compatibility fixture disables proxy buffering/cache, applies two-second read/send timeouts, and adds the required streaming headers.
- `docs/spikes/trpc-hono-sse.md` records the exact matrix and selects the official tRPC Fetch adapter.
- ADR-0004 status advanced from Proposed to Accepted only after the complete executable matrix passed.
- Documentation validation now derives ADR-0004's required Proposed/Accepted status from observed TASK-002 final-decision evidence rather than hard-coding the pre-spike state.

### Observed full local command

```text
npx prettier --write 'spikes/trpc-hono-sse/**/*.{html,json,ts}' package.json package-lock.json .ralph/prd.json docs/spikes/trpc-hono-sse.md docs/adr/0004-trpc-sse.md
npx eslint 'spikes/trpc-hono-sse/**/*.ts'
npm run spike:transport
```

**Observed result:** exit 0. Strict TypeScript passed; three wire-test files and four tests passed. The actual Node server, Vite build/preview proxy, Chromium browser, subscriptions, and listeners closed cleanly.

### Observed Nginx compatibility command

```text
docker run --rm -v "$PWD/spikes/trpc-hono-sse/proxy/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:1.29.5-alpine nginx -t
```

**Observed result:** exit 0; Nginx reported syntax and configuration test success. Image digest observed: `sha256:1eff5a5f3fcf8431a0abb7eddf5471fec24e5e1905a2581aeacdb07a4479b92b`.

### Observed clean Node 24/Playwright command

A read-only repository mount was copied without `.git`, `node_modules`, or `dist` into `mcr.microsoft.com/playwright:v1.62.0-noble`, then executed:

```text
npm ci
npm run spike:transport
```

**Observed environment:** Node v24.18.0; npm 11.16.0; Playwright image digest `sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07`.

**Observed result:** exit 0. Locked install added 157 packages, audited 167 packages with 0 vulnerabilities, and all four real-wire tests passed.

### Final decision

The official `@trpc/server/adapters/fetch` integration is selected. `@hono/trpc-server` was not compared because the preferred integration passed all named TASK-002 cases without additional adapter glue. This completes the transport spike only; production FR-018 remains assigned to later implementation tasks.
