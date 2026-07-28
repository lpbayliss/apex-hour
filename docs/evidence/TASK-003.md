# TASK-003 evidence

Implementation evidence is append-only by story. Public TypeScript types in this task are inferred from their authoritative Zod schemas.

## CTR-001 — branded IDs, ratings, canonical events, and cursors

**Date:** 2026-07-28

### Delivered

- Branded aggregate/context IDs for universe, season, race, rider, team, manufacturer, sponsorship, and component entities.
- Branded aggregate event, command, correlation, and tracked publication cursor IDs.
- Integer 0–100 rating primitive and the eleven FR-010 rider rating fields.
- Strict generic canonical event-envelope schema with typed payload and deterministic `<aggregateKind>/<aggregateId>/<streamSequence>` consistency validation.
- Distinct `race/<raceId>/publication/<publicationSequence>` cursor with stable invalid, ahead, and expired result codes.

### Observed commands

```text
npm run test --workspace @apex-hour/contracts
npm run typecheck
npx eslint 'packages/contracts/**/*.ts'
npm run check
git diff --check
```

**Observed result:** exit 0. The contracts workspace ran 10 tests covering inferred types, identity/rating bounds, strict event-envelope parsing, event-ID mismatch, payload/version/order validation, cursor scope distinction, and stable cursor boundary codes. Full repository formatting, lint, TypeScript, tests, build, and simulation boundary checks passed.

## CFG-001 — strict YAML/environment config resolution

**Date:** 2026-07-28

### Delivered

- Strict root `appConfigSchema` and inferred `AppConfig` with code-owned defaults.
- Recursive defaults < YAML < environment merge with whole-array replacement.
- `APEX_HOUR__SECTION__KEY` allowlist generated from schema metadata; unknown prefixed variables fail.
- Exact schema-directed string, boolean, finite-decimal, nullable null, JSON array, and JSON object decoding.
- Failsafe YAML data parser rejecting duplicate keys, custom tags, aliases, expansion beyond the byte limit, and non-object roots.
- Leaf provenance and stable value-free `ConfigError` code/path diagnostics.
- Explicit missing/unreadable file behavior and absent optional-default behavior.
- Schema-aligned `.env.example` and `config.example.yaml`.

### Observed commands

```text
npm install
npm run test --workspace @apex-hour/config
npm run typecheck
npx eslint 'packages/config/**/*.ts'
npm run check
git diff --check
```

**Observed result:** exit 0. npm audited 168 packages with 0 vulnerabilities. The config workspace ran 16 tests across merge precedence, array replacement, leaf provenance, JSON object/array and scalar decoding, unknown/invalid environment inputs, empty/null behavior, URL credential diagnostics, YAML parser boundaries, file-size limits, and optional/explicit file handling. Full repository checks passed with 26 total production-package tests.

## CFG-002 — redaction, paths, and compatibility matrix

**Date:** 2026-07-28

### Delivered

- Strict-write and same-major compatible-read event schemas share one authoritative envelope. Compatible readers preserve additive envelope/payload fields and reject unsupported schema majors with `EVENT_SCHEMA_UNSUPPORTED`.
- Metadata-driven recursive redaction emits `[REDACTED]` for secrets and `[PATH]` for filesystem-sensitive values.
- Production containment covers database path, backup directory, declared config file, and the actual loaded config path. The named outside-root override is development-only.
- Hostile fixtures cover nested arrays/JSON objects, URL credentials and query tokens, embedded bearer tokens, paths, unknown keys, and parser failures.
- Both committed example config surfaces execute through the resolver.

### Operations section 9 boundary table

| Boundary                                                | Observed fixture                                |
| ------------------------------------------------------- | ----------------------------------------------- |
| recursive objects; scalar replacement                   | YAML/environment precedence fixture             |
| arrays replace whole arrays                             | default/YAML/environment origin-list fixture    |
| unknown prefixed environment fails                      | `CONFIG_ENV_UNKNOWN` table row                  |
| empty values remain strings unless explicitly nullable  | public-origin/config-file rows                  |
| exact boolean/finite decimal/null/JSON/string decode    | environment decode table                        |
| duplicate/custom-tag/alias/expansion/size parser limits | strict YAML table                               |
| missing optional vs configured/unreadable file          | file adapter table                              |
| final leaf provenance                                   | default/YAML/environment assertions             |
| recursive metadata redaction                            | path/token redacted output fixture              |
| production path allowlists                              | database/backup/config/actual-loaded path table |
| development-only override                               | development/production paired fixture           |
| safe schema paths/reason codes                          | hostile URL/token/path/parser assertions        |

### Observed commands

```text
npm run test --workspace @apex-hour/contracts
npm run test --workspace @apex-hour/config
npm run typecheck
npx eslint 'packages/contracts/**/*.ts' 'packages/config/**/*.ts'
npm run check
node scripts/check-docs.mjs
git diff --check
```

**Observed local result:** exit 0. Contracts: 11 tests. Config: 24 tests. Full repository: 35 tests plus formatting, lint, TypeScript, build, and simulation-boundary checks.

### Clean Node 24 result

Executed in `node:24-bookworm-slim` from a read-only source copy with all installed/build artifacts excluded:

```text
node=v24.18.0
npm=11.16.0
npm ci
npm run test --workspace @apex-hour/contracts
npm run test --workspace @apex-hour/config
npm run check
node scripts/check-docs.mjs
```

**Observed result:** exit 0; 168 packages audited with 0 vulnerabilities, 11 contracts tests passed, 24 config tests passed, full 35-test repository check passed, and documentation checks passed across 24 Markdown files.
