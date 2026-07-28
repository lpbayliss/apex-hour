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
