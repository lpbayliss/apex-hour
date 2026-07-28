---
title: Apex Hour production specification
status: accepted
owner: Luke Bayliss
reviewers:
  product: [Luke Bayliss]
  engineering: [independent specification review passed 2026-07-28]
  security_privacy: [independent specification review passed 2026-07-28]
  reliability_operations: [independent specification review passed 2026-07-28]
created: 2026-07-28
last_updated: 2026-07-28
related:
  - docs/research.md
  - docs/domain-rules.md
  - docs/operations-contract.md
  - docs/traceability.md
  - docs/implementation-plan.md
  - docs/reviews/2026-07-28-initial.md
  - docs/reviews/2026-07-28-followup.md
  - docs/reviews/2026-07-28-acceptance.md
---

# Apex Hour production specification

## 1. Decision summary

- **Problem:** Create a compelling, always-running fictional motorcycle-racing world that spectators can follow without managing a team or controlling the simulation.
- **Direction:** Build a TypeScript modular monolith: a deterministic, data-driven simulation package bootstrapped inside a Hono service, a read-only tRPC API with tracked SSE subscriptions, a Vite/React spectator UI, and SQLite persistence in one portable Docker image.
- **Experience:** A season contains exactly 24 races. A race starts every elapsed hour. Each race unfolds live as structured events projected into timing, classification, and a commentator-style feed.
- **Product name:** **Apex Hour**. The name connects racing lines with the hourly cadence without borrowing a real championship identity.
- **Current status:** Accepted after four independent review gates and disposition of every High/Medium finding.
- **Implementation readiness:** TASK-001 becomes Ready after this accepted governing scaffold is committed on `main` and a clean `feat/foundation` branch exists. TASK-002 depends on TASK-001 evidence. Later tasks remain dependency-gated; ADR-0004 remains Proposed until the transport spike passes.
- **Decision owner:** Luke Bayliss.

## 2. Accepted source decisions

| Decision | Status | Source |
|---|---|---|
| Private GitHub repository under `lpbayliss` | Fixed | User request |
| Spectator-only experience | Fixed | User clarification |
| All riders, teams, brands, circuits, sponsors, and manufacturers are fictional | Fixed | User clarification |
| Races unfold live and emit a commentator feed | Fixed | User clarification |
| Exactly 24 races per season; one begins every hour | Fixed | User clarification |
| Season timezone is configurable | Fixed | User clarification |
| Race systems include qualifying, weather, tyre wear, pit stops, failures, penalties, safety periods, rider form, contracts, injuries, sponsorships, and component development | Fixed product-release scope | User clarification (“Everything”) |
| No public simulation/admin controls in the first release | Fixed | User clarification |
| Configuration comes from environment variables and/or a YAML file | Fixed | User clarification |
| Configuration and application/domain contracts are Zod-first where practical | Fixed | User clarification |
| Hono, tRPC, TypeScript 7, Vite, Docker, and mounted SQLite | Fixed | User request |
| Autonomous implementation may begin after the specification, bounded by the readiness gates and Ralph safeguards in this document | Fixed | User clarification |

## 3. Context, users, and glossary

### 3.1 Primary audience

- Spectators following the current race and commentary.
- Spectators browsing standings, history, riders, teams, manufacturers, components, sponsors, and circuits.
- The operator deploying one container and maintaining its mounted database/configuration.
- Maintainers tuning the simulation and adding data without coupling domain rules to web infrastructure.

### 3.2 Glossary

- **Season:** exactly 24 ordered races generated from one season seed and ruleset version.
- **Race slot:** one elapsed-hour scheduling window containing pre-race preparation, a live race, result finalization, and intermission.
- **Logical time:** deterministic simulated time stored on domain events; it is not read directly from the wall clock by the simulation package.
- **Simulation ruleset version:** immutable identifier for algorithms, schemas, and tuning tables affecting deterministic outcomes. Commentary templates have an independent immutable version.
- **Domain event:** Zod-validated fact emitted by the simulation, such as `lap.completed`, `rider.crashed`, or `race.finished`.
- **Commentary projection:** spectator text generated from structured domain events; it is not the source of truth.
- **Component:** a versioned engine, chassis, aero package, electronics package, or brake system supplied by a fictional manufacturer. Tyres separately model manufacturer/specification, consumable race allocation, fitted set, and wear.

## 4. Goals, non-goals, and success

### 4.1 Goals

1. Make the live race legible and entertaining without user control.
2. Generate coherent long-running stories from rider contracts, transfers, sponsors, form, injury, development, rider entry/exit, and competitive results. Team/manufacturer entry/exit is deferred from v1.
3. Make every outcome explainable through inputs, ruleset, seed, and emitted events.
4. Keep simulation code deterministic and independent of HTTP, persistence, telemetry, process state, and wall-clock APIs.
5. Ship a portable, observable, recoverable single-container service.
6. Make content and balance primarily data-driven and runtime-validated.

### 4.2 Non-goals for the first public release

- Real-world championships, marks, people, teams, circuits, sponsors, or licensed data.
- Player-controlled teams, betting, voting, fantasy ownership, or simulation mutation APIs.
- Photorealistic 3D race visualization.
- Multi-replica simulation coordination or horizontal writes to one SQLite database.
- Native mobile applications.
- An LLM dependency for simulation or commentary.
- Real-money economy, purchases, or advertising integrations.

