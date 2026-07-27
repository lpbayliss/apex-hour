# Apex Hour domain rules

**Status:** Accepted normative annex

This annex resolves product semantics delegated by [`specification.md`](specification.md). Where it conflicts with descriptive examples, this annex wins. Numeric balance bands are initial product acceptance ranges and may change only through a reviewed ruleset amendment.

## 1. Time, slots, and recovery

### 1.1 Schedule invariants

- A season owns exactly 24 schedule rows with ordinals 1–24.
- `universeStartInstant` is the immutable first-season start instant resolved from the configured local anchor and IANA timezone when the universe is created; it is not the earlier database/entity creation timestamp. `seasonStartInstant(1) = universeStartInstant`.
- `plannedStart(ordinal) = seasonStartInstant + (ordinal - 1) × 3,600 seconds`.
- `nextSeasonStart = currentSeasonStart + 24 × 3,600 seconds`. Season transition consumes no schedule time.
- The configured IANA timezone converts the configured local anchor into `seasonStartInstant` and labels the season. Elapsed UTC instants control cadence. DST may skip/repeat wall-clock labels but never creates or removes a race.
- `plannedStart` is immutable. `actualStartedAt`, `finalizedAt`, and `publicationMode` (`live` or `recovered`) are separate facts.
- At most one race slot may be claimed, preparing, live, finalizing, suspended, or recovering. v1 never runs races concurrently.
- Valid configuration guarantees live logical duration is less than 3,600 seconds.

### 1.2 Overdue policy

Apex Hour never skips a scheduled race and never changes its outcomes merely because the process was offline.

1. If no active slot exists, claim the oldest overdue planned slot.
2. Simulate it sequentially in **recovery publication mode** at compute speed rather than wall-clock presentation speed.
3. Preserve its planned logical timeline and record actual publication timestamps separately.
4. Persist/publish recovered batches in canonical sequence; clients label them recovered and may replay immediately without artificial sleeps.
5. Finish that slot before claiming another. Newly due slots remain overdue.
6. Once no overdue slot remains, the next non-overdue race uses live pacing.

Recovery turns are bounded by both configurable event count and event-loop CPU budget. Initial defaults are 100 canonical events and 25 ms per turn; the orchestrator yields after either limit. A transaction contains at most one bounded event batch. Defaults may be tuned only after benchmark evidence and must remain below the demonstrated shutdown budget.

The default maximum recoverable backlog is 168 slots. When the oldest unfinalized backlog exceeds that hard operator-configured limit, the scheduler enters `backlog_suspended`, stops claims, keeps historical read APIs available, and reports a durable alert. Raising the limit or repairing state is an operator configuration/restart action, not a public API.

Backlog includes unmaterialized future seasons. At startup, compute the global number of due slots from `floor((now - universeStartInstant) / 3,600s) + 1`, capped below at zero, then subtract globally finalized slots. If that derived backlog exceeds the limit, suspend before recovering the first season. Future season rows are materialized deterministically as each preceding transition completes; the derived count remains authoritative for the 25/168/169 cases.

Downtime acceptance scenarios cover 1, 2, 24, 25, 168, and 169 overdue slots.

## 2. State machines

### 2.1 Race-slot execution state

| Current | Command | Guard | Next | Canonical event |
|---|---|---|---|---|
| `planned` | claim | oldest eligible slot; valid fencing token | `claimed` | `race.claimed` |
| `claimed` | prepare | inputs/catalog/ruleset available | `preparing` | `race.preparation_started` |
| `preparing` | complete preparation | valid grid and checkpoint | `live` | `race.started` |
| `live` | advance batch | checkpoint/ruleset/fence valid | `live` | batch events |
| `live` | complete race | finishing condition reached | `finalizing` | `race.finish_reached` |
| `finalizing` | finalize | result/invariants valid | `completed` | `race.finalized` |
| `claimed`/`preparing`/`live`/`finalizing` | suspend | invariant or operational cause recorded | `suspended` | `race.suspended` |
| `suspended` | resume | cause cleared; identical ruleset/catalog/checkpoint/fence | prior resumable state | `race.resumed` |

