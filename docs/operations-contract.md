# Apex Hour operations and security contract

**Status:** Accepted normative annex

This annex defines the supported production boundary. It narrows portability claims to one service instance using a local POSIX-locking volume. It does not claim readiness until the required tests execute.

## 1. Supported topology

- One Apex Hour application/simulation writer process.
- One local SQLite database on a filesystem/volume driver with correct POSIX advisory locking and WAL semantics.
- NFS, SMB, object-store mounts, and simultaneous replicas on one database are unsupported unless separately qualified.
- Public world/catalog/race data is intentionally public. No personal spectator data or authentication is stored in v1.
- TLS, internet ingress, DDoS protection, and coarse network rate limiting belong to the reverse proxy/platform; the app still enforces local resource limits.

## 2. Simulation ownership and fencing

`simulation_owner` is a singleton row with `ownerId`, monotonically increasing `generation`, `leaseUntil`, and `updatedAt`.

- Acquisition/renewal uses an atomic immediate transaction and the database host clock.
- Initial defaults: 30-second lease, renewal every 10 seconds. Benchmark/fault tests may amend these values.
- Takeover increments `generation`.
- Every slot claim, event/checkpoint append, finalization, and publication verifies the current generation. Canonical commits append a durable outbox row carrying that generation. The publisher opens `BEGIN IMMEDIATE`, verifies the outbox generation is still current, synchronously enqueues the bounded in-process projection while takeover is blocked by that write lock, marks the outbox row delivered, and commits. Enqueue is non-awaiting and bounded; failure rolls back. Takeover can occur only before this transaction or after a valid enqueue, never between validation and enqueue.
- Losing ownership marks the process unready for simulation, stops computation at the next batch boundary, prevents publication, and cannot be repaired in memory.
- A paused old process resumed after takeover must fail its next fenced write/outbox transaction and must not publish. Fault tests pause at validation/enqueue boundaries and prove takeover ordering plus client de-duplication.
- Migrations complete before simulation lease acquisition. Migration locking is separate from simulation ownership.

## 3. Scheduler/readiness behavior

Slot/recovery semantics are in [`domain-rules.md`](domain-rules.md).

Health dimensions are separate:

- **Liveness:** process/event loop responds with minimal body.
- **Read readiness:** config is valid, schema compatible, DB readable, and public query service usable. Recovery mode may still be read-ready.
- **Simulation health:** `starting | live | recovering | backlog_suspended | race_suspended | transition_suspended | lease_lost | disabled | stopping` exposed through sanitized status and metrics.

`/health/ready` reports only read-service readiness. Simulation impairment is a separate field/status metric and alert, avoiding historical read outage during catch-up. A race/transition suspension blocks new claims but not safe historical reads.

## 4. Migration contract

- Startup opens the DB, checks path/permissions, acquires an exclusive migration transaction/lock, validates image-supported schema range, applies eligible migrations, commits, then acquires simulation ownership.
- A second startup blocks only within the configured migration-lock deadline, then exits unready with a stable code.
- Released migration files and recorded hashes are immutable.
- Each migration declares: from/to schema version, whether SQLite can transact all statements, backup prerequisite, minimum/maximum compatible image schema, point-of-no-return, rollback or roll-forward-only strategy, and restore rehearsal evidence.
- Safe transactional migrations without a backup prerequisite may run at startup. A backup-required or point-of-no-return migration refuses with `MIGRATION_BACKUP_REQUIRED` unless `apex-hour backup --for-migration <id>` has created and verified an external backup and recorded a durable marker containing migration ID, source-schema version/fingerprint, backup ID/checksum/path, verification time, and restore-rehearsal evidence. Startup also requires explicit `APEX_HOUR__DATABASE__ALLOW_MIGRATION=<id>`. A stale/mismatched marker or missing destination refuses without changing schema; the operator may create a new marker or restore the verified backup.
- Nontransactional migration steps use durable phase markers and documented roll-forward recovery. Partial/unknown state refuses application startup.
- Images refuse schemas below/above their declared compatibility range. Downgrade across a point-of-no-return is prohibited.
- No simulation or public write begins during migration.

## 5. SQLite policy

Initial production pragmas:

