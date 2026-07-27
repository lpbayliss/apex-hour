#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const prdPath = resolve(root, '.ralph/prd.json');
const prd = JSON.parse(readFileSync(prdPath, 'utf8'));
const [command, ...args] = process.argv.slice(2);

function storyById(id) {
  const story = prd.stories.find((candidate) => candidate.id === id);
  if (!story) throw new Error(`Unknown story: ${id}`);
  return story;
}

if (command === 'next') {
  const passed = new Set(prd.stories.filter((story) => story.status === 'passed').map((story) => story.id));
  const next = [...prd.stories]
    .filter((story) => story.status === 'pending' && story.attempts < prd.maxAttemptsPerStory)
    .filter((story) => story.dependsOn.every((dependency) => passed.has(dependency)))
    .sort((left, right) => left.priority - right.priority)[0];
  if (!next) process.exit(2);
  console.log(next.id);
} else if (command === 'show') {
  console.log(JSON.stringify(storyById(args[0]), null, 2));
} else if (command === 'validate') {
  const [id, before, after] = args;
  const story = storyById(id);
  if (story.status !== 'passed') throw new Error(`${id} did not set status=passed`);
  if (before === after) throw new Error(`${id} produced no commit`);
  const count = Number(execFileSync('git', ['rev-list', '--count', `${before}..${after}`], { cwd: root, encoding: 'utf8' }).trim());
  if (count !== 1) throw new Error(`${id} must create exactly one commit, created ${count}`);
  const changed = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', after], { cwd: root, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const implicit = ['docs/evidence/TASK-001.md', '.ralph/progress.md', '.ralph/prd.json'];
  const allowed = (path) => implicit.includes(path) || story.allowedPrefixes.some((prefix) => path === prefix || path.startsWith(prefix));
  const forbidden = changed.filter((path) => !allowed(path));
  if (forbidden.length) throw new Error(`${id} changed forbidden paths: ${forbidden.join(', ')}`);
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
  if (dirty) throw new Error(`${id} left a dirty tree:\n${dirty}`);
  const progress = readFileSync(resolve(root, '.ralph/progress.md'), 'utf8');
  if (!progress.includes(`## ${id}`)) throw new Error(`${id} has no progress entry`);
  if (!existsSync(resolve(root, 'docs/evidence/TASK-001.md'))) throw new Error(`${id} has no TASK-001 evidence artifact`);
  console.log(`RALPH_STORY_VALID ${id} commit=${after}`);
} else {
  console.error('Usage: ralph-state.mjs next | show <id> | validate <id> <before> <after>');
  process.exit(1);
}