### 4.3 Observable success contracts

| Outcome | Pass condition | Evidence |
|---|---|---|
| Cadence | Every completed season contains race ordinals 1–24 exactly once, and adjacent planned start instants are 3,600 elapsed seconds apart | scheduler integration/property tests; production schedule metric |
| Determinism | Same seed + ruleset + validated inputs produce the same canonical event sequence and final state | golden replay and property tests |
| Live continuity | A disconnected spectator can resume from a persisted race-feed cursor without gaps while retained projections exist | integration/E2E reconnect test |
| Durability | Restarting the container with the same mounted volume preserves history and safely resumes or catches up active work | Docker restart test |
| Fictional universe | Seed/catalog validation rejects reserved real-world names configured by the project | content lint and review |
| Accessibility | Primary spectator flow meets WCAG 2.2 AA automated checks and keyboard acceptance | axe/Playwright plus manual keyboard review |
| Portability | The image runs as non-root on `linux/amd64` and `linux/arm64` with one writable mounted data path | CI image builds and smoke tests |
| Performance | Baselines are measured for simulation tick throughput, SSE fan-out, API latency, memory, startup, and image size before numeric production targets are accepted | delegated benchmark report; no invented threshold |

## 5. Scenarios

### 5.1 Live spectator

1. A spectator opens Apex Hour.
2. The app loads current season, active/upcoming race, classification, circuit/weather, and recent commentary through tRPC queries.
3. It subscribes to the active race using tracked tRPC SSE projections whose tracked ID is a race-scoped publication cursor, distinct from the canonical aggregate event ID.
4. Persisted catch-up events are yielded before live events without a race between database catch-up and subscription registration.
5. Timing, rider status, incidents, and commentary update from the same domain-event stream.
6. On disconnect, the client reconnects with the last tracked feed cursor and de-duplicates by feed cursor/projection ID.
7. After `race.finished`, the view transitions to results/standings and the next race countdown.

### 5.2 Race slot

1. The scheduler transactionally claims the next planned race.
2. The application derives a race seed from universe, season, race ordinal, ruleset, and circuit identifiers.
3. Pre-race logic resolves weather, rider availability, component allocation, form, qualifying, and grid.
4. The engine advances deterministic logical ticks/laps and emits validated events.
5. The application computes deterministic commentary/fallback projections and commits each ordered event batch, commentary, checkpoint, and projection updates atomically.
6. Only committed public projections are published to in-process subscribers.
7. The race finalizes classification, points, injuries, wear, penalties, and standings exactly once.
8. Intermission resolves post-race recovery/development and prepares the next slot.

### 5.3 Restart and catch-up

