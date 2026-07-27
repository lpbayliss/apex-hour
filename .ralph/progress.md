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
