import { builtinModules } from "node:module";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const simulationRoot = path.join(repositoryRoot, "packages/simulation");
const productionRoot = path.join(simulationRoot, "src");
const fixturePath = path.join(
  simulationRoot,
  "test/fixtures/boundary-violations.ts",
);

const RULE = Object.freeze({
  WEB_IMPORT: "SIM_IMPORT_WEB",
  DATABASE_IMPORT: "SIM_IMPORT_DATABASE",
  OBSERVABILITY_IMPORT: "SIM_IMPORT_OBSERVABILITY",
  CONFIG_IMPORT: "SIM_IMPORT_CONFIG",
  NODE_IMPORT: "SIM_IMPORT_NODE",
  OUTSIDE_IMPORT: "SIM_IMPORT_OUTSIDE",
  NODE_USAGE: "SIM_GLOBAL_NODE",
  ENVIRONMENT_USAGE: "SIM_ENVIRONMENT_USAGE",
  RANDOM_USAGE: "SIM_GLOBAL_RANDOM",
  WALL_CLOCK_USAGE: "SIM_GLOBAL_WALL_CLOCK",
  TIMER_USAGE: "SIM_GLOBAL_TIMER",
});

const EXPECTED_FIXTURE_CODES = Object.freeze(Object.values(RULE).sort());
const NODE_MODULES = new Set(
  builtinModules.flatMap((name) => [name, name.replace(/^node:/u, "")]),
);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);
const TIMER_NAMES = new Set([
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "setImmediate",
  "clearImmediate",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
]);
const GLOBAL_QUALIFIERS = new Set(["global", "globalThis", "self", "window"]);

const IMPORT_RULES = [
  {
    code: RULE.WEB_IMPORT,
    pattern: /(?:^|[/@._-])(?:hono|trpc|web|server)(?:$|[/@._-])/iu,
    label: "web/Hono/tRPC",
  },
  {
    code: RULE.DATABASE_IMPORT,
    pattern:
      /(?:^|[/@._-])(?:database|db|drizzle|sqlite|better-sqlite3)(?:$|[/@._-])/iu,
    label: "database/Drizzle/SQLite",
  },
  {
    code: RULE.OBSERVABILITY_IMPORT,
    pattern:
      /(?:^|[/@._-])(?:logging|logger|metrics|observability|opentelemetry|pino|prom-client|telemetry|winston)(?:$|[/@._-])/iu,
    label: "logging/metrics/observability",
  },
  {
    code: RULE.CONFIG_IMPORT,
    pattern: /(?:^|[/@._-])(?:config|dotenv|env)(?:$|[/@._-])/iu,
    label: "config/environment",
  },
];

function isWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectSourceFiles(entryPath);
      if (
        entry.isFile() &&
        SOURCE_EXTENSIONS.has(path.extname(entry.name)) &&
        !entry.name.endsWith(".d.ts")
      ) {
        return [entryPath];
      }
      return [];
    }),
  );
  return nested.flat().sort();
}

function importRule(specifier) {
  const normalized = specifier.replace(/^node:/u, "");
  if (NODE_MODULES.has(normalized)) {
    return {
      code: RULE.NODE_IMPORT,
      label: "Node built-in/filesystem/process",
    };
  }
  return IMPORT_RULES.find(({ pattern }) => pattern.test(specifier));
}

async function pathExists(candidate) {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
}

async function resolvesOutsideSimulation(specifier, containingFile) {
  if (!specifier.startsWith(".") && !path.isAbsolute(specifier)) return false;

  const unresolved = path.resolve(path.dirname(containingFile), specifier);
  const candidates = [
    unresolved,
    ...[".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"].map(
      (extension) => `${unresolved}${extension}`,
    ),
    ...["index.ts", "index.tsx", "index.mts", "index.cts"].map((name) =>
      path.join(unresolved, name),
    ),
  ];
  let existing;
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      existing = candidate;
      break;
    }
  }
  const resolved = existing ?? unresolved;
  const canonical = existing ? await realpath(resolved) : resolved;
  return !isWithin(canonical, simulationRoot);
}

function moduleSpecifiers(sourceFile) {
  const found = [];

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      found.push({
        node: node.moduleSpecifier,
        value: node.moduleSpecifier.text,
      });
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      found.push({ node: node.arguments[0], value: node.arguments[0].text });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function propertyPath(node) {
  if (ts.isIdentifier(node)) return [node.text];
  if (ts.isPropertyAccessExpression(node)) {
    const left = propertyPath(node.expression);
    return left ? [...left, node.name.text] : undefined;
  }
  return undefined;
}

function location(sourceFile, node) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  return { line: line + 1, column: character + 1 };
}

function violation(sourceFile, node, code, message) {
  return {
    code,
    file: sourceFile.fileName,
    ...location(sourceFile, node),
    message,
  };
}