- On startup, migrations and config validation run before readiness.
- The scheduler reads persisted schedule/race state; it never trusts in-memory timers as authority.
- If an active race has missed logical events, the engine deterministically computes missing batches from its last persisted checkpoint and complete persisted RNG stream state.
- Catch-up is sequential, never skips an event/race, never overlaps races, and follows the bounded overdue policy in [`domain-rules.md`](domain-rules.md#1-time-slots-and-recovery).
- Historical planned/logical timestamps are preserved separately from actual publication; the UI labels recovered events rather than pretending they streamed live.
- Finalization and season rollover are idempotent.

### 5.4 Season transition

- Race 24 finalizes before the season closes.
- Awards, contract expiry, transfers, sponsorship renewal, injury recovery, rider entry/exit, team/component development, and next-season roster generation run through the durable exactly-once phase machine in `domain-rules.md` section 2.3.
- The next season receives a new seed derived from the universe seed and season ordinal.
- The previous season is immutable except for explicitly versioned repair migrations.

### 5.5 Error and degraded behavior

- Invalid config or catalog data: fail startup before readiness with path-specific Zod errors and secrets redacted.
- Database unavailable/locked beyond bounded retry: readiness fails; scheduler pauses; current SSE connections emit a service-status event if possible and close.
- Slow SSE consumer: bounded queue; disconnect with resumable last event ID rather than unbounded memory growth.
- Commentary projection failure: persist the domain event, record/metric the projection error, use a generic validated fallback, and continue the race.
- Simulation invariant failure: stop that race, persist `race.suspended` with diagnostic code, set simulation health to suspended while safe historical reads remain available, and require correction/restart; do not silently re-roll.
- Corrupt or incompatible schema/ruleset: refuse simulation startup; keep liveness distinct from readiness.

## 6. Requirements

Normative terms **MUST**, **SHOULD**, and **MAY** are used deliberately.

### 6.1 Functional (`FR-*`)

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| FR-001 | The system MUST generate a fictional initial universe containing riders, teams, circuits, sponsors, component manufacturers, contracts, and component allocations from validated data and a universe seed. | Must | seed integration/golden test |
| FR-002 | A season MUST contain exactly 24 unique ordered races. | Must | DB constraint + property test |
| FR-003 | Planned race starts MUST be separated by exactly 3,600 elapsed seconds; configured timezone controls season labels/boundaries, not interval arithmetic. | Must | scheduler property/integration test |
| FR-004 | Race-slot execution and race-domain phases MUST follow the legal transition tables in `domain-rules.md`; suspension/resume is execution state and recovered publication is metadata, not a domain phase. | Must | exhaustive legal/illegal transition tests |
| FR-005 | Each race MUST implement every race system and minimum accepted behavior in `domain-rules.md` section 8 before public-v1 acceptance. | Must | named deterministic fixtures + event coverage matrix |
| FR-006 | Every canonical event MUST use the general aggregate envelope, deterministic event ID, stream ordering, idempotency, version, logical-time, and validated-payload contract in `domain-rules.md` section 4. | Must | schema, append, ordering, cursor, rebuild tests |
| FR-007 | Commentary MUST be a deterministic projection of structured events with severity/category and optional rider/team references. | Must | golden projection tests |
| FR-008 | The spectator UI MUST show current race state, classification/gaps, lap/progress, weather, incidents, rider status, and chronological commentary. | Must | Playwright E2E |
| FR-009 | The UI MUST expose season standings, calendar/results, teams, riders, manufacturers/components, sponsors, circuits, and historical race detail. | Must | route/API E2E |
| FR-010 | Riders MUST have Zod-defined ratings including pace, qualifying, racecraft, consistency, aggression, wet skill, tyre management, fitness, adaptability, feedback, and popularity. | Must | schema/content tests |
| FR-011 | Team and machine performance MUST compose data-driven rider, team, engine, chassis, aero, electronics, brake, and tyre attributes without hard-coded brand special cases. | Must | simulation unit/property tests |
| FR-012 | Every expiring race seat MUST resolve exactly once to renewal, transfer/new signing, substitute promotion, or vacancy under the contract invariants in `domain-rules.md`. | Must | season-transition branch/invariant tests |
| FR-013 | Injuries MUST have severity, cause, start, recovery projection, availability impact, and recovery events; unavailable riders MUST not start. | Must | lifecycle/invariant tests |
| FR-014 | New riders MUST be able to enter and existing riders MUST be able to leave for deterministic, recorded reasons including retirement, performance, injury, contract outcome, or personal exit. | Must | transition tests |
| FR-015 | Sponsorships MUST link fictional brands to riders/teams using category, appeal criteria, duration, value/effect, and renewal state. | Must | schema/transition tests |
| FR-016 | Team/component development MUST produce versioned upgrades with cost/effect/reliability trade-offs and effective-season/race boundaries. | Must | development lifecycle tests |
| FR-017 | Public tRPC procedures MUST be read-only in v1. | Must | router contract/static test |
| FR-018 | The service MUST expose tracked SSE subscriptions that replay persisted events after `lastEventId` before continuing live. | Must | reconnect/race-window integration test |
| FR-019 | YAML-file and environment configuration MUST be supported with precedence defaults < YAML < environment, followed by one final Zod validation. | Must | config table tests |
| FR-020 | Operators MUST be able to run migrations and start the service through the image without a second service. | Must | container smoke test |
| FR-021 | Configuration MUST ensure the live logical race duration is shorter than the 3,600-second race interval; scheduling/recovery MUST enforce at most one active/recovering race and the overdue policy in `domain-rules.md`. | Must | config boundary, downtime matrix, scheduler property tests |

### 6.2 Quality (`QR-*`)

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| QR-001 | The pure simulation package MUST produce identical canonical events for identical validated inputs, seed, and ruleset on supported architectures. | Must | cross-architecture golden hashes |
| QR-002 | The simulation package MUST contain no imports from web, DB, telemetry, config, environment, wall-clock, filesystem, or process modules. | Must | dependency-boundary lint |
| QR-003 | A simulation batch MUST be transactionally persisted before publication. | Must | failure-injection integration test |
| QR-004 | Event streaming MUST use bounded per-client buffering and resumable disconnection instead of unbounded memory. | Must | slow-consumer test |
| QR-005 | API/stream error responses MUST expose stable public codes while contextual logs retain internal causes. | Must | contract tests |
| QR-006 | The UI MUST provide loading, empty, disconnected/reconnecting, recovered, suspended, and error states. | Must | component/E2E tests |
| QR-007 | The primary flow MUST satisfy WCAG 2.2 AA semantics, contrast, focus, keyboard, reduced-motion, and live-region behavior. | Must | axe + manual checks |
| QR-008 | Production baselines MUST be measured under a documented workload before numeric latency/memory/image-size SLOs are accepted. | Must | benchmark artifact |

### 6.3 Security and privacy (`SEC-*`)

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| SEC-001 | v1 MUST expose no simulation mutation or administrator endpoint. | Must | route inventory test |
| SEC-002 | The service MUST apply the public HTTP/tRPC/SSE limits, pagination, secure-header, same-origin, error-redaction, and route-inventory contract in `operations-contract.md`. | Must | boundary table + security integration tests |
| SEC-003 | Logs, metrics, API errors, and config diagnostics MUST redact configured secrets and filesystem-sensitive values. | Must | redaction tests |
| SEC-004 | YAML configuration MUST be treated as data only; no executable JavaScript/TypeScript config is allowed. | Must | parser test |
| SEC-005 | In production, SQLite, config, and backup paths MUST resolve inside configured allowlisted roots; only an explicitly named development-mode override may bypass this. | Must | config mode/path tests |
| SEC-006 | Dependency and container vulnerability scans MUST run in CI; accepted exceptions require documented expiry. | Must | CI evidence |

No spectator personal data or authentication is collected in v1. Standard transient network logs may include IP data at the hosting layer; application logs SHOULD avoid retaining raw IP addresses.

### 6.4 Data integrity and lifecycle (`DATA-*`)

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| DATA-001 | SQLite MUST use and verify the pragma, checkpoint, busy-deadline, disk-error, permission, and bounded-read policy in `operations-contract.md` section 5. | Must | startup/fault/checkpoint DB tests |
| DATA-002 | Unique constraints MUST prevent duplicate season/race ordinals, aggregate stream sequences, idempotency keys, phase completions, and finalization records. | Must | migration/append integration tests |
| DATA-003 | Released migrations MUST be immutable and satisfy the lock, compatibility, partial-failure, backup, and rollback/roll-forward contract in `operations-contract.md` section 4. | Must | migration hash/version/failure tests |
| DATA-004 | Canonical history MUST have no automatic deletion in v1 and MUST satisfy the capacity/free-space/paged-history contract in `operations-contract.md` section 13. | Must | retention/disk-full/history tests |
| DATA-005 | Backup and restore MUST satisfy `operations-contract.md` section 6, including a destination outside the live volume and fresh-volume restore rehearsal. | Must | container backup/restore/cutover test |
| DATA-006 | All release-v1 snapshots/projections MUST be rebuildable from retained canonical events plus stored immutable seed/ruleset/catalog/commentary material. | Must | genesis-to-two-season rebuild test |

### 6.5 Interfaces and compatibility (`INT-*`)

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| INT-001 | External input, config, tRPC input/output, domain command/event, and public projection schemas MUST use Zod; TypeScript types MUST be inferred when such a schema exists rather than separately duplicated. | Must | schema/export lint |
| INT-002 | Drizzle owns relational schema; `drizzle-zod` SHOULD derive runtime row/insert schemas where the DB boundary needs them. | Should | code review/tests |
| INT-003 | Domain events MUST carry schema, simulation ruleset, and catalog versions; commentary carries its independent template version. Compatibility MUST follow ADR-0007. | Must | compatibility fixtures |
| INT-004 | The web client MUST tolerate unknown additive event fields and show a safe fallback for unknown event types. | Must | compatibility test |
| INT-005 | The service MUST expose minimal `/health/live`, sanitized `/health/ready`, and a configurable Prometheus-compatible metrics endpoint under the trust boundary in `operations-contract.md` section 8. | Must | HTTP exposure/smoke tests |

### 6.6 Operations (`OPS-*`)

| ID | Requirement | Priority | Verification |
|---|---|---:|---|
| OPS-001 | JSON logs MUST use Pino with server-controlled request IDs, explicit background child contexts, bounded/redacted error causes, and relevant season/race/tick/event IDs. | Must | hostile-input log capture tests |
| OPS-002 | Metrics MUST include HTTP, SSE, scheduler/recovery, race/tick, event, invariant, SQLite/WAL/disk, and process measures named in `operations-contract.md`. | Must | registry/scrape/fault tests |
| OPS-003 | Metric names/labels MUST use executable finite allowlists; rider, race, event, request, seed, raw path, and error values MUST NOT become labels. | Must | randomized cardinality policy test |
| OPS-004 | `SIGTERM`/`SIGINT` MUST execute the ordered shutdown state machine and bounded synchronous-work contract in `operations-contract.md` section 11. | Must | signal/second-signal/grace process tests |
| OPS-005 | Read readiness and simulation health MUST follow the separate state contract in `operations-contract.md` section 3; recovery may remain read-ready but must be observable and block unsafe claims. | Must | startup/recovery health tests |
| OPS-006 | The image/deployment MUST satisfy the non-root, read-only-root, writable-path, signal, capability, UID/GID, healthcheck, and cross-architecture runtime contract in `operations-contract.md` section 12. | Must | per-architecture Docker runtime tests |
| OPS-007 | One active simulation writer MUST be enforced by an atomic generation-fenced lease; a stale former owner MUST be unable to commit or publish after takeover. | Must | paused-owner/takeover dual-process test |

## 7. Proposed design

### 7.1 Repository and runtime boundaries

```text
apps/
  server/       Hono bootstrap, tRPC adapter, scheduler, SSE, static frontend
  web/          Vite + React spectator application
packages/
  contracts/    Zod schemas for API, domain events, config-facing shared values
  simulation/   pure deterministic race/season engine and commentary projection
  database/     Drizzle schema, migrations, repositories, event store
  config/       defaults + YAML/env adapters + final Zod parse
  observability/Pino context, metrics registry, health/readiness
  testing/      fixtures/builders shared only by tests
```

One Node process serves API, subscriptions, metrics/health, static Vite assets, scheduler, and the bootstrapped simulation orchestrator. Package boundaries preserve separability without network/service boundaries.

### 7.2 Component responsibilities

| Component | Responsibility | Must not own |
|---|---|---|
| Simulation engine | deterministic state transitions and canonical events | clock, DB, HTTP, logs, metrics, scheduling |
| Race orchestrator | derive seeds, feed commands/ticks, persist batches, publish after commit | probability formulas or UI prose |
| Scheduler | durable hourly plan, claim, catch-up, season rollover orchestration | race outcome decisions |
| Event store/repositories | transactions, canonical events, snapshots/projections, migrations | simulation rules |
| tRPC router | read models, stable errors, tracked subscription contract | mutable simulation controls |
| Event hub | bounded in-process fan-out after commit | canonical storage |
| Commentary projector | deterministic text/category from events | authoritative race state |
| Web UI | spectator rendering, reconnect/de-duplication, route state | simulation truth |
| Config | source precedence and validation | implicit global reads inside packages |
| Observability | contextual logs, bounded metrics, readiness | domain decisions |

### 7.3 Simulation model

#### Inputs

- `UniverseConfig`, `Ruleset`, `SeasonState`, `RaceDefinition`, `CircuitProfile`, `WeatherState`, entries, machine allocations, rider/team/component state, and deterministic RNG state.
- All numeric ratings use documented bounded scales and Zod constraints. Content catalogs contain data, not executable formulas.

#### Core API

```ts
initializeRace(input, rngStates): RaceState + DomainEvent[] + RngStates
advanceRace(state, logicalTick, rngStates): RaceState + DomainEvent[] + RngStates
finalizeRace(state, rngStates): RaceResult + DomainEvent[] + RngStates
advanceSeason(state, completedRace, rngStates): SeasonState + DomainEvent[] + RngStates
```

The concrete API may be refined by tests, but it must remain pure and explicit about RNG and logical time.

#### Deterministic randomness

- Use the maintained `pure-rand` package behind a project-owned `RandomSource` port rather than implementing a PRNG.
- Derive sub-seeds by stable labeled hashing for qualifying, weather, each rider, incidents, and season transitions so adding one event path does not perturb unrelated streams.
- Persist complete labeled RNG stream state/cursors, algorithm identifier, ruleset/catalog hashes, checkpoint sequence, and logical tick atomically as specified in `domain-rules.md` section 3.
- Never use `Math.random()` in simulation packages; enforce with static checks.

#### Race phases

1. `scheduled`
2. `preparing`: availability, weather, tyre/component choice, qualifying/grid
3. `formation`
4. `racing`: start, laps/sectors, battles/overtakes, tyre/fuel/component state, pits, weather changes, incidents, penalties, safety periods
5. `finishing`: classification and unresolved penalty application
6. `finalized`: points, wear, injury, standings, development signals

Suspension/resume belongs to the separate race-slot execution state machine in `domain-rules.md` section 2, which defines every legal transition and terminal state.

#### Probability and performance

Each opportunity is resolved from bounded, documented factors rather than one opaque rating. Examples:

- lap pace: rider pace/form/fitness + circuit fit + engine/chassis/aero/electronics/brake/tyre state + team setup + weather + bounded noise;
- overtake: pace delta + racecraft/aggression + circuit overtaking profile + tyre/brake state + defending rider consistency;
- crash: baseline hazard × aggression × weather × tyre state × fatigue × circuit profile, reduced by consistency/wet skill;
- failure: component base reliability × accumulated wear × thermal/load profile × development effects;
- pit decision: tyre/weather projection + degradation + gaps + team strategy rating + safety state.

Exact coefficients are delegated tuning work. Monte Carlo reports must satisfy the fixed suite, distributions, sensitivity checks, and acceptance authority in `domain-rules.md` section 9 before public-v1 acceptance.

### 7.4 Domain events and commentary

The exhaustive release-v1 envelope, event families, ordering, idempotency, cursor behavior, and rebuild ownership are normative in `domain-rules.md` section 4. Core families include:

- universe/season: `season.created`, `season.started`, `season.finished`, `rider.entered`, `rider.exited`, `contract.signed`, `contract.expired`, `sponsorship.changed`, `component.upgraded`;
- race lifecycle: `race.scheduled`, `race.prepared`, `qualifying.completed`, `grid.finalized`, `race.started`, `race.suspended`, `race.resumed`, `race.finished`;
- progress: `lap.completed`, `position.changed`, `gap.updated`, `rider.pitted`, `tyre.changed`;
- incidents: `rider.crashed`, `rider.retired`, `mechanical.failure`, `penalty.issued`, `safety_period.started`, `safety_period.ended`, `weather.changed`;
- health: `rider.injured`, `rider.recovered`.

Canonical events are structured facts. Commentary templates consume committed candidate facts, importance, context, and persisted projection state. Events, deterministic commentary/fallback projections, checkpoint, and projection state commit atomically before publication. Commentary uses its own version and cannot change race outcomes.

### 7.5 Persistence model

Initial tables:

- `universe`, `ruleset_versions`, `catalog_versions`
- `seasons`, `season_races`, `circuits`
- `riders`, `rider_ratings`, `injuries`, `rider_career_events`
- `teams`, `team_memberships`, `contracts`
- `manufacturers`, `components`, `component_versions`, `team_component_allocations`
- `sponsors`, `sponsorship_contracts`
- `race_entries`, `qualifying_results`, `race_results`, `standings`
- `domain_events` (canonical aggregate streams with publication ordering and optimized race indexes/views)
- `race_checkpoints` (recovery acceleration)
- `scheduler_state`, `simulation_owner`
- `schema_metadata`

Writes for an event batch, checkpoint, commentary, and affected projections occur in one SQLite transaction. SSE uses stream-scoped durable cursors and a captured high-water mark before tailing the in-process hub.

### 7.6 Scheduling and timezone invariant

- The season has 24 elapsed-hour slots. Planned UTC starts are `season_start_instant + (ordinal - 1) × 3600s`; the next season begins at the prior season start plus 24 hours with zero schedule gap.
- The configured IANA timezone determines the local season label and configured local anchor. It never changes elapsed-hour spacing.
- On daylight-saving transitions, local clock labels may skip or repeat; Apex Hour preserves 24 races and 3,600-second spacing rather than forcing 23/25 races. The UI exposes unambiguous timezone offsets.
- Durable DB rows, uniqueness constraints, fenced claim/finalization transactions, and `domain-rules.md` state tables are authoritative. Process timers are only wake-up hints.
- In single-replica v1, the generation-fenced lease in `operations-contract.md` prevents a stale former owner from writing or publishing after takeover.

### 7.7 tRPC, Hono, and live transport

- Hono owns the Node server, middleware, health/metrics, static assets, and tRPC mount.
- tRPC v11 owns read procedures and subscription schemas.
- Use SSE because data is server-to-client and tRPC recommends it when WebSockets are unnecessary.
- Use `tracked(feedCursor, projection)` semantics. The tracked/SSE ID is `race/<raceId>/publication/<publicationSequence>`, not the aggregate `eventId`. Register the live listener before capturing/querying the high-water publication sequence to close the catch-up race.
- A bootstrap spike must prove the complete real-server/proxy/browser wire contract in TASK-002 and `operations-contract.md` section 7, including abort, heartbeats, buffering, reconnect, tracked IDs, duplicate suppression, bounded catch-up/queues, terminal errors, and Vite client integration on pinned supported versions. Prefer the official tRPC Fetch adapter mounted in Hono; adopt `@hono/trpc-server` only if it passes the same evidence with less glue.
- Public query procedures: `system.status`, `season.current`, `season.byId`, `race.current`, `race.byId`, `race.events`, `standings.current`, `rider.list/byId`, `team.list/byId`, `manufacturer.list/byId`, `circuit.list/byId`, `sponsor.list/byId`.
- Public subscription: `race.live({ raceId })`; transport reconnect supplies the last tracked SSE ID/feed cursor. A direct catch-up query may accept the same cursor schema.

### 7.8 Configuration

- `packages/config` defines one root Zod schema and inferred `AppConfig`; `operations-contract.md` section 9 defines merge, decode, validation, provenance, redaction, and path behavior.
- Defaults are code-owned and versioned.
- Optional YAML is parsed with `yaml` in failsafe/data-only mode.
- Environment mappings use the `APEX_HOUR__SECTION__KEY` convention.
- Precedence: defaults, YAML, environment; arrays replace rather than merge unless a schema documents keyed merge.
- Unknown keys fail by default. Startup prints a redacted effective-config summary and source provenance per field.
- No package reads `process.env` except the Node bootstrap/config adapter.

Required config groups: server, database path/pragmas, season timezone/anchor, race duration/tick pacing/catch-up bounds, seed/catalog, logging, metrics, SSE limits, shutdown grace, and backup paths.

### 7.9 Observability

- Pino JSON logs with server-controlled request IDs and explicit child context for HTTP and every background operation, following `operations-contract.md` section 10.
- Common log fields: service/version, environment, request ID, operation, season/race/tick/event IDs, ruleset, duration, outcome, and error cause/code.
- `prom-client` provides a Prometheus scrape endpoint in v1; OpenTelemetry trace export is optional/configured and may be added without replacing stable log/metric contracts.
- Metrics use bounded labels such as route template, method, status class, event family, race phase, and outcome.
- Read readiness, simulation health, endpoint exposure, label allowlists, and sanitized reasons follow `operations-contract.md` sections 3 and 8.

### 7.10 Frontend design

Original visual direction: **The Night Ledger**—a race-control timing sheet crossed with an independent sports journal. Use near-black graphite surfaces, warm paper-white text, one ember orange-red live accent, amber warnings, mineral-blue selected context, compact tabular numerals, restrained ruled/registration details, and generous negative space. Do not reproduce MotoGP/F1 logos, typography, exact layouts, broadcast components, or color systems.

Information architecture:

- **Live:** current race header/countdown, a signature race-pulse rail mapping start/cautions/lead changes/pit windows/finish, classification, focused rider card, weather/tyres/incidents, commentator rail.
- **Season:** standings, 24-race calendar, results and form.
- **World:** teams, riders, manufacturers/components, sponsors, circuits.
- **History:** season and race archive with event timeline.

Desktop gives roughly two-fifths to the running order and three-fifths to commentary/context. Commentary is an ordered list with event filters, pause/resume auto-follow, and “Jump to latest”; it must not steal scroll position while a spectator reads older entries. Mobile uses a five-item bottom navigation (`Live`, `Season`, `Teams`, `Riders`, `More`), keeps the race header/leader strip visible, and switches between `Order`, `Commentary`, and `Context` instead of stacking an indefinite desktop page. Deeper timing is horizontally scrollable without page overflow. Motion is subtle and disabled/reduced under `prefers-reduced-motion`. Commentary uses a polite live region for curated important updates only, not the full feed.

### 7.11 Docker and deployment

- Multi-stage build using a digest-pinned Node 24 LTS Debian slim image with an explicit update policy. Debian slim is preferred over Alpine because `better-sqlite3` native binaries and debugging portability outweigh a modest image-size saving.
- npm workspaces and a committed lockfile; builder installs/builds/tests, runtime receives production dependencies plus compiled server/web/migrations/catalogs.
- Non-root user; `/data` is the required writable database volume, `/backup` is a separate production backup mount, `/config/apex-hour.yaml` is read-only, and optional `/tmp` is bounded tmpfs.
- One exposed HTTP port; TLS/reverse proxy remains outside the container.
- OCI labels, Node-based healthcheck, runtime tests on `linux/amd64` and `linux/arm64`, SBOM, and vulnerability scan.
- SQLite is not safe for multiple active container replicas against one ordinary mounted file. v1 explicitly supports one replica.

## 8. Alternatives and ADR outcomes

| Decision | Selected | Alternatives rejected/deferred | Reason |
|---|---|---|---|
| Architecture | modular monolith with package boundaries | microservices; one undifferentiated package | matches one-container requirement while isolating simulation |
| Live transport | tRPC SSE with tracked IDs | WebSockets; polling; raw untyped SSE | one-way stream, reconnect support, simpler operations |
| Persistence | SQLite + Drizzle + `better-sqlite3` | Postgres; `node:sqlite`; custom SQL mapper | mounted single replica is accepted; mature driver; typed migrations; Node SQLite API not yet stable enough |
| Domain history | canonical event log + rebuildable projections/checkpoints | mutable state only; full general event-sourcing framework | deterministic replay/recovery without adopting a heavy framework |
| Randomness | `pure-rand` behind a port | `Math.random`; custom PRNG | deterministic maintained tool without domain coupling |
| Commentary | deterministic templates | external LLM; hard-coded prose inside engine | reliability, cost, replay, and separation |
| Runtime | Node 24 LTS | Bun; edge runtime | native SQLite, Docker portability, mature instrumentation |
| UI | React + Vite + TanStack Query + repo-owned accessible primitives | Next.js; custom state framework | user-fixed Vite, read-heavy SPA, lower server complexity |
| Configuration | Zod + `yaml` + explicit env mapping | executable config; bespoke parser | runtime safety and portable operations |

ADRs are stored in `docs/adr/`; each records status, owner, requirement/task links, and supersession rules. A Proposed ADR cannot be treated as accepted evidence.

## 9. Delivery and change safety

### 9.1 Development sequencing

The first vertical slice proves: validated config → one deterministic seeded exhibition race → SQLite events → Hono/tRPC query + tracked SSE → live React commentary/classification → Docker restart/resume. It is not called public-v1 until every `FR-005` fixture and the career/development scenarios in `domain-rules.md` pass.

### 9.2 Enable/disable and recovery

- `simulation.enabled` controls whether the scheduler claims new work; it is startup/operator config, not a public API.
- On disable, active transaction completes/rolls back; persisted races remain readable.
- Each major simulation feature is ruleset/data-controlled for staged development, but production ruleset versions are immutable once a race starts.
- Application rollback uses the prior image only when DB schema compatibility allows it. Forward-only migrations must state the oldest compatible image.
- Before an incompatible migration: stop simulation, online backup, integrity check, migration rehearsal, then apply. Restore is volume-level and loses post-backup events; that loss boundary must be explicit.

### 9.3 Capacity and resource protection

Delegated benchmarks establish supported events/race, clients, DB growth, and memory within the fixed 12-team/24-rider v1 fixture. Until measured, the service supports only the single-replica local-POSIX-volume topology in `operations-contract.md`, queues/pages are bounded, and configuration is upper-bounded by Zod.

## 10. Verification matrix

| Requirement group | Planned evidence | Command/location | Pass condition |
|---|---|---|---|
| Zod/config/contracts | unit and type tests | `npm run test --workspace packages/config`; `npm run typecheck` | precedence/unknown/redaction cases pass; no duplicate public types |
| Simulation determinism | unit, property, golden replay, cross-arch hashes | `npm run test --workspace packages/simulation` | invariants and identical event hashes pass |
| DB/migrations/recovery | migration and failure-injection integration | `npm run test:integration --workspace packages/database` | atomicity, uniqueness, rebuild, backup/restore pass |
| Scheduler | fake-clock property/integration tests | `npm run test:integration --workspace apps/server -- scheduler` | exactly 24 unique slots; restart/DST/catch-up pass |
| tRPC SSE | Node transport integration/E2E | `npm run test:integration --workspace apps/server -- transport` | reconnect no-gap/no-duplicate; abort cleanup; bounded slow consumer |
| UI | component, axe, Playwright | `npm run test --workspace apps/web`; `npm run test:e2e` | primary states, keyboard, responsive and reconnect flows pass |
| Observability | log/metric snapshots and process tests | `npm run test:integration -- observability` | context/redaction/bounded labels/readiness transitions pass |
| Docker | build, scan, startup, restart/restore | `docker build ...`; `npm run test:container` | non-root, health, mounted durability, graceful stop, arch builds pass |
| Whole repo | format/lint/type/test/build | `npm run check` | clean exit |

Planned evidence is not marked passed until the repository and commands exist and run.

## 11. Risks and unresolved work

### 11.1 Risks

| Risk | Impact | Mitigation / trigger |
|---|---|---|
| Simulation feels arbitrary or one attribute dominates | high | explainable factor events plus the fixed Monte Carlo/sensitivity acceptance profile in `domain-rules.md` section 9 |
| Hourly live work overlaps after slowdown/restart | high | immutable slots, one active race, sequential recovered publication, bounded turns, and backlog suspension per `domain-rules.md` |
| SQLite lock/growth/resource pressure | high | single writer, short batches, WAL/busy timeout, backups, growth metrics, load tests |
| SSE fan-out consumes memory | high | bounded queues, connection caps, disconnect/resume, low-cardinality metrics |
| Story repetition | medium | event-aware versioned template pools and repetition tests; later optional narration plugin |
| “Everything” scope delays playable feedback | high | vertical slice first, then deepen systems behind one accepted public-v1 gate |
| Trademark/trade-dress confusion | medium | fictional content lint and original visual system; no copied assets/marks |
| TypeScript 7/tool incompatibility | medium | bootstrap compatibility matrix; pin working versions; no downgrade without ADR/spec update |
| Native SQLite image portability | medium | Debian slim, lockfile, amd64/arm64 CI, runtime smoke tests |

### 11.2 Delegated questions

| Question | Class | Owner / artifact / decision rule |
|---|---|---|
| Which Hono/tRPC adapter reliably supports v11 tracked SSE on Node 24? | Delegated; TASK-002 gate | Engineering; `docs/spikes/trpc-hono-sse.md`; select only an adapter passing every real-server/proxy/browser case, otherwise supersede ADR-0004 |
| Which coefficients satisfy credible distributions? | Delegated; public-v1 gate | Luke Bayliss with independent calculation review; `docs/balance/<ruleset>/`; all fixed ranges/sensitivity checks in `domain-rules.md` pass or a spec amendment is accepted |
| What event pacing is legible within a sub-hour live race? | Delegated; UI/race gate | Luke Bayliss; `docs/design/race-pacing.md`; dense/sparse desktop/mobile fixtures pass accessibility and no-scroll-theft review |
| What performance, capacity, RPO/RTO, and image-size limits are realistic on reference hardware/storage? | Delegated; production gate | Engineering/operations review; `docs/benchmarks/<version>/` and restore rehearsal; measured 2-vCPU/1-GiB workload plus backup/restore evidence produces a reviewed SLO/RPO/RTO amendment |
| Which exact fictional content catalog ships? | Delegated; content gate | Luke Bayliss; `content/` plus `docs/content-review.md`; schema/content lint, collision search, and deterministic fixture review pass |

The focused independent follow-up review of product/domain, architecture/security/operations, and agent readiness is a **Blocking** specification gate. Findings and dispositions are recorded in `docs/reviews/`; no task may silently reinterpret an unresolved blocking item.

### 11.3 Deferred

Interactive ownership, voting, betting, multiplayer, real-time chat between spectators, LLM commentary, multi-replica writes, native apps, and real licensed data.

## 12. Autonomous implementation safety

A bounded Ralph-style loop may begin only for a task whose readiness/dependency gates are satisfied. Hermes must load the `bounded-ralph-loop` skill and execute the work itself in the current session using native tools; the skill is the harness. Shell loops, Claude/Codex CLIs, background coding agents, recursive Hermes processes, cron jobs, and delegated implementers are not valid execution paths.

For each story Hermes loads `AGENTS.md`, this specification, the implementation plan, `.ralph/prd.json`, and append-only progress; selects exactly one highest-priority dependency-ready story; obeys its allowed paths; implements and exercises the behavior; runs exact story and repository checks; records only observed evidence; and creates one small verified commit. Dispatch, generated scaffolding, empty modules, status edits, and prose claims do not count as implementation.

Default limits are at most three completed stories per user invocation, one story per commit, and two implementation attempts per story. Hermes reassesses repository state after each commit and stops for a decision, security boundary, destructive migration, data-loss risk, schema/public contract change, unavailable verification, unrelated dirty state, exhausted attempt limit, user interruption, or the three-story checkpoint. Push, merge, deploy, publish, force-push, history rewrite, test weakening, and unplanned dependency additions require separate authorization or an explicit accepted task.

## 13. Acceptance and maintenance

- Luke Bayliss is product acceptance authority.
- Independent product/domain, engineering/security/operations, and agent-readiness reviews passed on 2026-07-28; later implementation tasks still require their dependency/evidence gates.
- Implementation may revise delegated details through evidence, but fixed requirements need a recorded specification/ADR change.
- Update `last_updated`, change log, requirement/task traceability, and ADR links whenever behavior or architecture changes.

## 14. Change log

- 2026-07-28: Initial proposed specification from user decisions and official documentation research.
- 2026-07-28: Added normative domain/operations annexes, traceability, ADR-0006–0008, and review dispositions after the initial independent gate.
- 2026-07-28: Resolved follow-up cursor, transition, canonicalization, fencing, HTTP, migration, task-governance, and evidence findings.
- 2026-07-28: Final combined review passed; specification accepted. ADR-0004 remains transport-spike gated.
- 2026-07-28: Replaced the failed external-process Ralph harness with the native Hermes `bounded-ralph-loop` skill; clarified that only verified behavior, not scaffolding or dispatch, counts as execution.