- `foreign_keys = ON`
- `journal_mode = WAL` and verify returned mode
- `synchronous = NORMAL`
- `busy_timeout = 5000`
- `wal_autocheckpoint = 1000` pages

Policies:

- transactions and replay pages are bounded; initial target ≤250 ms, subject to measured tightening;
- passive checkpoints follow SQLite auto-checkpoint; explicit truncate checkpoints occur only when no active write and readers permit;
- metrics cover WAL bytes/pages, checkpoint outcome/duration, busy retries/deadline, DB/file/free-space bytes, transaction duration, and disk errors;
- long read transactions are forbidden; history/replay uses keyset pages;
- busy retry total deadline cannot exceed request/operation deadline;
- disk-full/IO error suspends simulation immediately; safe reads may remain available, but no event is published without a commit;
- startup validates runtime UID/GID permissions and sufficient configured free-space reserve.

## 6. Backup and restore

The image supplies explicit CLI commands; there is no public admin endpoint.

- Use SQLite's online backup API from a live connection, followed by `integrity_check` and `foreign_key_check` on a separately opened backup.
- Production backup destination must be a separately mounted `/backup` path or external copied destination, never only the live `/data` volume.
- Backups include DB, schema metadata, and immutable ruleset/catalog/commentary material required for replay. WAL/SHM files are not copied as an ad-hoc file backup.
- Operators configure schedule, retention count/age, destination permissions, and failure alerting outside or through process config.
- Restore always targets a fresh temporary database/volume, runs integrity/foreign-key/schema checks and application smoke tests, then uses stopped-service atomic volume/path cutover with rollback to the old volume.
- The runbook states backup completion time and exact post-backup data-loss boundary. Numeric production RPO/RTO remain unaccepted until benchmark/rehearsal evidence; absence of accepted objectives is a production-readiness blocker, not an implicit zero-loss promise.

## 7. Public HTTP/tRPC/SSE limits

Initial defaults and hard maxima are Zod-validated and may be lowered operationally:

| Limit | Default | Hard maximum |
|---|---:|---:|
| list page size | 50 | 200 |
| historical event catch-up page | 200 | 500 |
| tRPC calls per HTTP batch | 5 | 10 |
| request body | 64 KiB | 256 KiB |
| query deadline | 5 seconds | 15 seconds |
| concurrent HTTP requests/process | 100 | 500 |
| concurrent executing tRPC queries/process | 50 | 200 |
| SSE queued projections/client | 256 | 1,024 |
| SSE connections/process | 500 | 2,000 |
| SSE connections/source | 8 | 32 |

- All list/history APIs use bounded keyset cursors; no unbounded offset scans.
- At a concurrency limit, reject before handler/query work with HTTP `503`, stable code `OVERLOADED`, and bounded `Retry-After`; do not queue without a separate bounded queue. SSE connections use their separate caps.
- SSE catch-up pages around a captured high-water publication sequence, then tails a listener registered before the high-water read. Duplicates are suppressed by tracked feed cursor/projection ID.
- Queue overflow emits/closes with resumable reason; it never drops an unknown middle event silently.
- Source limits use the socket remote address by default. Forwarded addresses/scheme/host are trusted only when the direct peer is in an explicit Zod-validated CIDR allowlist; otherwise forwarding headers are ignored.
- Production API/SSE is same-origin: CORS response headers are disabled by default, and requests carrying `Origin` to `/trpc` or the live feed are rejected with `ORIGIN_NOT_ALLOWED` unless origin exactly matches the configured public origin. An explicit finite allowlist is permitted for separately hosted first-party web clients; wildcard-with-credentials is forbidden.
- Static/API responses set `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin`, and a CSP of `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`. HSTS is enabled only when direct TLS or trusted-proxy HTTPS is configured; otherwise ingress owns it. Build assets must not require inline script/style exceptions.
- Unknown procedures/routes map to stable errors and a constant metric route label.
- Hono route/tRPC procedure inventory tests prohibit mutations and accidental debug/admin routes.
- Production source maps are not served. Error bodies expose stable codes and correlation IDs, never stacks/config/paths.
- Reverse proxies must disable response buffering for SSE, allow heartbeat idle duration, and preserve streaming. TASK-002 includes a real proxy fixture.

## 8. Metrics and health exposure