`completed` is terminal. `suspended` records `resumeState`, reason code, last checkpoint, and required operator condition. There is no `recovered` domain state: recovery is execution/publication metadata. Illegal transitions fail without consuming RNG or appending events.

### 2.2 Race domain phase

`scheduled → preparing → formation → racing → finishing → finalized`

The execution state may suspend any nonterminal domain phase. Domain commands declare legal phases; transition-table tests must reject every other phase/command pair.

### 2.3 Season transition

After race 24 finalizes, a durable season-transition row has execution status `idle | running | suspended | completed`, a current phase, prior checkpoint, and suspension reason. It advances exactly once through:

1. `results_finalized`
2. `awards_recorded`
3. `injuries_advanced`
4. `market_resolved` (exogenous retirement, career-injury, personal, and sustained-performance exits become effective; new eligible entrants become effective)
5. `contracts_resolved`
6. `reserve_pool_replenished`
7. `rosters_validated`
8. `sponsorships_resolved`
9. `development_resolved`
10. `next_schedule_created`
11. `completed`

Each phase has a deterministic idempotency key and completion event. Restart resumes the first incomplete phase. Repeating an exact completed phase is a no-op. Divergent output emits `season.transition_suspended`, records the failed phase/checkpoint, sets simulation health `transition_suspended`, and blocks race claims. `season.transition_resumed` is legal only after the cause is corrected and the identical ruleset/catalog/checkpoint is restored; it resumes the recorded phase. `completed` is terminal.

During `contracts_resolved`, end any seat contract whose rider exited in `market_resolved`, resolve offers/seats, then emit `rider.exited(reason=contract_market_failure)` only for unsigned riders who also fail deterministic reserve/free-agent eligibility. Those late exits occur before `reserve_pool_replenished` and `rosters_validated`; no exit is permitted after final roster validation.

## 3. Deterministic transition contract

The normative transition shape is:

```text
validated state + command/logical tick + immutable ruleset/catalogs + RNG stream states
→ new state + ordered canonical events + new RNG stream states
```

- Use `pure-rand` behind `RandomSource`.
- Stable labeled streams include qualifying, weather, each rider, incidents, strategy, commentary, contracts, sponsors, development, and entrants/exits.
- Every transition returns all advanced stream states; retries begin from the last committed checkpoint, never partially advanced memory.
- A checkpoint atomically stores full race/transition state, PRNG algorithm/version, each stream's serialized state/cursor, logical tick/offset, last stream sequence, ruleset/catalog hashes, and simulation fencing generation.
- A stable step idempotency key derives from aggregate stream, prior checkpoint sequence, logical tick/phase, command kind, and ruleset hash.
- Exact duplicate append returns the prior committed result. Divergent duplicate or sequence gap suspends processing.
- Canonical serialization uses RFC 8785 JSON Canonicalization Scheme through the maintained `json-canonicalize` package. Validation normalizes all strings to Unicode NFC, forbids `undefined`/non-finite numbers, distinguishes explicit `null` from absent optional fields, uses safe integers or documented fixed-scale integer units, and preserves schema-defined array order (arrays are never implicitly sorted). SHA-256 over the resulting UTF-8 bytes is the replay hash.
- Checkpoint-at-every-tick property tests compare resumed continuation with uninterrupted execution on `linux/amd64` and `linux/arm64`.

`simulationRulesetVersion` controls outcomes. `commentaryTemplateVersion` controls prose only. A commentary-only update cannot alter canonical race hashes.

## 4. Canonical event contract

### 4.1 Envelope

Every canonical event has:

- `eventId`: deterministic `<aggregateKind>/<aggregateId>/<streamSequence>`;
- `aggregateKind`: `universe | season | race | rider | team | manufacturer | sponsorship | component`;
- `aggregateId` and positive `streamSequence`;
- optional `universeId`, `seasonId`, `raceId`, `riderId`, `teamId`, `manufacturerId` context;
- `eventType`, `schemaVersion`, `simulationRulesetVersion`, and `catalogVersion`;
- `logicalTime` and optional `plannedInstant`;
- `commandId`, `idempotencyKey`, optional `causationEventId`, and `correlationId`;
- validated payload.

