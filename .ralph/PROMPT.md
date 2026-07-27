You are one bounded implementation iteration for Apex Hour.

The controller will append the exact story JSON after this prompt. Implement only that story.

Mandatory context, in order:

1. `AGENTS.md`
2. `docs/specification.md`
3. `docs/implementation-plan.md` TASK-001
4. `.ralph/prd.json`
5. `.ralph/progress.md`

Rules:

- Work only on branch `feat/foundation`.
- Modify only the story's `allowedPrefixes`, plus its implicit `docs/evidence/TASK-001.md` and `.ralph/progress.md` paths.
- Do not weaken tests, docs checks, TypeScript strictness, security controls, or accepted contracts.
- Do not push, open a PR, reset, rebase, amend, deploy, or alter git history.
- Do not edit the accepted specification/ADRs.
- Add only dependencies pinned by TASK-001 or strictly required for its named acceptance criteria. Stop rather than improvise a public/domain/DB contract.
- Run the exact story verification and the applicable root quality gates.
- Create/update `docs/evidence/TASK-001.md` with observed command results only.
- Append an observed entry to `.ralph/progress.md`.
- Set only this story's status to `passed` after every acceptance criterion and verification command passes; increment its attempts once. On failure, keep it pending, increment attempts, record the failure, and do not commit.
- On success, make exactly one commit with message `build(TASK-001): <story title>` and leave a clean tree.
- Completion is the verified commit and clean tree, not a prose claim.
