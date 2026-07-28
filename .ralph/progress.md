# Ralph progress

Append one section per attempted story. Never rewrite prior entries.

Each passing entry includes: story ID, UTC timestamp, files changed, exact commands and observed results, requirements/evidence advanced, and commit message. Do not claim a command passed unless it ran in this iteration.

## Controller preflight — 2026-07-28

- Initial shell invocation failed before a story attempt because variadic CLI options consumed the prompt argument. The controller now pipes prompts through stdin.
- A direct stdin smoke test reached Claude Code but returned HTTP 401 because its OAuth access token had expired.
- No PRD story status or attempt count changed during controller preflight. Until Claude Code is re-authenticated, fresh bounded Hermes subagents may execute the same one-story contract; the parent verifies each shared-repository commit before selecting the next story.

## FND-001 — 2026-07-28

- Worker outcome notification was lost before commit; the parent inspected the shared working tree, removed generated build metadata, added its ignore rule, and completed verification.
- Files: root Node/npm/TypeScript manifests, lockfile, eight workspace manifests/configs/minimal sources, `.nvmrc`, `.node-version`, `.gitignore`, PRD/progress/evidence.
- Observed: `npm ci && npm run check` exited 0; Prettier, ESLint, TypeScript 7 build/typecheck, Vitest no-test baseline, and build passed. npm reported the expected host mismatch because this machine runs Node 22 while the repository pins Node 24; Node 24 CI remains FND-004 evidence.
- Security: npm audit reported 0 vulnerabilities.
- Evidence: `docs/evidence/TASK-001.md`.
- Commit: `build(TASK-001): create the npm workspace and pinned toolchain`.

## FND-002 — 2026-07-28

- The bounded worker timed out after writing a partial tree; the parent inspected it, replaced its resolver monkey-patch with Microsoft's documented TypeScript 7/6 side-by-side alias pattern, removed generated source artifacts, and completed the story.
- TypeScript 7.0.2 is the native `tsc`; `@typescript/typescript6` supplies the programmatic API used by typescript-eslint until TypeScript 7.1.
- Observed: `npx tsc --version` = 7.0.2; tooling TypeScript API = 6.0.3; `npm run check` exited 0.
- Real checks: Prettier passed, ESLint parsed/linted TypeScript sources, strict project references passed, two Zod contract tests passed, and outputs built under ignored `dist/` paths.
- All eight workspaces expose explicit ESM/type export maps; source trees contain only source/test files.
- Evidence appended to `docs/evidence/TASK-001.md`.
- Commit: `build(TASK-001): enforce strict TypeScript references and Zod inference`.

## FND-003 — 2026-07-28

- The bounded worker stopped before recording/committing; the parent inspected the partial implementation and ran every required gate before accepting it.
- Added a TypeScript-AST boundary checker covering web/server, database, observability, config, Node/outside imports plus environment, Node globals, random, wall-clock and timer usage.
- Observed: `npm run test:boundaries && npm run check && node scripts/check-docs.mjs` exited 0.
- The negative fixture produced each of the 11 stable rule codes exactly once; production simulation source was clean.
- Full formatting, TypeScript lint/typecheck, two contract tests, build, boundary check, and documentation checks passed.
- Evidence appended to `docs/evidence/TASK-001.md`.
- Commit: `build(TASK-001): add executable simulation boundary checks`.

## Harness migration — 2026-07-28

- External-process Ralph execution was retired after the shell/Claude path failed to deliver product code reliably.
- Durable `.ralph/prd.json` and `.ralph/progress.md` remain; implementation now runs through the Hermes `bounded-ralph-loop` skill in the current session.
- Removed `.ralph/PROMPT.md`, `scripts/ralph-bounded.sh`, and `scripts/ralph-state.mjs`.
- This is a process correction, not a completed product story. FND-004 remains pending and no application vertical slice is claimed.

## FND-004 — 2026-07-28

- Replaced docs-only CI with one read-only, concurrency-bounded `check` workflow using Node 24, npm cache, `npm ci`, documentation validation, and the full repository gate.
- Observed host command: `npm ci && node scripts/check-docs.mjs && npm run check` exited 0; the host correctly warned that it runs Node 22 rather than the required Node 24.
- Observed clean-copy target-runtime command: `docker run ... node:24-bookworm-slim ... npm ci; node scripts/check-docs.mjs; npm run check` exited 0 on Node v24.18.0/npm 11.16.0 with 0 vulnerabilities, 2 tests passed, build and boundary checks passed.
- Observed workflow validation: `rhysd/actionlint:latest .github/workflows/check.yml` exited 0 after normalizing the workflow mode to 0644.
- README now explicitly states that only foundation work exists and all product entrypoints remain placeholders.
- Remote GitHub Actions execution is not claimed because this story commit has not been pushed.
- Commit: `ci(TASK-001): add Node 24 repository checks`.

## TASK-002 / TRN-001 — 2026-07-28

- Began TASK-002 using the native Hermes `bounded-ralph-loop` skill; no worker process or delegated implementer was used.
- Added a real ephemeral Node server where Hono mounts the official tRPC Fetch adapter at `/trpc`.
- Added an in-memory DB-style projection store with two-row catch-up pages, race-scoped publication cursors, listener-before-high-water ordering, duplicate suppression, and abort cleanup.
- Focused real-wire test observed a tRPC query plus tracked SSE through `eventsource`; an event inserted during catch-up arrived after persisted events with exact cursor order and no duplicate from a deliberate republish.
- Observed `npm run spike:transport:server`: strict TypeScript check and 1 real-wire Vitest test passed.
- Observed spike Prettier and ESLint checks passed; npm audit reported 0 vulnerabilities.
- Commit: `test(TASK-002): wire Hono tRPC tracked SSE server`.