A database-assigned `publicationSequence` gives total canonical commit order for subscriptions/read models but is not used to calculate outcomes. The canonical store covers all aggregate kinds; `race_events` may be a physical optimized table/view but cannot be the only canonical stream. Team credit/debit events live on the owning `team` stream and manufacturer credit/debit events on the owning `manufacturer` stream.

### 4.2 Cursor behavior

- Aggregate `eventId` and live-feed cursor are distinct. For each race-context canonical event, persistence creates exactly one durable `race_feed_item` at that event's publication sequence. The item bundles the public state/event projection and zero-or-more commentary lines ordered by their line ordinal. `race.live` emits that whole item once with tracked SSE ID `race/<raceId>/publication/<publicationSequence>`. Catch-up queries those items by `publicationSequence`, so rider/team/race aggregates share one order, multiple commentary lines cannot be split across a cursor, and gaps caused by unrelated publications are valid.
- A cursor for another race or malformed scope returns `EVENT_CURSOR_INVALID`.
- A cursor publication sequence above the captured race-feed high-water mark returns `EVENT_CURSOR_AHEAD`.
- A cursor no longer retained would return `EVENT_CURSOR_EXPIRED`; v1 retention means this is reserved but tested.
- Exact duplicate projections are ignored by clients by tracked cursor/projection ID; divergent duplicates are server corruption. Aggregate history endpoints may separately paginate by aggregate `eventId`/`streamSequence`.

### 4.3 Required v1 event families

- Universe/catalog: created, catalog pinned, ruleset pinned.
- Season: created, started, phase completed, transition suspended/resumed, standings finalized, awards recorded, finished.
- Race lifecycle: scheduled, claimed, preparation started, prepared, qualifying completed, grid finalized, started, phase changed, suspended, resumed, finish reached, finalized.
- Race progress: sector/lap completed, position changed, overtake completed, gap updated, fastest lap, rider pitted, tyre allocation fitted/retired.
- Incidents/control: weather changed, crash, retirement, mechanical failure, penalty issued/served/applied, safety period started/ended.
- Rider/career: entered, contract offered/signed/renewed/expired/ended, transferred, form changed, fitness changed, popularity changed, injury diagnosed/prognosis updated/recovered, unavailable/available, exited.
- Sponsorship: offered, signed, renewed, expired, ended/conflict rejected, budget credited.
- Development: proposal created, funded, completed, component version created, allocation changed, version retired.
- Team/component: budget debited/credited, machine allocation confirmed, component wear updated, tyre wear updated, tyre set fitted/retired.

Every mutable field in a release-v1 projection must trace to at least one canonical event. A two-season rebuild from genesis is a release gate.

## 5. Commentary projection

- Commentary input is the candidate canonical event batch plus prior persisted commentary projection state.
- Generate deterministic commentary lines and fallback lines before commit.
- Atomically commit canonical events, commentary projection rows, projection state, and checkpoint; publish only committed public projections.
- Commentary lines have stable IDs derived from source event ID and line ordinal, source event references, logical order, category, importance, template version, and rendered text. All lines for one source event are embedded in that source event's single durable race-feed item.
- Rebuild uses the same template version material packaged with immutable history. Template material, not only its hash, must remain available.

## 6. Rider, roster, and career invariants

### 6.1 Initial public-v1 fixture

- 12 fixed fictional teams, each with two race seats; target grid 24.
- Teams and manufacturers do not enter or exit in v1. Rider entry/exit is in scope; team/manufacturer lifecycle is deferred.
- Maintain at least eight eligible free-agent/reserve riders at each season boundary.
- Minimum race grid is 12. Below 12 eligible starters, preparation suspends the race; it does not generate silent replacements or fake results.

Counts are ruleset data and may change only at a season boundary under a new ruleset.

### 6.2 Contracts and transfers

