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
