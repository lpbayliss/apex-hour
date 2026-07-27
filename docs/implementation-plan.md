# Apex Hour implementation plan

**Status:** Accepted; exact readiness remains per task.

**Sources:** [specification](specification.md), [domain rules](domain-rules.md), [operations contract](operations-contract.md), [traceability](traceability.md).

## Global quality gate

Once TASK-001 introduces them, every passed task runs:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
node scripts/check-docs.mjs
```

Each task adds focused commands before it can pass. Planned evidence is never reported as observed. Failed work is not committed as passed.

## Task contract

Each TASK has one authoritative writer, explicit dependencies, allowed paths, verification, rollback, and an observed `docs/evidence/TASK-NNN.md` artifact containing commit, commands, environment, outputs, and requirement rows advanced. That evidence path and `.ralph/progress.md` are implicitly allowed for every task. A dependency means its committed pass evidence exists. Shared schema/state/DB/API files are never edited concurrently.

## TASK-001 — Repository/toolchain baseline

- **Readiness:** Ready only after the follow-up specification gate passes, governing status/relevant ADRs are accepted, those docs are committed on `main`, and branch `feat/foundation` is clean.
- **Depends on:** none.
- **Bootstrap evidence only:** supports INT-001/SEC-006/QR-002; does not complete their production acceptance.
- **Allowed paths:** root configs/lockfile, `.github/workflows/check.yml`, empty `apps/*`/`packages/*` package manifests and source/test placeholders, `.ralph/**`, `scripts/check-boundaries.mjs`, `scripts/ralph-bounded.sh`, and TASK-001 evidence.
- **Pinned baseline:** Node 24 LTS; TypeScript 7.0.2; Hono 4.12.32; tRPC 11.18.0; Vite 8.1.5; React 19.2.8; Zod 4.4.3; Vitest 4.1.10; ESLint 10.8.0; Prettier 3.9.6. Exact transitive versions come from committed `package-lock.json`.
- **Steps:** npm workspaces; strict TS project references; format/lint/type/test/build/check scripts; package export maps; one Zod inference test; simulation forbidden-import/`Math.random` checker plus negative fixture; CI on Node 24.
- **Verify:** `npm ci && npm run check`; deliberately run the negative boundary fixture and assert the intended failure.
- **Pass:** fresh clone installs and all positive checks pass; negative fixture fails for only its expected rule.
- **Rollback:** remove generated workspace/package files and reset to baseline docs commit.
- **Evidence:** CI run and `.ralph/progress.md` command results.

## TASK-002 — Real-wire Hono/tRPC tracked-SSE spike

- **Readiness:** after TASK-001 passes.
- **Depends on:** TASK-001.
- **Spike evidence only:** informs FR-018/QR-004/ADR-0004; does not complete production API.
- **Allowed paths:** `spikes/trpc-hono-sse/**`, root script/dependency entries needed only for spike, `docs/spikes/trpc-hono-sse.md`, ADR-0004 status.
- **Versions:** pinned TASK-001 Hono/tRPC/Node/Vite versions; compare official Fetch adapter mount with `@hono/trpc-server` 0.4.2 only if useful.
- **Steps/evidence:** real Node HTTP server, Vite-built client, and actual Playwright browser; `text/event-stream`, buffering headers, heartbeat/idle behavior; listener-before-catch-up with captured high-water mark; bounded DB-style pages; event inserted during catch-up; deterministic de-duplication/order; exact tracked cursor; browser abort/reconnect cleanup; bounded queue overflow/resume; terminal error after headers; nginx-compatible proxy fixture with buffering disabled and idle timeout; exact package matrix.
- **Verify:** `npm run spike:transport` starts the ephemeral server/proxy/Vite client, drives an actual browser through the proxy, executes every wire test, and exits.
- **Decision rule:** choose the smallest adapter passing every case. If neither does, record failure and supersede ADR-0004 before production transport work.
- **Pass:** every named real-wire case passes, the exact version/adapter matrix is recorded, and ADR-0004 is accepted or superseded from executable evidence.
- **Rollback:** no spike imports in production packages; keep only the minimal selected fixture/report, or remove both adapters and record the failed decision gate.

## TASK-003 — Core Zod IDs, event envelope, and config schemas

- **Readiness:** after follow-up spec review accepts domain/operations annexes.
- **Depends on:** TASK-001.
- **Owns:** `packages/contracts/**`, `packages/config/**`, `.env.example`, `config.example.yaml`.
- **Requirements:** FR-006, FR-019, INT-001, INT-003, SEC-003–SEC-005.
- **Steps:** branded IDs; rating primitives; canonical aggregate envelope/cursors; config root and schema metadata; exact YAML/env merge/decode/provenance/redaction/path behavior; compatibility fixtures.
- **Verify:** `npm run test --workspace @apex-hour/contracts`; `npm run test --workspace @apex-hour/config`; `npm run typecheck`.
- **Pass:** every operations-config boundary table case and event-envelope fixture passes; no duplicate handwritten TypeScript public shape.
- **Rollback:** schemas are pre-release; revert task commit. After persistence/API use, changes require ADR-0007 compatibility process.

## TASK-004 — Fictional catalogs and deterministic universe generator

- **Depends on:** TASK-003.
- **Owns:** `content/**`, `packages/simulation/src/universe/**`, `scripts/check-content.mjs`, `docs/content-review.md`.
- **Requirements:** FR-001, FR-010–FR-011.
- **Steps:** 12-team/24-seat fixture, reserve pool, fictional riders/circuits/sponsors/manufacturers/components/tyres; Zod content loader/hashes; seeded universe generation; reserved/collision lint.
- **Verify:** `npm run content:check && npm run test:universe`.
- **Pass:** same seed/content produces same universe hash; all career/grid invariants hold; Luke content review remains a public-v1 gate.
- **Rollback:** revert catalog/generator commit; never rewrite a catalog version used by persisted history.

## TASK-005 — Pure transition kernel, RNG, and race state machine

- **Depends on:** TASK-003.
- **Owns:** `packages/simulation/src/random/**`, `state/**`, `events/**`, `race/kernel/**` and tests.
- **Requirements:** FR-004, FR-006, QR-001–QR-002.
- **Steps:** `pure-rand` port/labeled states; legal/illegal phase tables; canonical serialization/hash; transition/checkpoint/idempotency result types; deterministic baseline start/lap/finish without advanced race systems.
- **Verify:** `npm run test:kernel && npm run test:determinism`; CI runs `npm run test:determinism` on both target architectures.
- **Pass:** illegal commands consume no RNG/events; uninterrupted and resumed hashes match.
- **Rollback:** revert pre-persistence task; later changes require new simulation ruleset.

## TASK-006 — Race preparation: qualifying, weather, tyres, and pits

- **Depends on:** TASK-004, TASK-005.
- **Owns:** `packages/simulation/src/race/{qualifying,weather,tyres,pits}/**` and named fixtures.
- **Requirements:** corresponding FR-005 systems, FR-011.
- **Verify:** `npm run test:race-preparation`; matched-seed fixtures for dry/mixed/wet, grid ties/penalties, warm-up/wear, strategy/pit timing.
- **Pass:** section 8 domain-rule rows for these systems pass with valid events/checkpoints.
- **Rollback:** revert task/ruleset before persistence; otherwise increment ruleset and preserve fixture.

## TASK-007 — Race incidents/control and commentary

- **Depends on:** TASK-006.
- **Owns:** `packages/simulation/src/race/{battles,failures,crashes,penalties,safety,form}/**`, `commentary/**`.
- **Requirements:** remaining race-side FR-005 systems including in-race rider form/fitness, FR-007, FR-013 race-side behavior.
- **Verify:** `npm run test:race-incidents && npm run test:race-form`; golden commentary/fallback; multi-rider incident, failure, penalty issue/application, safety restart, injury diagnosis, form/fitness pace-impact fixtures.
- **Pass:** every incidents/control/commentary/in-race-form row owned by this task has a named passing fixture; commentary cannot alter race hash. Between-race recovery/decay and career/development rows remain TASK-008/009 gates.
- **Rollback:** ruleset/template version process.

## TASK-008 — Career: contracts, rosters, injuries, entry, and exit

- **Depends on:** TASK-004, TASK-005, TASK-007.
- **Owns:** `packages/simulation/src/career/{contracts,rosters,injuries,entrants,form}/**`.
- **Requirements:** FR-012–FR-014 and between-race/season form-fitness recovery/decay portion of FR-005.
- **Verify:** `npm run test:career && npm run test:career-form`; branch fixtures for renewal/transfer/vacancy/substitute/withdrawal/minimum grid, injury/recovery, form/fitness recovery/decay, every exit reason, tie-breaks, season-transition retry.
- **Pass:** no overlap/double signing/duplicate or unavailable starter; exact idempotent phase replay; form/fitness recovery and decay stay within ruleset bounds and emit canonical events.
- **Rollback:** new ruleset once persisted.

## TASK-009 — Sponsorship, budget, development, and balance harness

- **Depends on:** TASK-004, TASK-005, TASK-008.
- **Owns:** `packages/simulation/src/career/{sponsors,budgets,development}/**`, `tools/balance/**`, `docs/balance/**`.
- **Requirements:** FR-015–FR-016 and the domain-rules simulation balance profile; QR-008 remains TASK-016 production benchmarking.
- **Verify:** `npm run test:career-economy`; `npm run balance:report` over ≥1,000 seeded seasons.
- **Pass:** all fixed domain-rule section 9 bands/invariants pass or Luke accepts a documented spec/ruleset amendment reviewed independently.
- **Rollback:** ruleset amendment; never tune tests to first output silently.

## TASK-010 — SQLite schema, migrations, canonical store, and rebuild

- **Depends on:** TASK-003, TASK-005, TASK-007, TASK-008, TASK-009 accepted event contracts.
- **Owns:** `packages/database/**`, `drizzle/**`, migration metadata/fixtures.
- **Requirements:** QR-003, DATA-001–DATA-004, DATA-006, OPS-007 persistence portion. DATA-005 backup/restore is completed by TASK-015.
- **Verify:** `npm run test:db`; `npm run test:migrations`; failure injection for duplicate/divergent/gap; two-season rebuild; partial migration; paused-owner/takeover fence.
- **Pass:** atomic events/commentary/checkpoint/projections; all operations-contract sections 2, 4, 5 data cases pass.
- **Rollback:** migration-declared strategy plus fresh backup; no ad-hoc reverse SQL.

## TASK-011 — Durable scheduler/recovery and service composition

- **Depends on:** TASK-005, TASK-009, TASK-010.
- **Owns:** `apps/server/src/{bootstrap,scheduler,orchestrator}/**`.
- **Requirements:** FR-002–FR-004, FR-021, OPS-004–OPS-005, OPS-007.
- **Verify:** `npm run test:scheduler`; fake-clock DST/ordinal/season tests; downtime 1/2/24/25/168/169; suspension/resume; signal boundary tests.
- **Pass:** immutable formula, one active race, sequential recovery, backlog suspension, exact phase retries, no stale-owner publication.
- **Rollback:** disable scheduler through config and revert application commit; persisted schema compatibility remains governed.

## TASK-012 — Hono service, config, logs, metrics, and health

- **Depends on:** TASK-002, TASK-003, TASK-010, TASK-011.
- **Owns:** `packages/observability/**`, `apps/server/src/{app,config,health,logging,metrics}/**`.
- **Requirements:** INT-005, OPS-001–OPS-005, SEC-002 app-level HTTP portion and SEC-003–SEC-005. TASK-012 owns HTTP concurrency, proxy trust, Origin/CORS, security headers/CSP/HSTS, source-map/error policy; OPS-006 is TASK-015.
- **Verify:** `npm run test:server`; hostile IDs/errors/configs; randomized metric cardinality; read/simulation health transitions; second-signal/grace.
- **Pass:** operations-contract sections 3 and 7 app-level controls plus sections 8–11 pass; no production claim beyond observed tests.
- **Rollback:** prior compatible image/config; no DB behavior change in this task.

## TASK-013 — Read-only tRPC queries and tracked live subscription

- **Depends on:** TASK-002, TASK-003, TASK-010, TASK-012.
- **Owns:** `apps/server/src/trpc/**`, router/API integration tests.
- **Requirements:** FR-017–FR-018, QR-004–QR-005, SEC-001 and SEC-002 tRPC/SSE portion, INT-004. TASK-013 owns tRPC batch/query concurrency, pagination/cursors, procedure inventory, SSE caps/queues/reconnect.
- **Verify:** `npm run test:transport`; route/procedure inventory; malformed/batch/page/output limits; catch-up high-water race; cursor errors; slow consumer/abort/proxy.
- **Pass:** no mutation/admin/debug route; all limits and reconnect semantics pass on selected adapter.
- **Rollback:** revert public API commit before clients; later contract changes follow compatibility ADR.

## TASK-014 — Spectator web app

- **Depends on:** TASK-003 and TASK-002 for mocks; TASK-013 for live E2E.
- **Owns:** `apps/web/**`, `docs/design/**`, visual/E2E fixtures.
- **Requirements:** FR-008–FR-009, QR-006–QR-007, INT-004.
- **Verify:** `npm run test --workspace @apex-hour/web`; `npm run test:e2e`; axe; keyboard/reduced-motion; 1440×900 and 390×844 screenshots; reconnect/recovered/suspended/empty states; browser console clean.
- **Pass:** The Night Ledger IA and accessibility acceptance are reviewed; no copied racing-series assets/trade dress.
- **Rollback:** static frontend rollback independent of compatible API.

## TASK-015 — Docker image, backup/restore, and deployment example

- **Depends on:** TASK-010, TASK-012–TASK-014.
- **Owns:** `Dockerfile`, `.dockerignore`, `deploy/**`, `scripts/{backup,restore-test,container-test}.mjs`, image workflow, runbooks.
- **Requirements:** FR-020, SEC-006, DATA-005, OPS-004–OPS-006.
- **Verify:** `npm run test:container`; non-root/read-only root/no capabilities; `/data`/`/backup`; UID/GID; health without curl; restart/SIGTERM; backup fresh-volume restore/cutover; execute native SQLite on amd64/arm64; SBOM/scan.
- **Pass:** every operations-contract section 6/12 item has observed evidence.
- **Rollback:** prior compatible image and retained old volume; migration point-of-no-return enforced.

## TASK-016 — Resilience/performance baseline and public-v1 acceptance

- **Depends on:** TASK-009–TASK-015.
- **Owns:** `tests/{e2e,resilience}/**`, `tools/benchmark/**`, `docs/{benchmarks,runbooks,reviews}/**`, traceability evidence columns.
- **Requirements:** all Must and documented Should dispositions.
- **Verify:** `npm run test:e2e`; `npm run test:resilience`; `npm run benchmark`; `npm run check:release`.
- **Pass:** accelerated full seasons, faults/restarts/disk/restore/load, performance report, independent product/engineering/security/operations/visual reviews, and every traceability row observed. Luke accepts public v1.
- **Rollback:** no automatic rollback of evidence or history; a failed gate keeps release status unaccepted, records observed failure, and returns the owning requirement to its earlier TASK for a new reviewed commit/ruleset/migration as applicable.

## Ralph iteration contract

`.ralph/prd.json` decomposes the currently Ready task further. Each fresh process selects one dependency-ready story, obeys allowed paths, runs exact checks, records observed evidence in `.ralph/progress.md`, and commits only on success. Defaults: eight iterations, one task/iteration, two attempts/task, 30 minutes/iteration, mandatory Hermes review after at most three passed stories. Completion requires acceptance checks, commands, authorized paths, a new verified commit, and a clean tree—not textual `DONE`.
