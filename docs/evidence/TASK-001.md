# TASK-001 evidence

Implementation evidence is append-only by story. The accepted specification remains unchanged.

## FND-001 — npm workspace and pinned toolchain

**Date:** 2026-07-28

**Environment:** Debian 13 host; Node v22.22.2/npm 10.9.7 executing a repository pinned to Node 24 via `engines`, `.nvmrc`, and `.node-version`.

**Changed scope:** root package/lock/TypeScript/Node files; eight workspace manifests, composite configs and minimal sources; generated-build ignore rule; Ralph state/progress.

### Observed command

```text
npm ci && npm run check
```

**Observed result:** exit 0.

- `npm ci`: 132 packages added, 141 audited, 0 vulnerabilities. It emitted expected `EBADENGINE` because the current host is Node 22 while the project requires Node 24.
- `npm run format:check`: passed.
- `npm run lint`: passed for the minimal baseline.
- `npm run typecheck`: TypeScript 7 project build passed.
- `npm run test`: Vitest exited 0 with no test files, allowed only for this foundation story.
- `npm run build`: TypeScript project build passed.

### Acceptance

- All eight required npm workspaces exist.
- Node 24 and exact TASK-001 direct dependency versions are pinned; transitive versions are locked.
- Root scripts contain `format:check`, `lint`, `typecheck`, `test`, `build`, and `check`.
- `package-lock.json` is committed with this story.
- Node 24 execution remains explicitly assigned to FND-004 CI; this story does not claim it was observed locally.

## FND-002 — strict TypeScript references and Zod inference

**Date:** 2026-07-28

The first worker timed out with an uncommitted partial implementation. Parent verification replaced a private module-resolution monkey-patch with Microsoft's documented TypeScript 7 side-by-side layout:

- `@typescript/native` aliases `typescript@7.0.2` and provides `tsc`;
- `typescript` aliases `@typescript/typescript6@6.0.2` for utilities requiring the programmatic API, including typescript-eslint.

### Observed commands

```text
npm install
npx tsc --version
node -e "console.log(require('typescript').version)"
npm run check
```

**Observed result:** all exited 0.

- Native compiler: TypeScript 7.0.2.
- Tooling compatibility API reported TypeScript 6.0.3 from the official compatibility package.
- `format:check`: passed.
- ESLint 10 + typescript-eslint parsed and linted all TypeScript source/test files; passed.
- Strict TypeScript project-reference typecheck: passed.
- Vitest: one file, two Zod schema/inferred-type tests passed.
- Build: passed; outputs and build metadata are emitted under ignored workspace `dist/` directories.
- Package check: all eight workspaces have explicit ESM/type export maps.
- Source check: generated `.js`, `.d.ts`, and maps were removed from `src`.
- npm audit: 0 vulnerabilities.

## FND-003 — executable simulation-boundary checks

**Date:** 2026-07-28

The bounded worker stopped with an uncommitted partial implementation. The parent inspected the AST checker and fixture, then ran all required verification before accepting the story.

### Observed command

```text
npm run test:boundaries && npm run check && node scripts/check-docs.mjs
```

**Observed result:** exit 0.

- Boundary self-test: production simulation source clean.
- Negative fixture: exactly one instance of each of 11 stable rule codes covering forbidden web/server, database, observability, config, Node built-in, outside-package imports, environment access, Node globals, random, wall clock, and timer APIs.
- Prettier and TypeScript ESLint: passed.
- Strict TypeScript project-reference typecheck/build: passed.
- Vitest: one file and two contract tests passed.
- Documentation checks: passed across 22 Markdown files.

## FND-004 — Node 24 CI and fresh-install evidence

**Date:** 2026-07-28

### Workflow delivered

`.github/workflows/check.yml` has read-only repository permissions, a 15-minute job timeout, per-ref concurrency cancellation, Node from `.node-version` (24), npm caching, locked install, documentation validation, and the complete repository check. The earlier docs-only workflow was removed.

### Observed host command

```text
npm ci && node scripts/check-docs.mjs && npm run check
```

**Observed result:** exit 0. npm installed 148 packages, audited 157 packages with 0 vulnerabilities, documentation validation passed, two Vitest contract tests passed, and formatting/lint/typecheck/build/boundary checks passed. npm emitted the expected engine warning because the host is Node v22.22.2.

### Observed Node 24 clean-copy command

A read-only repository mount was copied—excluding `.git`, `node_modules`, and `dist`—into a clean `node:24-bookworm-slim` container, then executed:

```text
npm ci
node scripts/check-docs.mjs
npm run check
```

**Observed environment:** Node v24.18.0, npm 11.16.0.

**Observed result:** exit 0. Locked install added 148 packages, audit found 0 vulnerabilities, documentation checks passed, two tests passed, and formatting/lint/typecheck/build/simulation-boundary checks passed.

### Workflow validation

```text
docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:latest -color .github/workflows/check.yml
```

**Observed result:** exit 0 after setting the workflow file to mode 0644.

Remote GitHub Actions execution remains unobserved until the commit is pushed; this evidence does not claim otherwise. TASK-001 remains foundation work only and does not implement a product vertical slice.