- A rider may hold at most one active race-seat contract for any effective race interval.
- Contracts have team, seat, start season/race, end season/race, compensation, status, and deterministic offer/decision evidence.
- Normal contracts become effective only at season boundaries. Emergency substitute contracts may cover explicit race ordinals and cannot overlap another active seat.
- At transition, every expiring seat resolves exactly once to renewal, transfer/new signing, substitute promotion, or vacancy.
- Candidate ranking uses ruleset score then stable rider ID as final tie-break; no iteration-order tie-break.
- A rider cannot sign while unavailable past the proposed term start unless the contract explicitly permits delayed activation and a substitute.

### 6.3 Injuries and substitutions

- An in-race injury affects the rider immediately for retirement/fitness events and future availability; already completed classification is not rewritten except by race-control penalty rules.
- Injury stores cause, severity, diagnosed event, expected recovery window, current availability, and prognosis version. Recovery checks occur at race preparation and season transition using deterministic streams.
- An unavailable contracted rider retains contract ownership. The team selects an eligible reserve/free agent for an explicit substitute term.
- If no candidate exists, that entry is withdrawn. The race proceeds with remaining eligible entries only when grid ≥12; otherwise it suspends.

### 6.4 Entry and exit

- New riders may enter the free-agent pool only at season transition, except deterministic emergency academy generation required to restore the next-season reserve minimum.
- Existing riders may exit at transition for retirement, sustained performance, career injury, contract market failure, or personal decision. Every exit records one primary reason and contributing facts.
- Exited riders remain immutable historical entities and cannot silently re-enter; a return would require a future explicit event/rule. `contract_market_failure` is determined only in the contracts phase as described in section 2.3, not in the earlier market phase.

## 7. Sponsors, budgets, and development

- Team sponsorships credit that team's integer **development-credit account** and may affect team popularity/narrative. Rider sponsorships affect rider popularity/narrative only and do not create a spendable rider budget. Sponsors never directly add pace, grip, or reliability.
- Teams and manufacturers each own separate development-credit ledger aggregates. Manufacturer accounts receive ruleset-defined season/supply grants; team accounts receive ruleset-defined participation/result/team-sponsor grants. Sources and debits are canonical events; negative balances and cross-owner implicit spending are forbidden.
- One entity may have at most one active sponsor per exclusivity category. Conflicts resolve by accepted offer score, then sponsor ID; rejected conflicts emit evidence.
- Sponsorship value, duration, appeal requirements, and category are ruleset/catalog data.
- Development proposals name the owning/funding team or manufacturer account, target component, credit cost, expected bounded attribute deltas, reliability trade-off, completion boundary, and source ruleset. The same owner ledger is debited atomically when funded.
- An upgrade may become effective only before race preparation begins; otherwise it moves to the next race. It is immutable once effective. Prior versions remain available for replay/history.
- Component allocation changes emit canonical events and cannot rewrite a prepared race.
- Tyres are modeled separately as: manufacturer/specification (versioned catalog), per-race consumable allocation, fitted set, and wear state. Tyres are not generic durable component versions.

## 8. Race-system minimum playable depth

Public-v1 must demonstrate all of these in deterministic scenario fixtures:

| System | Minimum accepted behavior |
|---|---|
| Qualifying | rider/machine/weather produce grid; penalties may alter it; ties stable |
| Weather | at least dry, mixed, wet; changes affect tyres/pace/crash risk |
| Tyres | specification, selection, warm-up, wear, wet suitability, replacement |
| Pit strategy | tyre/weather-driven stop decision and time loss; no mandatory dry stop unless ruleset says so |
| Failures | component-specific reliability/wear event and retirement/degradation outcome |
| Crashes/injury | single and multi-rider incidents; retirement and prognosis branches |
| Penalties | grid/time/ride-through-style effects with issue, service/application, result impact |
| Safety periods | start/end, neutralized behavior, restart, no overtaking where forbidden |
| Rider form/fitness | changes pace/consistency within bounded rules and recovers/decays |
| Contracts/career | every branch in sections 6–7 has a fixture |
| Development | funded upgrade changes only permitted future allocations |

## 9. Initial balance acceptance profile