function usageViolations(sourceFile) {
  const violations = [];

  function add(node, code, message) {
    violations.push(violation(sourceFile, node, code, message));
  }

  function visit(node) {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const expression = node.expression;
      const parts = propertyPath(expression);
      const args = node.arguments ?? [];
      const unqualified = parts?.length === 1 ? parts[0] : undefined;
      const qualified =
        parts?.length === 2 && GLOBAL_QUALIFIERS.has(parts[0])
          ? parts[1]
          : undefined;
      const timerName = unqualified ?? qualified;

      if (
        parts?.at(-1) === "random" &&
        (parts.at(-2) === "Math" ||
          (parts.length === 3 && GLOBAL_QUALIFIERS.has(parts[0])))
      ) {
        add(node, RULE.RANDOM_USAGE, "Math.random is nondeterministic");
      }

      if (
        (parts?.length === 2 && parts[0] === "Date" && parts[1] === "now") ||
        (parts?.length === 3 &&
          GLOBAL_QUALIFIERS.has(parts[0]) &&
          parts[1] === "Date" &&
          parts[2] === "now") ||
        ((unqualified === "Date" || qualified === "Date") &&
          args.length === 0) ||
        (parts?.at(-1) === "now" && parts.at(-2) === "performance") ||
        (parts?.at(-2) === "Now" && parts.at(-3) === "Temporal")
      ) {
        add(
          node,
          RULE.WALL_CLOCK_USAGE,
          "wall-clock access is nondeterministic",
        );
      }

      if (timerName && TIMER_NAMES.has(timerName)) {
        add(node, RULE.TIMER_USAGE, `${timerName} is a global timer API`);
      }

      if (
        parts?.[0] === "process" ||
        (parts?.length >= 2 &&
          GLOBAL_QUALIFIERS.has(parts[0]) &&
          parts[1] === "process")
      ) {
        add(node, RULE.NODE_USAGE, "global process API usage is forbidden");
      }
    }

    if (
      ts.isIdentifier(node) &&
      ["Buffer", "__dirname", "__filename"].includes(node.text)
    ) {
      add(node, RULE.NODE_USAGE, `Node global ${node.text} usage is forbidden`);
    }

    const parts = propertyPath(node);
    if (
      parts &&
      ((parts.length === 2 && parts[0] === "process" && parts[1] === "env") ||
        (parts.length === 2 &&
          ["Bun", "Deno"].includes(parts[0]) &&
          parts[1] === "env") ||
        (parts.length === 3 &&
          GLOBAL_QUALIFIERS.has(parts[0]) &&
          parts[1] === "process" &&
          parts[2] === "env"))
    ) {
      add(node, RULE.ENVIRONMENT_USAGE, "environment access is forbidden");
    } else if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "env" &&
      ts.isMetaProperty(node.expression)
    ) {
      add(node, RULE.ENVIRONMENT_USAGE, "import.meta.env access is forbidden");
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

async function scan(files) {
  const violations = [];
  for (const file of files) {
    const sourceText = await readFile(file, "utf8");
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    for (const imported of moduleSpecifiers(sourceFile)) {
      const rule = importRule(imported.value);
      if (rule) {
        violations.push(
          violation(
            sourceFile,
            imported.node,
            rule.code,
            `import of ${rule.label} dependency '${imported.value}' is forbidden`,
          ),
        );
      }
      if (await resolvesOutsideSimulation(imported.value, file)) {
        violations.push(
          violation(
            sourceFile,
            imported.node,
            RULE.OUTSIDE_IMPORT,
            `relative import '${imported.value}' resolves outside packages/simulation`,
          ),
        );
      }
    }
    violations.push(...usageViolations(sourceFile));
  }

  return violations.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.column - right.column ||
      left.code.localeCompare(right.code),
  );
}

function printViolations(violations) {
  for (const item of violations) {
    const file = path.relative(repositoryRoot, item.file);
    console.error(
      `${file}:${item.line}:${item.column} [${item.code}] ${item.message}`,
    );
  }
}

async function selfTest() {
  const productionViolations = await scan(
    await collectSourceFiles(productionRoot),
  );
  if (productionViolations.length > 0) {
    printViolations(productionViolations);
    throw new Error("production simulation source failed the boundary check");
  }

  const fixtureViolations = await scan([fixturePath]);
  const actualCodes = [
    ...new Set(fixtureViolations.map(({ code }) => code)),
  ].sort();
  if (JSON.stringify(actualCodes) !== JSON.stringify(EXPECTED_FIXTURE_CODES)) {
    printViolations(fixtureViolations);
    throw new Error(
      `fixture codes differed: expected ${EXPECTED_FIXTURE_CODES.join(", ")}; found ${actualCodes.join(", ")}`,
    );
  }
  if (fixtureViolations.length !== EXPECTED_FIXTURE_CODES.length) {
    printViolations(fixtureViolations);
    throw new Error(
      `fixture must produce each intended rule exactly once; found ${fixtureViolations.length} violations`,
    );
  }

  console.log(
    `Boundary self-test passed: production clean; fixture produced ${actualCodes.join(", ")}`,
  );
}

if (process.argv.includes("--self-test")) {
  await selfTest();
} else {
  const violations = await scan(await collectSourceFiles(productionRoot));
  if (violations.length > 0) {
    printViolations(violations);
    process.exitCode = 1;
  } else {
    console.log("Simulation boundary check passed (packages/simulation/src).");
  }
}
