#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  "README.md",
  "AGENTS.md",
  "docs/specification.md",
  "docs/domain-rules.md",
  "docs/operations-contract.md",
  "docs/traceability.md",
  "docs/implementation-plan.md",
  "docs/research.md",
  "docs/adr/0001-modular-monolith.md",
  "docs/adr/0002-deterministic-events.md",
  "docs/adr/0003-sqlite-drizzle.md",
  "docs/adr/0004-trpc-sse.md",
  "docs/adr/0005-zod-config.md",
  "docs/adr/0006-hourly-scheduler.md",
  "docs/adr/0007-event-compatibility.md",
  "docs/adr/0008-operations-boundary.md",
];
const errors = [];

for (const path of required) {
  if (!existsSync(join(root, path)))
    errors.push(`missing required file: ${path}`);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.name === ".git" || entry.name === "node_modules") return [];
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const markdownFiles = walk(root).filter((path) => path.endsWith(".md"));
const localLinkPattern = /\[[^\]]*\]\(([^)]+)\)/g;

for (const file of markdownFiles) {
  const text = readFileSync(file, "utf8");
  const display = relative(root, file);
  if (!text.endsWith("\n")) errors.push(`${display}: missing final newline`);

  for (const [index, line] of text.split("\n").entries()) {
    if (line.trimEnd() !== line)
      errors.push(`${display}:${index + 1}: trailing whitespace`);
  }

  for (const match of text.matchAll(localLinkPattern)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const localTarget = target.split("#", 1)[0];
    if (!localTarget) continue;
    const resolved = resolve(dirname(file), localTarget);
    if (!existsSync(resolved))
      errors.push(`${display}: broken local link ${target}`);
  }
}

const specification = join(root, "docs/specification.md");
if (existsSync(specification)) {
  const text = readFileSync(specification, "utf8");
  for (const phrase of [
    "Implementation readiness:",
    "Exactly 24 races per season",
    "No public simulation/admin controls",
    "## 6. Requirements",
    "## 10. Verification matrix",
    "## 12. Autonomous implementation safety",
    "docs/domain-rules.md",
    "docs/operations-contract.md",
    "docs/traceability.md",
  ]) {
    if (!text.includes(phrase))
      errors.push(`docs/specification.md: missing contract phrase: ${phrase}`);
  }

  const status = text.match(/^status: (proposed|accepted)$/m)?.[1];
  if (!status)
    errors.push("docs/specification.md: status must be proposed or accepted");

  const requirementIds = [
    ...text.matchAll(/^\| ((?:FR|QR|SEC|DATA|INT|OPS)-\d{3}) \|/gm),
  ].map((match) => match[1]);
  const uniqueRequirements = new Set(requirementIds);
  if (requirementIds.length !== 53 || uniqueRequirements.size !== 53) {
    errors.push(
      `docs/specification.md: expected 53 unique requirement IDs, found ${requirementIds.length}/${uniqueRequirements.size}`,
    );
  }

  const tracePath = join(root, "docs/traceability.md");
  if (existsSync(tracePath)) {
    const trace = readFileSync(tracePath, "utf8");
    const traceIds = [
      ...trace.matchAll(/^\| ((?:FR|QR|SEC|DATA|INT|OPS)-\d{3}) \|/gm),
    ].map((match) => match[1]);
    const traceSet = new Set(traceIds);
    const missing = [...uniqueRequirements].filter((id) => !traceSet.has(id));
    const extra = [...traceSet].filter((id) => !uniqueRequirements.has(id));
    if (traceIds.length !== traceSet.size || missing.length || extra.length) {
      errors.push(
        `docs/traceability.md: duplicate/missing/extra requirement rows (missing=${missing.join(",")}; extra=${extra.join(",")})`,
      );
    }
    if (!trace.includes("| FR-005 | TASK-006/007/008/009 |")) {
      errors.push(
        "docs/traceability.md: FR-005 must include race, career, and development task ownership",
      );
    }
    if (!trace.includes("in-race and between-race form/fitness")) {
      errors.push(
        "docs/traceability.md: FR-005 must explicitly own form/fitness behavior",
      );
    }
    if (!trace.includes("| SEC-002 | TASK-012/013 |")) {
      errors.push(
        "docs/traceability.md: SEC-002 must split app HTTP and tRPC/SSE ownership",
      );
    }
  }
}