## TASK-002 / TRN-002 — 2026-07-28

- Added a Vite-built browser client using tRPC `httpSubscriptionLink` and native browser EventSource.
- Added a real Vite preview reverse-proxy fixture that streams `/trpc`, preserves `text/event-stream`, forces `X-Accel-Buffering: no`, applies `no-transform`, and has a two-second proxy idle bound kept alive by 100 ms tRPC heartbeats.
- Installed pinned `@playwright/test` 1.62.0 and its Chromium 151 runtime.
- Observed `npm run spike:transport:browser`: strict TypeScript and one actual headless Chromium wire test passed.
- Browser received cursors 1–2, unsubscribed and released the server listener, then reconnected with cursor 2 and received 3–4 with no gaps or duplicates; proxy streaming headers were observed in the browser response.
- Spike Prettier and ESLint checks passed.
- Commit: `test(TASK-002): prove Vite proxy browser reconnect`.

## TASK-002 / TRN-003 — 2026-07-28

- Added bounded slow-consumer queues. Capacity overflow terminates with `SSE_QUEUE_OVERFLOW` plus the last delivered race publication cursor; a new subscription catches up every remaining persisted event.
- Added a post-header terminal-error case: one tracked event is delivered before a non-retryable serialized tRPC error, followed by listener cleanup.
- Extended the real-browser test beyond the two-second proxy timeout; 100 ms SSE heartbeats kept the stream alive and a later event arrived without reconnect.
- Added and syntax-validated an Nginx 1.29.5 compatibility configuration with buffering/cache disabled and bounded read/send timeout.
- Observed `npm run spike:transport`: strict TypeScript and all 4 wire tests across 3 files passed and every server/browser/proxy fixture exited.
- Repeated the complete spike in `mcr.microsoft.com/playwright:v1.62.0-noble` on Node v24.18.0/npm 11.16.0 after a clean `npm ci`; all 4 tests passed and audit found 0 vulnerabilities.
- Recorded the exact matrix and accepted ADR-0004 with the official tRPC Fetch adapter. No second adapter was added because the preferred adapter passed every decision case.
- Commit: `test(TASK-002): accept tracked SSE transport spike`.

## TASK-003 / CTR-001 — 2026-07-28

- Added strict Zod schemas and inferred branded types for aggregate/context IDs, event IDs, command/correlation IDs, ratings, and all required rider rating fields.
- Added a typed canonical event-envelope factory covering deterministic aggregate identity/order, context, event/schema/ruleset/catalog versions, logical/planned time, command/idempotency/causation/correlation identity, and validated payload.
- Added distinct aggregate-event and tracked race-feed cursor schemas plus stable `EVENT_CURSOR_INVALID`, `EVENT_CURSOR_AHEAD`, and `EVENT_CURSOR_EXPIRED` validation results.
- Observed `npm run test --workspace @apex-hour/contracts`: 10 tests passed.
- Observed package ESLint, `npm run typecheck`, and full `npm run check`: passed.
- Commit: `feat(TASK-003): define canonical event contracts`.

## TASK-003 / CFG-001 — 2026-07-28

- Added one strict inferred `AppConfig` schema with code-owned production defaults and cross-field live-duration/development-override/path constraints.
- Added recursive defaults < failsafe YAML < `APEX_HOUR__...` environment resolution; objects recurse, scalars replace, and arrays replace whole arrays.
- Added schema-directed decoding for exact booleans, finite decimals, explicit nullable `null`, JSON arrays/objects, strings, and the one explicit empty-to-null config-file field.
- YAML now rejects duplicate keys, custom tags, aliases, non-object roots, and oversized input. Missing optional default files are allowed; explicit missing/unreadable files fail with stable codes.
- Effective source provenance is recorded at leaf fields and validation/parser errors expose safe code/path diagnostics without arbitrary rejected values.
- Added `.env.example` and `config.example.yaml` matching the root schema.
- Observed `npm run test --workspace @apex-hour/config`: 16 tests passed; package ESLint, `npm run typecheck`, and full `npm run check` passed; npm audit found 0 vulnerabilities.
- Commit: `feat(TASK-003): implement strict config resolution`.

## TASK-003 / CFG-002 — 2026-07-28

- Added same-major compatibility parsing that preserves additive envelope/payload fields while strict write validation still rejects unknown fields; unsupported schema majors fail with `EVENT_SCHEMA_UNSUPPORTED`.
- Added recursive metadata-driven redaction for bearer tokens and filesystem-sensitive fields, including null-preserving config-file handling.
- Added production containment for database, backup, declared config, and actual loaded config paths. The single named outside-root override works only in development and is rejected in production.
- Added hostile compatibility coverage for nested arrays/JSON objects, credentials/query tokens in URLs, embedded bearer tokens, parser failures, unknown YAML keys, example files, and every operations-contract section 9 row.
- Confirmed public `AppConfig`, IDs, ratings, event, and cursor types are Zod-inferred with no duplicate handwritten public shape.
- Observed package tests: 11 contracts + 24 config tests passed; full repository check passed with 35 tests.
- Repeated cleanly in `node:24-bookworm-slim` on Node v24.18.0/npm 11.16.0 after `npm ci`; 0 vulnerabilities and all checks passed.
- Commit: `test(TASK-003): complete config compatibility matrix`.
