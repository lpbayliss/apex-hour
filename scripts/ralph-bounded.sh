#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

requested="${1:-3}"
if ! [[ "$requested" =~ ^[1-8]$ ]]; then
  echo "iterations must be an integer from 1 to 8" >&2
  exit 2
fi

if [[ "$(git branch --show-current)" != "feat/foundation" ]]; then
  echo "Ralph may run only on feat/foundation" >&2
  exit 2
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Ralph requires a clean working tree" >&2
  exit 2
fi

for ((iteration=1; iteration<=requested; iteration++)); do
  if ! story="$(node scripts/ralph-state.mjs next)"; then
    code=$?
    if [[ $code -eq 2 ]]; then
      echo "No dependency-ready pending story."
      break
    fi
    exit "$code"
  fi

  before="$(git rev-parse HEAD)"
  story_json="$(node scripts/ralph-state.mjs show "$story")"
  echo "=== Ralph iteration $iteration/$requested: $story ==="

  prompt="$(cat .ralph/PROMPT.md)

Exact story for this fresh iteration:
$story_json"

  timeout --signal=TERM --kill-after=30s 30m \
    claude --print \
      --no-session-persistence \
      --disable-slash-commands \
      --permission-mode acceptEdits \
      --effort high \
      --max-budget-usd 5 \
      --allowedTools 'Read,Write,Edit,Glob,Grep,Bash(npm *),Bash(node *),Bash(git status *),Bash(git diff *),Bash(git add *),Bash(git commit *),Bash(git rev-parse *),Bash(git branch *)' \
      --disallowedTools 'WebSearch,WebFetch' \
      "$prompt"

  after="$(git rev-parse HEAD)"
  node scripts/ralph-state.mjs validate "$story" "$before" "$after"
  node scripts/check-docs.mjs
  if [[ -f package.json ]]; then npm run check; fi

done