const planPath = join(root, "docs/implementation-plan.md");
if (existsSync(planPath)) {
  const plan = readFileSync(planPath, "utf8");
  const headings = [...plan.matchAll(/^## (TASK-\d{3}) —/gm)];
  if (headings.length !== 16)
    errors.push(
      `docs/implementation-plan.md: expected 16 TASK headings, found ${headings.length}`,
    );
  for (const [index, heading] of headings.entries()) {
    const end = headings[index + 1]?.index ?? plan.length;
    const block = plan.slice(heading.index, end);
    for (const field of [
      "**Depends on:**",
      "**Verify:**",
      "**Pass:**",
      "**Rollback:",
    ]) {
      if (!block.includes(field))
        errors.push(
          `docs/implementation-plan.md: ${heading[1]} missing ${field}`,
        );
    }
    if (!block.includes("**Owns:**") && !block.includes("**Allowed paths:**")) {
      errors.push(
        `docs/implementation-plan.md: ${heading[1]} missing authoritative paths`,
      );
    }
    if (!block.match(/\*\*Verify:\*\*[^\n]*`[^`]+`/)) {
      errors.push(
        `docs/implementation-plan.md: ${heading[1]} verification lacks an exact command`,
      );
    }
  }

  for (const phrase of [
    "docs/evidence/TASK-NNN.md",
    "`.ralph/progress.md` are implicitly allowed for every task",
  ]) {
    if (!plan.includes(phrase))
      errors.push(
        `docs/implementation-plan.md: missing governance phrase: ${phrase}`,
      );
  }

  const taskIds = new Set(headings.map((heading) => heading[1]));
  for (const adr of required.filter((path) => path.startsWith("docs/adr/"))) {
    const text = readFileSync(join(root, adr), "utf8");
    for (const field of [
      "**Status:**",
      "**Date:**",
      "**Decision owner:**",
      "**Requirements/tasks:**",
      "**Supersession:**",
    ]) {
      if (!text.includes(field)) errors.push(`${adr}: missing ${field}`);
    }
    if (!text.match(/\*\*Status:\*\* (?:Proposed(?: — [^\n]+)?|Accepted)/)) {
      errors.push(`${adr}: invalid ADR status`);
    }
    for (const match of text.matchAll(/TASK-\d{3}/g)) {
      if (!taskIds.has(match[0]))
        errors.push(`${adr}: unknown task reference ${match[0]}`);
    }
  }

  const specificationText = readFileSync(specification, "utf8");
  if (specificationText.includes("status: accepted")) {
    for (const adr of required.filter(
      (path) => path.startsWith("docs/adr/") && !path.includes("0004-"),
    )) {
      const text = readFileSync(join(root, adr), "utf8");
      if (!text.includes("**Status:** Accepted"))
        errors.push(
          `${adr}: accepted specification requires this ADR to be Accepted`,
        );
    }
    const transportAdr = readFileSync(
      join(root, "docs/adr/0004-trpc-sse.md"),
      "utf8",
    );
    const task2EvidencePath = join(root, "docs/evidence/TASK-002.md");
    const task2Evidence = existsSync(task2EvidencePath)
      ? readFileSync(task2EvidencePath, "utf8")
      : "";
    const task2Observed =
      task2Evidence.includes(
        "## TRN-003 — resilience matrix and adapter decision",
      ) &&
      task2Evidence.includes("### Final decision") &&
      task2Evidence.includes("all four real-wire tests passed");
    const requiredTransportStatus = task2Observed
      ? "**Status:** Accepted"
      : "**Status:** Proposed";
    if (!transportAdr.includes(requiredTransportStatus)) {
      errors.push(
        `docs/adr/0004-trpc-sse.md: expected ${requiredTransportStatus.replace("**Status:** ", "")} from TASK-002 evidence state`,
      );
    }
  }
}

for (const file of walk(root)) {
  if (statSync(file).isFile() && file.endsWith(".sqlite")) {
    errors.push(
      `database artifact must not be committed: ${relative(root, file)}`,
    );
  }
}

if (errors.length) {
  console.error(`Documentation checks failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(
  `Documentation checks passed (${markdownFiles.length} Markdown files).`,
);
