import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseDocument, visit } from "yaml";
import { z } from "zod";

const pathStringSchema = z.string().min(1).max(4096);
function isPathInsideRoot(value: string, root: string): boolean {
  if (!path.isAbsolute(value) || !path.isAbsolute(root)) return false;
  const resolvedValue = path.resolve(value);
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, resolvedValue);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

const publicOriginSchema = z.url().superRefine((value, context) => {
  if (!URL.canParse(value)) return;
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash) {
    context.addIssue({
      code: "custom",
      message: "URL_CREDENTIALS_OR_QUERY_FORBIDDEN",
    });
  }
});

export const appConfigSchema = z
  .object({
    mode: z.enum(["development", "production"]),
    server: z
      .object({
        publicOrigin: publicOriginSchema,
        port: z.number().int().min(1).max(65_535),
        allowedOrigins: z.array(publicOriginSchema).max(16),
        trustedProxy: z
          .object({
            enabled: z.boolean(),
            cidrs: z.array(z.string().min(1).max(64)).max(32),
          })
          .strict(),
      })
      .strict(),
    database: z
      .object({
        path: pathStringSchema,
      })
      .strict(),
    backup: z
      .object({
        directory: pathStringSchema,
      })
      .strict(),
    config: z
      .object({
        file: pathStringSchema.nullable(),
        maximumFileBytes: z
          .number()
          .int()
          .min(1)
          .max(16 * 1024 * 1024),
      })
      .strict(),
    metrics: z
      .object({
        enabled: z.boolean(),
        bearerToken: z.string().min(16).max(512).nullable(),
      })
      .strict(),
    simulation: z
      .object({
        raceIntervalSeconds: z.number().int().positive(),
        liveDurationSeconds: z.number().int().positive(),
      })
      .strict(),
    paths: z
      .object({
        dataRoot: pathStringSchema,
        configRoot: pathStringSchema,
        backupRoot: pathStringSchema,
        allowOutsideRootsInDevelopment: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((config, context) => {
    if (
      config.simulation.liveDurationSeconds >=
      config.simulation.raceIntervalSeconds
    ) {
      context.addIssue({
        code: "custom",
        path: ["simulation", "liveDurationSeconds"],
        message: "LIVE_DURATION_MUST_BE_SHORTER_THAN_INTERVAL",
      });
    }
    if (
      config.mode === "production" &&
      config.paths.allowOutsideRootsInDevelopment
    ) {
      context.addIssue({
        code: "custom",
        path: ["paths", "allowOutsideRootsInDevelopment"],
        message: "DEVELOPMENT_PATH_OVERRIDE_FORBIDDEN",
      });
    }
    if (
      config.mode === "production" ||
      !config.paths.allowOutsideRootsInDevelopment
    ) {
      for (const [value, root, field] of [
        [config.database.path, config.paths.dataRoot, ["database", "path"]],
        [
          config.backup.directory,
          config.paths.backupRoot,
          ["backup", "directory"],
        ],
        ...(config.config.file
          ? ([
              [config.config.file, config.paths.configRoot, ["config", "file"]],
            ] as const)
          : []),
      ] as const) {
        if (!isPathInsideRoot(value, root)) {
          context.addIssue({
            code: "custom",
            path: [...field],
            message: "PATH_OUTSIDE_ALLOWED_ROOT",
          });
        }
      }
    }
  });

export type AppConfig = z.infer<typeof appConfigSchema>;

export const defaultConfig: AppConfig = appConfigSchema.parse({
  mode: "production",
  server: {
    publicOrigin: "http://127.0.0.1:3000",
    port: 3000,
    allowedOrigins: [],
    trustedProxy: { enabled: false, cidrs: [] },
  },
  database: { path: "/data/apex-hour.sqlite3" },
  backup: { directory: "/backup" },
  config: { file: null, maximumFileBytes: 1024 * 1024 },
  metrics: { enabled: false, bearerToken: null },
  simulation: { raceIntervalSeconds: 3600, liveDurationSeconds: 2700 },
  paths: {
    dataRoot: "/data",
    configRoot: "/config",
    backupRoot: "/backup",
    allowOutsideRootsInDevelopment: false,
  },
});

type ConfigValueKind = "string" | "number" | "boolean" | "array" | "object";
type ConfigSensitivity = "public" | "secret" | "path";

export type ConfigFieldMetadata = {
  kind: ConfigValueKind;
  sensitivity: ConfigSensitivity;
  nullable?: boolean;
  emptyToNull?: boolean;
  arrayItemKind?: "string";
};

export const configFieldMetadata = {
  mode: { kind: "string", sensitivity: "public" },
  "server.publicOrigin": { kind: "string", sensitivity: "public" },
  "server.port": { kind: "number", sensitivity: "public" },
  "server.allowedOrigins": {
    kind: "array",
    arrayItemKind: "string",
    sensitivity: "public",
  },
  "server.trustedProxy": { kind: "object", sensitivity: "public" },
  "server.trustedProxy.enabled": {
    kind: "boolean",
    sensitivity: "public",
  },
  "server.trustedProxy.cidrs": {
    kind: "array",
    arrayItemKind: "string",
    sensitivity: "public",
  },
  "database.path": { kind: "string", sensitivity: "path" },
  "backup.directory": { kind: "string", sensitivity: "path" },
  "config.file": {
    kind: "string",
    sensitivity: "path",
    nullable: true,
    emptyToNull: true,
  },
  "config.maximumFileBytes": { kind: "number", sensitivity: "public" },
  "metrics.enabled": { kind: "boolean", sensitivity: "public" },
  "metrics.bearerToken": {
    kind: "string",
    sensitivity: "secret",
    nullable: true,
  },
  "simulation.raceIntervalSeconds": {
    kind: "number",
    sensitivity: "public",
  },
  "simulation.liveDurationSeconds": {
    kind: "number",
    sensitivity: "public",
  },
  "paths.dataRoot": { kind: "string", sensitivity: "path" },
  "paths.configRoot": { kind: "string", sensitivity: "path" },
  "paths.backupRoot": { kind: "string", sensitivity: "path" },
  "paths.allowOutsideRootsInDevelopment": {
    kind: "boolean",
    sensitivity: "public",
  },
} as const satisfies Record<string, ConfigFieldMetadata>;

export const configErrorCodeSchema = z.enum([
  "CONFIG_ENV_UNKNOWN",
  "CONFIG_ENV_DECODE",
  "CONFIG_YAML_TOO_LARGE",
  "CONFIG_YAML_PARSE",
  "CONFIG_FILE_MISSING",
  "CONFIG_FILE_UNREADABLE",
  "CONFIG_VALIDATION",
]);
export type ConfigErrorCode = z.infer<typeof configErrorCodeSchema>;

export class ConfigError extends Error {
  readonly code: ConfigErrorCode;
  readonly configPath: string;

  constructor(code: ConfigErrorCode, configPath = "root") {
    super(`${code} at ${configPath}`);
    this.name = "ConfigError";
    this.code = code;
    this.configPath = configPath;
  }
}

export type ConfigSource = "default" | "yaml" | "environment";
export type ConfigProvenance = Readonly<Record<string, ConfigSource>>;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeScalar(
  value: unknown,
  metadata: ConfigFieldMetadata,
  configPath: string,
): unknown {
  if (value === null) {
    if (metadata.nullable) return null;
    throw new ConfigError("CONFIG_ENV_DECODE", configPath);
  }
  if (metadata.kind === "object" && isRecord(value)) {
    return decodeLayer(value, configPath);
  }
  if (typeof value !== "string") {
    if (metadata.kind === "array" && Array.isArray(value)) {
      if (!value.every((item) => typeof item === metadata.arrayItemKind)) {
        throw new ConfigError("CONFIG_ENV_DECODE", configPath);
      }
      return value;
    }
    if (typeof value === metadata.kind) return value;
    throw new ConfigError("CONFIG_ENV_DECODE", configPath);
  }
  if (value === "" && metadata.emptyToNull) return null;
  if (value === "null" && metadata.nullable) return null;

  switch (metadata.kind) {
    case "string":
      return value;
    case "boolean":
      if (value === "true") return true;
      if (value === "false") return false;
      break;
    case "number":
      if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) {
        const number = Number(value);
        if (Number.isFinite(number)) return number;
      }
      break;
    case "object": {
      try {
        const parsed: unknown = JSON.parse(value);
        if (isRecord(parsed)) return decodeLayer(parsed, configPath);
      } catch {
        // Converted to a stable value-free error below.
      }
      break;
    }
    case "array": {
      try {
        const parsed: unknown = JSON.parse(value);
        if (
          Array.isArray(parsed) &&
          parsed.every((item) => typeof item === metadata.arrayItemKind)
        ) {
          return parsed;
        }
      } catch {
        // Converted to a stable value-free error below.
      }
      break;
    }
  }
  throw new ConfigError("CONFIG_ENV_DECODE", configPath);
}

function decodeLayer(value: unknown, prefix = ""): unknown {
  if (!isRecord(value)) return value;
  const result: UnknownRecord = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = prefix ? `${prefix}.${key}` : key;
    const metadata =
      configFieldMetadata[childPath as keyof typeof configFieldMetadata];
    result[key] = metadata
      ? decodeScalar(child, metadata, childPath)
      : decodeLayer(child, childPath);
  }
  return result;
}

function cloneRecord<T>(value: T): T {
  return structuredClone(value);
}

function recordDefaultProvenance(
  value: unknown,
  result: Record<string, ConfigSource>,
  prefix = "",
): void {
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = prefix ? `${prefix}.${key}` : key;
    if (isRecord(child)) recordDefaultProvenance(child, result, childPath);
    else result[childPath] = "default";
  }
}

function mergeLayer(
  target: UnknownRecord,
  layer: UnknownRecord,
  source: ConfigSource,
  provenance: Record<string, ConfigSource>,
  prefix = "",
): void {
  for (const [key, value] of Object.entries(layer)) {
    const childPath = prefix ? `${prefix}.${key}` : key;
    if (isRecord(value) && isRecord(target[key])) {
      mergeLayer(target[key], value, source, provenance, childPath);
    } else {
      target[key] = cloneRecord(value);
      provenance[childPath] = source;
    }
  }
}

function envNameFor(configPath: string): string {
  const screaming = configPath
    .split(".")
    .map((part) => part.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toUpperCase())
    .join("__");
  return `APEX_HOUR__${screaming}`;
}

const environmentPathByName = new Map(
  Object.keys(configFieldMetadata).map((configPath) => [
    envNameFor(configPath),
    configPath,
  ]),
);

function setNested(
  target: UnknownRecord,
  configPath: string,
  value: unknown,
): void {
  const parts = configPath.split(".");
  const final = parts.pop();
  if (!final) throw new ConfigError("CONFIG_ENV_UNKNOWN");
  let current = target;
  for (const part of parts) {
    const existing = current[part];
    if (!isRecord(existing)) current[part] = {};
    current = current[part] as UnknownRecord;
  }
  current[final] = value;
}

function environmentLayer(
  environment: Readonly<Record<string, string | undefined>>,
): UnknownRecord {
  const result: UnknownRecord = {};
  for (const [name, rawValue] of Object.entries(environment)) {
    if (!name.startsWith("APEX_HOUR__")) continue;
    const configPath = environmentPathByName.get(name);
    if (!configPath) throw new ConfigError("CONFIG_ENV_UNKNOWN", name);
    if (rawValue === undefined) continue;
    const metadata =
      configFieldMetadata[configPath as keyof typeof configFieldMetadata];
    setNested(result, configPath, decodeScalar(rawValue, metadata, configPath));
  }
  return result;
}

export function parseYamlConfig(
  yamlText: string,
  maximumFileBytes = defaultConfig.config.maximumFileBytes,
): UnknownRecord {
  if (Buffer.byteLength(yamlText, "utf8") > maximumFileBytes) {
    throw new ConfigError("CONFIG_YAML_TOO_LARGE");
  }
  try {
    const document = parseDocument(yamlText, {
      schema: "failsafe",
      uniqueKeys: true,
      customTags: [],
    });
    if (document.errors.length > 0) throw new Error("invalid yaml");
    visit(document, {
      Alias() {
        throw new Error("aliases forbidden");
      },
      Node(_key, node) {
        if (
          node.tag &&
          ![
            "tag:yaml.org,2002:map",
            "tag:yaml.org,2002:seq",
            "tag:yaml.org,2002:str",
          ].includes(node.tag)
        ) {
          throw new Error("custom tags forbidden");
        }
      },
    });
    const parsed: unknown = document.toJS({ maxAliasCount: 0 });
    if (parsed === null) return {};
    if (!isRecord(parsed)) throw new Error("root must be object");
    return decodeLayer(parsed) as UnknownRecord;
  } catch {
    throw new ConfigError("CONFIG_YAML_PARSE");
  }
}

export function redactConfig(config: AppConfig): UnknownRecord {
  const redact = (value: unknown, prefix = ""): unknown => {
    if (!isRecord(value)) return value;
    const result: UnknownRecord = {};
    for (const [key, child] of Object.entries(value)) {
      const childPath = prefix ? `${prefix}.${key}` : key;
      const metadata =
        configFieldMetadata[childPath as keyof typeof configFieldMetadata];
      if (metadata?.sensitivity === "secret") result[key] = "[REDACTED]";
      else if (metadata?.sensitivity === "path")
        result[key] = child === null ? null : "[PATH]";
      else result[key] = redact(child, childPath);
    }
    return result;
  };
  return redact(config) as UnknownRecord;
}

export function resolveConfig(
  options: {
    defaults?: AppConfig;
    yamlText?: string;
    environment?: Readonly<Record<string, string | undefined>>;
  } = {},
): {
  config: AppConfig;
  provenance: ConfigProvenance;
  redacted: UnknownRecord;
} {
  const defaults = options.defaults ?? defaultConfig;
  const merged = cloneRecord(defaults) as UnknownRecord;
  const provenance: Record<string, ConfigSource> = {};
  recordDefaultProvenance(defaults, provenance);

  if (options.yamlText !== undefined) {
    mergeLayer(
      merged,
      parseYamlConfig(options.yamlText, defaults.config.maximumFileBytes),
      "yaml",
      provenance,
    );
  }
  const env = environmentLayer(options.environment ?? {});
  mergeLayer(merged, env, "environment", provenance);

  const parsed = appConfigSchema.safeParse(merged);
  if (!parsed.success) {
    const configPath = parsed.error.issues[0]?.path.join(".") || "root";
    throw new ConfigError("CONFIG_VALIDATION", configPath);
  }
  return {
    config: parsed.data,
    provenance,
    redacted: redactConfig(parsed.data),
  };
}

export async function loadConfigFile(options: {
  filePath: string;
  optionalDefaultPath?: boolean;
  environment?: Readonly<Record<string, string | undefined>>;
  maximumFileBytes?: number;
}): Promise<ReturnType<typeof resolveConfig>> {
  let yamlText: string;
  try {
    yamlText = await readFile(options.filePath, "utf8");
  } catch (error) {
    const code =
      isRecord(error) && typeof error.code === "string" ? error.code : "";
    if (code === "ENOENT" && options.optionalDefaultPath) {
      return resolveConfig({
        ...(options.environment ? { environment: options.environment } : {}),
      });
    }
    throw new ConfigError(
      code === "ENOENT" ? "CONFIG_FILE_MISSING" : "CONFIG_FILE_UNREADABLE",
      "config.file",
    );
  }
  if (
    Buffer.byteLength(yamlText, "utf8") >
    (options.maximumFileBytes ?? defaultConfig.config.maximumFileBytes)
  ) {
    throw new ConfigError("CONFIG_YAML_TOO_LARGE", "config.file");
  }
  const resolved = resolveConfig({
    yamlText,
    ...(options.environment ? { environment: options.environment } : {}),
  });
  if (
    (resolved.config.mode === "production" ||
      !resolved.config.paths.allowOutsideRootsInDevelopment) &&
    !isPathInsideRoot(options.filePath, resolved.config.paths.configRoot)
  ) {
    throw new ConfigError("CONFIG_VALIDATION", "config.file");
  }
  return resolved;
}
