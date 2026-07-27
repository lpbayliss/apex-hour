# Requirement traceability and evidence

**Status:** Accepted planning baseline. `Planned` means no implementation evidence exists. This file is updated continuously; TASK-016 does not create traceability retroactively.

**Acceptance authority:** Luke Bayliss for product behavior; independent engineering/security/operations reviewers validate their evidence domains. A `Should` may be waived only with named owner, reason, risk, expiry/review trigger, and specification/ADR link.

| Requirement | Owning task | Required evidence / pass condition | Status |
|---|---|---|---|
| FR-001 | TASK-004 | universe golden hash; every required fictional entity/allocation exists and validates | Planned |
| FR-002 | TASK-011 | 24 unique ordinals/season under property and DB tests | Planned |
| FR-003 | TASK-011 | `(ordinal-1)×3600`, recursive season start, DST fixtures pass | Planned |
| FR-004 | TASK-005 | exhaustive legal/illegal domain and execution transition matrix | Planned |
| FR-005 | TASK-006/007/008/009 | every domain-rules section 8 race, in-race and between-race form/fitness, career, and development behavior has a named deterministic passing fixture owned by its task | Planned |
| FR-006 | TASK-003 | Zod envelope plus deterministic ID/sequence/idempotency/cursor fixtures | Planned |
| FR-007 | TASK-007 | golden commentary/fallback; commentary version cannot alter simulation hash | Planned |
| FR-008 | TASK-014 | live page E2E shows every named datum/state at desktop/mobile | Planned |
| FR-009 | TASK-014 | season/world/history route and API E2E inventory | Planned |
| FR-010 | TASK-004 | all rider ratings are bounded Zod data and inferred types | Planned |
| FR-011 | TASK-004/006 | composition/property tests; no brand-specific code branches | Planned |
| FR-012 | TASK-008 | every expiring seat resolves once; all contract branches/invariants pass | Planned |
| FR-013 | TASK-007/008 | diagnosis/recovery/substitution/withdrawal/minimum-grid fixtures | Planned |
| FR-014 | TASK-008 | every rider entry/exit reason and reserve-minimum fixture | Planned |
| FR-015 | TASK-009 | sponsor lifecycle/category conflict/budget/popularity fixtures; no direct performance effect | Planned |
| FR-016 | TASK-009 | development funding/version/effective-boundary/allocation fixtures | Planned |
| FR-017 | TASK-013 | static Hono/tRPC inventory contains no public mutation/admin/debug route | Planned |
| FR-018 | TASK-013 | real-wire reconnect/catch-up/high-water/no-gap/no-divergent-duplicate suite | Planned |
| FR-019 | TASK-003 | full config precedence/decode/unknown/error/redaction table passes | Planned |
| FR-020 | TASK-015 | image starts, migrates, serves, and restores without another service | Planned |
| FR-021 | TASK-011 | duration boundary plus 1/2/24/25/168/169 downtime and no-overlap tests | Planned |
| QR-001 | TASK-005 | canonical hashes equal across uninterrupted/resumed amd64/arm64 fixtures | Planned |
| QR-002 | TASK-001/005 | forbidden-import/clock/env/fs/process/`Math.random` negative and positive tests | Planned |
| QR-003 | TASK-010 | failure injection proves no publication before atomic commit | Planned |
| QR-004 | TASK-013 | bounded queue overflow disconnects resumably; memory does not grow unbounded | Planned |
| QR-005 | TASK-013 | stable public codes/correlation IDs; no stack/path/config; causes retained/redacted in logs | Planned |
| QR-006 | TASK-014 | every API/UI state row in domain-rules section 11 plus loading/disconnected/reconnecting/error fixtures and E2E | Planned |
| QR-007 | TASK-014 | axe, keyboard, focus, contrast, reduced-motion, 200% zoom, curated live-region review | Planned |
| QR-008 | TASK-016 | reviewed baseline artifact on documented hardware and accepted SLO amendment | Planned |
| SEC-001 | TASK-013 | complete route/procedure inventory has no mutation/admin/control surface | Planned |
| SEC-002 | TASK-012/013 | TASK-012 app HTTP concurrency/proxy/origin/headers/CSP/error/source-map cases and TASK-013 tRPC batch/page/query/SSE/inventory cases all pass | Planned |
| SEC-003 | TASK-003/012 | nested/path/URL/token/parser/log/API redaction hostile fixtures pass | Planned |
| SEC-004 | TASK-003 | YAML custom tags/aliases/duplicate keys/executable constructs rejected | Planned |
| SEC-005 | TASK-003 | production paths contained; development override rejected in production | Planned |
| SEC-006 | TASK-001/015 | dependency scan and image SBOM/vulnerability scan; exceptions carry expiry | Planned |
| DATA-001 | TASK-010 | pragmas verified; checkpoint/busy/disk-full/permissions/bounded-read tests | Planned |
| DATA-002 | TASK-010 | all uniqueness/idempotency/phase/finalization constraints reject duplicates | Planned |
| DATA-003 | TASK-010 | migration hash/lock/range/partial/point-of-no-return/roll-forward tests | Planned |
| DATA-004 | TASK-010/016 | no auto-delete; paged large history; growth/free-space/disk-full behavior | Planned |
| DATA-005 | TASK-015 | online backup to separate mount; fresh-volume integrity/FK/schema/app restore and cutover | Planned |
| DATA-006 | TASK-010 | genesis-to-two-season canonical rebuild equals stored projections | Planned |
| INT-001 | TASK-003 | schema/export lint proves Zod and inferred public/domain/config types | Planned |
| INT-002 | TASK-010 | Drizzle-owned relational schema; reviewed `drizzle-zod` boundary or documented waiver | Planned |
| INT-003 | TASK-003/010 | additive/major compatibility/upcast fixtures for event/ruleset/catalog/template versions | Planned |
| INT-004 | TASK-013/014 | unknown additive field/type fallback and cursor compatibility E2E | Planned |
| INT-005 | TASK-012 | minimal/sanitized health and configured protected/disabled metrics exposure tests | Planned |
| OPS-001 | TASK-012 | hostile request/background/error log capture proves IDs/context/redaction bounds | Planned |
| OPS-002 | TASK-012 | registry exposes all required HTTP/SSE/scheduler/race/SQLite/disk/process measures | Planned |
| OPS-003 | TASK-012 | randomized-path/ID/error test remains inside finite label allowlist | Planned |
| OPS-004 | TASK-011/012 | first/second signal, active batch, grace success/failure process tests | Planned |
| OPS-005 | TASK-011/012 | read readiness vs every simulation-health transition and recovery mode | Planned |
| OPS-006 | TASK-015 | non-root/read-only root/writable paths/caps/UID/GID/health/native multi-arch runtime | Planned |
| OPS-007 | TASK-010/011 | paused owner expires, takeover succeeds, stale process cannot commit/publish | Planned |

## Evidence workflow

1. Owning task changes a row from `Planned` to `Observed pass`, `Observed fail`, or `Waived Should` only after recording the command/artifact/commit.
2. Dependent tasks may not infer a pass from a broad `npm run check`; they reference the specific evidence.
3. A failing row remains visible until corrected and rerun.
4. TASK-016 verifies every row and reviewer domain before release acceptance.
