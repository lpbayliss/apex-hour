import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  ConfigError,
  defaultConfig,
  loadConfigFile,
  parseYamlConfig,
  resolveConfig,
} from "./index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function expectConfigError(
  action: () => unknown,
  code: ConfigError["code"],
  forbiddenValue?: string,
): void {
  try {
    action();
    throw new Error("Expected ConfigError");
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).code).toBe(code);
    if (forbiddenValue)
      expect((error as Error).message).not.toContain(forbiddenValue);
  }
}

describe("configuration precedence, decode, and provenance", () => {
  it("recursively merges defaults < YAML < environment and replaces arrays", () => {
    const defaults = structuredClone(defaultConfig);
    defaults.server.allowedOrigins = [
      "https://default-one.example",
      "https://default-two.example",
    ];

    const result = resolveConfig({
      defaults,
      yamlText: `
server:
  port: 4100
  allowedOrigins:
    - https://yaml.example
  trustedProxy:
    enabled: true
    cidrs:
      - 10.0.0.0/8
metrics:
  enabled: false
`,
      environment: {
        APEX_HOUR__SERVER__PORT: "4200",
        APEX_HOUR__SERVER__ALLOWED_ORIGINS: '["https://environment.example"]',
        APEX_HOUR__METRICS__ENABLED: "true",
      },
    });

    expect(result.config.server.port).toBe(4200);
    expect(result.config.server.allowedOrigins).toEqual([
      "https://environment.example",
    ]);
    expect(result.config.server.trustedProxy).toEqual({
      enabled: true,
      cidrs: ["10.0.0.0/8"],
    });
    expect(result.config.metrics.enabled).toBe(true);
    expect(result.provenance["server.port"]).toBe("environment");
    expect(result.provenance["server.trustedProxy.enabled"]).toBe("yaml");
    expect(result.provenance["database.path"]).toBe("default");
  });

  it("decodes schema-directed JSON objects, arrays, null, booleans, and numbers", () => {
    const result = resolveConfig({
      environment: {
        APEX_HOUR__SERVER__TRUSTED_PROXY:
          '{"enabled":true,"cidrs":["127.0.0.1/32"]}',
        APEX_HOUR__SERVER__ALLOWED_ORIGINS: "[]",
        APEX_HOUR__CONFIG__FILE: "",
        APEX_HOUR__METRICS__BEARER_TOKEN: "null",
        APEX_HOUR__SIMULATION__LIVE_DURATION_SECONDS: "1200",
      },
    });

    expect(result.config.server.trustedProxy).toEqual({
      enabled: true,
      cidrs: ["127.0.0.1/32"],
    });
    expect(result.config.config.file).toBeNull();
    expect(result.config.metrics.bearerToken).toBeNull();
    expect(result.config.simulation.liveDurationSeconds).toBe(1200);
  });

  it.each([
    ["APEX_HOUR__UNKNOWN__FIELD", "value", "CONFIG_ENV_UNKNOWN"],
    ["APEX_HOUR__METRICS__ENABLED", "TRUE", "CONFIG_ENV_DECODE"],
    ["APEX_HOUR__SERVER__PORT", "Infinity", "CONFIG_ENV_DECODE"],
    ["APEX_HOUR__SERVER__ALLOWED_ORIGINS", "not-json", "CONFIG_ENV_DECODE"],
    ["APEX_HOUR__SERVER__TRUSTED_PROXY", "[]", "CONFIG_ENV_DECODE"],
  ] as const)("rejects unsafe environment %s decoding", (name, value, code) => {
    expectConfigError(
      () => resolveConfig({ environment: { [name]: value } }),
      code,
      value,
    );
  });

  it("does not silently remove required empty values or echo URL credentials", () => {
    expectConfigError(
      () =>
        resolveConfig({
          environment: { APEX_HOUR__SERVER__PUBLIC_ORIGIN: "" },
        }),
      "CONFIG_VALIDATION",
    );
    const credentialUrl = "https://operator:secret@example.com";
    expectConfigError(
      () =>
        resolveConfig({
          environment: {
            APEX_HOUR__SERVER__PUBLIC_ORIGIN: credentialUrl,
          },
        }),
      "CONFIG_VALIDATION",
      credentialUrl,
    );
  });
});

describe("strict data-only YAML", () => {
  it("decodes failsafe scalar data without permitting executable configuration", () => {
    expect(
      parseYamlConfig(`
server:
  port: 4300
metrics:
  enabled: true
`),
    ).toEqual({
      server: { port: 4300 },
      metrics: { enabled: true },
    });
  });

  it.each([
    ["duplicate keys", "mode: production\nmode: development"],
    ["custom tags", "mode: !javascript production"],
    ["aliases", "server: &base\n  port: 3000\ncopy: *base"],
    ["non-object root", "- production"],
  ])("rejects %s with a stable parser code", (_name, yaml) => {
    expectConfigError(() => parseYamlConfig(yaml), "CONFIG_YAML_PARSE", yaml);
  });

  it("rejects unknown YAML keys during the single final schema validation", () => {
    const unknownValue = "must-not-be-echoed";
    expectConfigError(
      () => resolveConfig({ yamlText: `unknownField: ${unknownValue}` }),
      "CONFIG_VALIDATION",
      unknownValue,
    );
  });

  it("rejects expansion before parsing", () => {
    expectConfigError(
      () => parseYamlConfig(`mode: ${"x".repeat(256)}`, 64),
      "CONFIG_YAML_TOO_LARGE",
    );
  });
});