The first balance spike runs at least 1,000 complete 24-race seasons over a fixed published seed suite and reference 12-team/24-rider catalog. Luke Bayliss is product acceptance authority; an independent reviewer verifies calculations. Before public-v1, results must satisfy or receive a documented spec amendment:

- race finisher share: 70–98% for at least 90% of reference races;
- crash retirements: median 0–2 riders/race and 95th percentile ≤5;
- mechanical retirements: median 0–1 and 95th percentile ≤4;
- matched wet-transition fixtures increase wet-tyre selection by at least 40 percentage points over matched dry fixtures; wet crash-retirement rate is at least 20% relatively higher and its paired bootstrap 95% confidence interval for the difference is above zero;
- at least three distinct race winners in ≥90% of seasons and at least two teams win in ≥95%;
- champion win share: 10–60%; top-three championship points share: 35–75%;
- at least 5% and at most 40% of race seats change holder between seasons;
- injury absence consumes 0–15% of rider-race entries across the suite;
- sponsor changes affect 5–50% of sponsored entities per transition;
- no negative budget, overlapping active seat contract, duplicate starter, unavailable starter, impossible grid position, or invalid event transition;
- increasing one rating by 10/100 in matched-seed one-at-a-time ablation must move its mapped mean outcome without changing unrelated random streams: pace→lower lap time/better classification; qualifying→better grid; racecraft→more successful passes/better classification; consistency→lower lap-time variance and incident rate; aggression→more pass attempts with non-decreasing incident risk; wet skill→better wet classification; tyre management→lower matched-stint wear; fitness→lower late-race pace loss; adaptability→better mixed-condition classification; feedback→lower setup error and higher development evaluation accuracy; popularity→more/higher-value eligible sponsor offers. Classification is numeric 1..grid size, with DNFs ordered after finishers by distance completed then stable rider ID. Sensitivity share applies only to the eight direct classification ratings (pace, qualifying, racecraft, consistency, wet skill, tyre management, fitness, adaptability) and is `abs(mean classification delta) / sum(abs(delta) across those ratings)`; a zero denominator fails the suite and no rating may exceed 50%;
- a funded component upgrade's mean benefit remains inside its declared bounded delta and cannot affect a race prepared before its effective boundary.

A failure is tuning evidence, not a reason to weaken the harness. Accepted ruleset reports are committed under `docs/balance/<ruleset>/`.

## 10. Data classification and version boundaries

| Data | Mutability/effective boundary |
|---|---|
| Algorithm code | image/ruleset version; immutable for started history |
| Tuning tables | immutable ruleset material; new season only |
| Identity/profile catalogs | immutable version pinned at universe/season creation |
| Commentary templates | immutable template version; may change independently for future lines/seasons |
| World/season/rider/team state | mutable only through canonical events |
| Operational config | may change on restart; cannot alter outcomes |
| Presentation pacing | may change on restart; affects publication timing only |

Canonical material is stored or packaged by content hash so replay does not depend on a mutable current file.

## 11. Empty and degraded scenarios

The UI/API must cover:

| State | API/status contract | UI contract |
|---|---|---|
| pre-universe bootstrap | `system.status=starting`; current season/race return `NOT_INITIALIZED` | setup-in-progress message; retry only |
| pre-season countdown | upcoming race with planned instant; no classification | countdown and season context |
| intermission | last result plus next planned race; `race.current=null` | result summary and next countdown |
| no active race | `race.current=null`, simulation health `live`, next race present | neutral “between races” state, not error |
| overdue unclaimed | next race marked overdue; health `recovering` | delayed/recovery notice and last safe result |
| recovery publication | projections carry `publicationMode=recovered` | replay/recovered badge; no fake live animation |
| suspended race | stable `RACE_SUSPENDED` with safe historical snapshot | cause category, last checkpoint/progress, no countdown |
| suspended transition | health `transition_suspended`; prior history readable | season-processing delay and last final standings |
| catalog/config failure with history | readiness reason sanitized; safe history queries remain when schema permits | degraded banner; available history remains navigable |
