# tRPC/Hono tracked-SSE transport spike

- **Status:** Passed
- **Date:** 2026-07-28
- **Task:** TASK-002
- **Decision:** Select the official tRPC Fetch adapter mounted in Hono. Do not add `@hono/trpc-server` because the preferred adapter passed the complete matrix without additional adapter glue.

## Scope

This is an executable transport fixture, not production API code. It proves the browser/server/proxy behavior required before accepting ADR-0004. Production packages do not import the spike.

## Exact matrix

| Component                   | Version/implementation                                                     |
| --------------------------- | -------------------------------------------------------------------------- |
| Node target                 | 24.x                                                                       |
| TypeScript compiler         | 7.0.2 native compiler                                                      |
| Hono                        | 4.12.32                                                                    |
| Hono Node server            | 2.0.12                                                                     |
| tRPC server/client          | 11.18.0                                                                    |
| Adapter                     | `@trpc/server/adapters/fetch` mounted with `app.all('/trpc/*', ...)`       |
| Zod                         | 4.4.3                                                                      |
| Vite                        | 8.1.5 production build + preview reverse proxy                             |
| Playwright                  | 1.62.0                                                                     |
| Browser                     | Chromium 151.0.7922.34 from Playwright build 1234                          |
| Node EventSource            | 4.1.0                                                                      |
| Nginx compatibility fixture | `nginx:1.29.5-alpine`, `proxy_buffering off`, two-second read/send timeout |

## Executable cases

| Case                         | Evidence                                                                                          | Result |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| Real Node HTTP server        | ephemeral `@hono/node-server` listener                                                            | Pass   |
| Hono/tRPC query              | `status` through Fetch adapter                                                                    | Pass   |
| Tracked SSE content type     | browser and Node wire response headers                                                            | Pass   |
| Buffering headers            | `X-Accel-Buffering: no`; `no-transform`                                                           | Pass   |
| Heartbeat/idle               | 100 ms tRPC ping survives a two-second proxy timeout and delivers an event after 2.2 seconds idle | Pass   |
| Listener-before-catch-up     | listener registered before high-water capture                                                     | Pass   |
| Bounded catch-up pages       | two projections per page through captured high-water                                              | Pass   |
| Insert during catch-up       | event inserted during first page arrives after persisted events                                   | Pass   |
| Deterministic de-duplication | deliberate republish suppressed; cursor order exact                                               | Pass   |
| Exact tracked cursor         | `race/<raceId>/publication/<sequence>` observed in clients                                        | Pass   |
| Vite-built client            | production build loaded in browser                                                                | Pass   |
| Actual browser through proxy | Playwright Chromium drives Vite preview proxy                                                     | Pass   |
| Abort cleanup                | browser and Node unsubscribe reduce listener count to zero                                        | Pass   |
| Reconnect                    | browser reconnect from exact cursor has no gaps/duplicates                                        | Pass   |
| Queue overflow               | capacity-two queue closes slow consumer with `SSE_QUEUE_OVERFLOW` and resumable cursor            | Pass   |
| Overflow recovery            | fresh subscription catches up remaining persisted events                                          | Pass   |
| Terminal error after headers | tracked data arrives, then non-retryable serialized tRPC error, listener cleaned                  | Pass   |
| Nginx-compatible fixture     | `nginx -t` against committed config                                                               | Pass   |
| Fixture cleanup              | browser, Vite proxy, Node server and listeners close; command exits                               | Pass   |

## Commands

```text
npm run spike:transport
npm run check
docker run --rm -v "$PWD/spikes/trpc-hono-sse/proxy/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:1.29.5-alpine nginx -t
```

Full observed output and environment notes are recorded in `docs/evidence/TASK-002.md`.

## Decision rationale

The official Fetch adapter preserves the standard Web `Request`/`Response` stream across Hono and supports tRPC's native tracked SSE protocol without adapter-specific behavior. The fixture observed correct cancellation, reconnect input, heartbeat, serialized post-header errors, and streaming proxy headers. Comparing a second adapter would add work without changing the decision rule because the preferred adapter passed every required case.

## Limits

- Persistence is represented by an in-memory DB-style store with bounded pages; SQLite implementation belongs to later tasks.
- The Vite reverse proxy is the executable wire proxy. A committed Nginx configuration with matching buffering and timeout behavior is syntax-validated separately.
- This spike does not complete FR-018 or the production API; it only accepts the transport mechanism.
