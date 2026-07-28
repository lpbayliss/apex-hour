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