describe("configuration file behavior", () => {
  it("allows an absent optional default path but rejects an explicitly configured missing path", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "apex-hour-config-"));
    temporaryDirectories.push(directory);
    const missing = path.join(directory, "missing.yaml");

    await expect(
      loadConfigFile({ filePath: missing, optionalDefaultPath: true }),
    ).resolves.toMatchObject({ config: defaultConfig });
    await expect(loadConfigFile({ filePath: missing })).rejects.toMatchObject({
      code: "CONFIG_FILE_MISSING",
      configPath: "config.file",
    });
  });

  it("loads a readable file and rejects an unreadable directory without leaking its path", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "apex-hour-config-"));
    temporaryDirectories.push(directory);
    const file = path.join(directory, "config.yaml");
    await writeFile(
      file,
      "mode: development\npaths:\n  allowOutsideRootsInDevelopment: true\nserver:\n  port: 4400\n",
      "utf8",
    );
    await expect(loadConfigFile({ filePath: file })).resolves.toMatchObject({
      config: { server: { port: 4400 } },
    });

    const unreadable = path.join(directory, "directory.yaml");
    await mkdir(unreadable);
    try {
      await loadConfigFile({ filePath: unreadable });
      throw new Error("Expected unreadable config failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "CONFIG_FILE_UNREADABLE" });
      expect((error as Error).message).not.toContain(unreadable);
    }

    const productionFile = path.join(directory, "production.yaml");
    await writeFile(productionFile, "mode: production\n", "utf8");
    await expect(
      loadConfigFile({ filePath: productionFile }),
    ).rejects.toMatchObject({
      code: "CONFIG_VALIDATION",
      configPath: "config.file",
    });
  });
});

describe("operations config boundary compatibility table", () => {
  it("recursively redacts schema-marked secrets and filesystem paths", () => {
    const token = "embedded-production-token-value";
    const result = resolveConfig({
      environment: {
        APEX_HOUR__METRICS__BEARER_TOKEN: token,
        APEX_HOUR__CONFIG__FILE: "/config/private/config.yaml",
      },
    });

    expect(result.redacted).toMatchObject({
      database: { path: "[PATH]" },
      backup: { directory: "[PATH]" },
      config: { file: "[PATH]" },
      metrics: { bearerToken: "[REDACTED]" },
      paths: {
        dataRoot: "[PATH]",
        configRoot: "[PATH]",
        backupRoot: "[PATH]",
      },
    });
    expect(JSON.stringify(result.redacted)).not.toContain(token);
    expect(result.provenance["metrics.bearerToken"]).toBe("environment");
  });

  it.each([
    [
      "database.path",
      (config: typeof defaultConfig) =>
        (config.database.path = "/tmp/db.sqlite3"),
    ],
    [
      "backup.directory",
      (config: typeof defaultConfig) =>
        (config.backup.directory = "/tmp/backup"),
    ],
    [
      "config.file",
      (config: typeof defaultConfig) =>
        (config.config.file = "/tmp/config.yaml"),
    ],
  ])(
    "rejects production %s outside its allowlisted root",
    (expectedPath, mutate) => {
      const defaults = structuredClone(defaultConfig);
      mutate(defaults);
      try {
        resolveConfig({ defaults });
        throw new Error("Expected path validation failure");
      } catch (error) {
        expect(error).toMatchObject({
          code: "CONFIG_VALIDATION",
          configPath: expectedPath,
        });
        expect((error as Error).message).not.toContain("/tmp/");
      }
    },
  );

  it("permits only the named development path override outside roots", () => {
    const development = structuredClone(defaultConfig);
    development.mode = "development";
    development.paths.allowOutsideRootsInDevelopment = true;
    development.database.path = "./local.sqlite3";
    development.backup.directory = "./local-backup";
    development.config.file = "./local.yaml";
    expect(resolveConfig({ defaults: development }).config.mode).toBe(
      "development",
    );

    const production = structuredClone(development);
    production.mode = "production";
    expectConfigError(
      () => resolveConfig({ defaults: production }),
      "CONFIG_VALIDATION",
    );

    const developmentWithoutOverride = structuredClone(development);
    developmentWithoutOverride.paths.allowOutsideRootsInDevelopment = false;
    expectConfigError(
      () => resolveConfig({ defaults: developmentWithoutOverride }),
      "CONFIG_VALIDATION",
    );
  });

  it("rejects token-bearing origin query strings without echoing them", () => {
    const unsafeOrigin = "https://example.com/?access_token=embedded-secret";
    expectConfigError(
      () =>
        resolveConfig({
          environment: { APEX_HOUR__SERVER__PUBLIC_ORIGIN: unsafeOrigin },
        }),
      "CONFIG_VALIDATION",
      unsafeOrigin,
    );
  });

  it("loads both committed example surfaces through the production resolver", async () => {
    const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
    const yamlText = await readFile(
      path.join(repositoryRoot, "config.example.yaml"),
      "utf8",
    );
    expect(resolveConfig({ yamlText }).config).toMatchObject({
      mode: "production",
      database: { path: "/data/apex-hour.sqlite3" },
    });

    const envText = await readFile(
      path.join(repositoryRoot, ".env.example"),
      "utf8",
    );
    const environment = Object.fromEntries(
      envText
        .split("\n")
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const separator = line.indexOf("=");
          return [line.slice(0, separator), line.slice(separator + 1)];
        }),
    );
    expect(resolveConfig({ environment }).config).toMatchObject({
      mode: "production",
      server: { port: 3000 },
      simulation: { raceIntervalSeconds: 3600 },
    });
  });
});
