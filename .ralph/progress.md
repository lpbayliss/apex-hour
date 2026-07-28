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
