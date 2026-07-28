# Research basis

Research date: 2026-07-28.

## Confirmed platform facts

- [TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0) was released on 2026-07-08 as the production-ready native compiler and remains installable from the `typescript` npm package.
- [Node.js 24](https://nodejs.org/en/blog/release/v24.18.0) is the selected LTS runtime line.
- [Hono's Node adapter](https://hono.dev/docs/getting-started/nodejs) documents Node serving, static assets, graceful shutdown, and Docker deployment.
- [Hono streaming](https://hono.dev/docs/helpers/streaming) supports SSE and disconnect cleanup; errors after streaming starts require stream-local handling.
- [tRPC subscriptions](https://trpc.io/docs/server/subscriptions) recommend SSE when bidirectional transport is unnecessary and support tracked event IDs for reconnect/resume.
- [Drizzle SQLite](https://orm.drizzle.team/docs/sqlite/get-started-sqlite) supports `better-sqlite3` and `node:sqlite`. Node's own SQLite API remains release-candidate stability in current Node documentation, so the production baseline prefers the established `better-sqlite3` driver despite its native binary.
- [OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/getting-started/nodejs) supports Node traces and metrics; its logging story remains less mature, so application logs use Pino JSON with correlation fields while metrics use a Prometheus-compatible registry.

## Ralph-loop basis

- Geoffrey Huntley's [Ralph technique](https://ghuntley.com/ralph) uses fresh agent context, the same specification/plan each iteration, and one task per loop.
- [`snarktank/ralph`](https://github.com/snarktank/ralph) demonstrates a PRD file with pass state, append-only progress, fresh agent invocations, and repository instructions.
- Apex Hour keeps the useful durable PRD/progress and one-story evidence pattern, but executes it through Hermes' `bounded-ralph-loop` skill in the current session. External process loops proved brittle and could report control-plane activity without product implementation.

Apex Hour uses the technique conservatively: bounded iterations, one accepted task per iteration, mandatory tests, a clean-worktree/branch guard, append-only progress, and stop conditions. It does not run a shell or background coding-agent loop.

## Product and design boundary

MotoGP and Formula 1 are visual references for information density, timing hierarchy, and race-state legibility only. Apex Hour must use original marks, terminology, component shapes, tokens, and fictional entities rather than copying protected branding or trade dress.
