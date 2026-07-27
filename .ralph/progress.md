# Ralph progress

Append one section per attempted story. Never rewrite prior entries.

Each passing entry includes: story ID, UTC timestamp, files changed, exact commands and observed results, requirements/evidence advanced, and commit message. Do not claim a command passed unless it ran in this iteration.

## Controller preflight — 2026-07-28

- Initial shell invocation failed before a story attempt because variadic CLI options consumed the prompt argument. The controller now pipes prompts through stdin.
- A direct stdin smoke test reached Claude Code but returned HTTP 401 because its OAuth access token had expired.
- No PRD story status or attempt count changed. Until Claude Code is re-authenticated, fresh bounded Hermes subagents may execute the same one-story contract; the parent verifies each shared-repository commit before selecting the next story.