- `/health/live` is public/minimal: status only.
- `/health/ready` is public/sanitized: overall read readiness and opaque reason code, not internal paths/errors.
- Detailed status is available through logs and metrics.
- Metrics are disabled by default for internet-facing configuration. Enabling requires explicit bind/exposure configuration; production SHOULD bind an internal listener/network or require a configured bearer token. The token is schema-marked secret and never logged.
- Metric label values come from finite code-owned enums. Raw path, IDs, user input, errors, seeds, and unknown event types map to constants.
- Cardinality tests inject randomized routes/IDs/errors and assert the emitted label set remains within an allowlist.

## 9. Configuration decode contract

- Recursively merge objects.
- Scalars replace.
- Arrays replace whole arrays unless a specific schema defines keyed merge.
- Environment names use `APEX_HOUR__SECTION__KEY`; unknown prefixed variables fail startup.
- Empty environment values are strings unless the target schema explicitly maps empty to `null`; required values cannot silently disappear.
- Decode booleans only from `true|false`, numbers from finite decimal syntax, null only from explicit `null`, and arrays/objects from JSON syntax.
- YAML parser rejects duplicate keys, custom tags, aliases, and expansion; maximum file size defaults to 1 MiB. Missing configured file or unreadable file fails; absent optional default path does not.
- Effective provenance records final source at leaf fields. Redaction sensitivity/path handling is declared in schema metadata and applied recursively before serialization.
- Production database/config/backup paths MUST resolve inside allowlisted roots. Any override is a named development-only flag that is rejected in production mode.
- Parse/Zod errors report schema paths and safe reason codes; they do not echo arbitrary values. Test nested arrays, URL credentials, embedded tokens, paths, and parser failures.

## 10. Logging context

- Server generates request IDs; an inbound ID is accepted only under explicit trusted-proxy mode, allowed character/length validation, and truncation.
- HTTP, scheduler, race, transition, and backup jobs create explicit child contexts. Background work never inherits a stale HTTP `AsyncLocalStorage` context.
- Pino error serializers traverse causes to a bounded depth and redact schema-marked values, credentials, query strings, and filesystem paths.
- Common high-cardinality IDs appear only in logs/traces, never metric labels.

## 11. Graceful shutdown

Default grace period is 30 seconds. The executable sequence is:

1. mark read readiness false and simulation state `stopping`;
2. stop accepting new HTTP/SSE connections and new race claims;
3. signal stream consumers with shutdown/reconnect reason when possible;
4. stop simulation computation at the next bounded batch boundary;
5. finish or roll back the current bounded synchronous SQLite transaction;
6. close streams and HTTP server;
7. release ownership only if still fenced owner, then close DB;
8. exit 0 when drained, nonzero on grace failure.

A second signal requests immediate drain and nonzero exit after the current synchronous boundary. The orchestrator may SIGKILL after grace expiry. Load tests must demonstrate worst-case compute batch/transaction time below the grace budget; synchronous work cannot be claimed interruptible.

## 12. Container contract

- Pinned Node 24 Debian slim base digest with an explicit dependency-update policy.
- Exec-form `node` is PID 1; no signal-swallowing shell wrapper.
- Non-root fixed UID/GID documented in image labels/runbook.
- Read-only root filesystem. Writable paths: mounted `/data`; optional separately mounted `/backup`; bounded tmpfs `/tmp` only when a dependency/test proves it necessary.
- SQLite database, WAL, and SHM all reside on `/data`.
- Deployment example sets `no-new-privileges` and drops all capabilities.
- Healthcheck uses Node's built-in HTTP/fetch, not `curl`.
- Test empty and pre-existing host-owned volumes under documented UID/GID.
- CI must run and load `better-sqlite3` inside built images on native/emulated `amd64` and `arm64`; build success alone is not evidence.

## 13. Retention and capacity

Canonical history is not automatically deleted in v1. Therefore production requires:

- DB/WAL/free-space growth metrics and alerts;
- configured minimum free-space reserve before new race claim;
- bounded history/API/replay pages independent of DB size;
- documented export/archive workflow that copies immutable history without deleting canonical data;
- disk-full fault tests and restore-capacity planning.

No numeric capacity, RPO, RTO, latency, memory, or image-size claim is accepted until TASK-016 records reference hardware, restore rehearsal, and evidence.
