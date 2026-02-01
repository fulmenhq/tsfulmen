import { mkdtemp, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../loader.js";
import type { AppIdentifier } from "../types.js";

// Mock homedir to ensure validation passes
vi.mock("node:os", async () => {
  const actual = await vi.importActual("node:os");
  return {
    ...actual,
    // biome-ignore lint/suspicious/noExplicitAny: Mocking node:os requires any cast for partial mock
    homedir: () => process.env.MOCKED_HOME || (actual as any).homedir(),
  };
});

describe("Config Loader (Phase 1)", () => {
  let tempDir: string;
  let defaultsPath: string;
  let userConfigDir: string;

  const identity: AppIdentifier = {
    vendor: "test-vendor",
    app: "test-app",
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "fulmen-config-test-"));
    defaultsPath = join(tempDir, "defaults.yaml");

    // Create defaults file
    await writeFile(defaultsPath, "server:\n  port: 8080\n  host: localhost\n", "utf-8");

    // Mock XDG_CONFIG_HOME/FULMEN_CONFIG_HOME for user config
    // And set MOCKED_HOME so validation passes (tempDir is now considered "home")
    userConfigDir = join(tempDir, "config");
    process.env.MOCKED_HOME = tempDir;
    process.env.XDG_CONFIG_HOME = userConfigDir;
    process.env.FULMEN_CONFIG_HOME = userConfigDir;
  });

  afterEach(async () => {
    await rmdir(tempDir, { recursive: true });
    delete process.env.XDG_CONFIG_HOME;
    delete process.env.FULMEN_CONFIG_HOME;
    delete process.env.MOCKED_HOME;
    vi.clearAllMocks();
  });

  it("should load defaults only when user config is missing", async () => {
    const result = await loadConfig({
      identity,
      defaultsPath,
    });

    expect(result.config).toEqual({
      server: {
        port: 8080,
        host: "localhost",
      },
    });
    expect(result.metadata.activeLayers).toEqual(["defaults"]);
    expect(result.metadata.userConfigPath).toBeNull();
  });

  it("should merge user config over defaults", async () => {
    // Create user config
    const appConfigDir = join(userConfigDir, "fulmen", "test-vendor", "test-app");
    const userConfigPath = join(appConfigDir, "test-app.yaml");

    // Ensure dir exists (using fs directly for test setup)
    const fs = await import("node:fs/promises");
    await fs.mkdir(appConfigDir, { recursive: true });
    await writeFile(userConfigPath, "server:\n  port: 9090\n", "utf-8");

    const result = await loadConfig({
      identity,
      defaultsPath,
    });

    expect(result.config).toEqual({
      server: {
        port: 9090,
        host: "localhost",
      },
    });
    expect(result.metadata.activeLayers).toEqual(["defaults", "user"]);
    expect(result.metadata.userConfigPath).toBe(userConfigPath);
  });

  it("should support custom user config name", async () => {
    const appConfigDir = join(userConfigDir, "fulmen", "test-vendor", "test-app");
    const userConfigPath = join(appConfigDir, "custom.json");

    const fs = await import("node:fs/promises");
    await fs.mkdir(appConfigDir, { recursive: true });
    await writeFile(userConfigPath, JSON.stringify({ server: { host: "0.0.0.0" } }), "utf-8");

    const result = await loadConfig({
      identity,
      defaultsPath,
      userConfigName: "custom",
    });

    expect(result.config).toEqual({
      server: {
        port: 8080,
        host: "0.0.0.0",
      },
    });
    expect(result.metadata.userConfigPath).toBe(userConfigPath);
  });

  it("should merge env vars over user config and defaults", async () => {
    // Mock env vars
    process.env.TEST_APP_SERVER_PORT = "7070";
    process.env.TEST_APP_DEBUG = "true";
    process.env.TEST_APP_METRICS_ENABLED = "false";

    const result = await loadConfig({
      identity,
      defaultsPath,
      // Defaults env prefix would be TEST_APP derived from identity.app "test-app"
    });

    expect(result.config).toEqual({
      server: {
        port: 7070,
        host: "localhost",
      },
      debug: true,
      metrics: {
        enabled: false,
      },
    });
    expect(result.metadata.activeLayers).toContain("env");
    expect(result.metadata.envPrefix).toBe("TEST_APP");

    // Cleanup
    delete process.env.TEST_APP_SERVER_PORT;
    delete process.env.TEST_APP_DEBUG;
    delete process.env.TEST_APP_METRICS_ENABLED;
  });

  it("should report env vars consumed when enabled", async () => {
    process.env.TEST_APP_SERVER_PORT = "7070";
    process.env.TEST_APP_DEBUG = "true";

    const result = await loadConfig({
      identity,
      defaultsPath,
      includeEnvVarReport: true,
    });

    expect(result.metadata.envVarsConsumedCount).toBe(2);
    expect(result.metadata.envVarsConsumed).toEqual(["TEST_APP_DEBUG", "TEST_APP_SERVER_PORT"]);

    delete process.env.TEST_APP_SERVER_PORT;
    delete process.env.TEST_APP_DEBUG;
  });

  it("should validate config against schema if provided", async () => {
    const schemaPath = join(tempDir, "schema.json");
    const schema = {
      type: "object",
      properties: {
        server: {
          type: "object",
          properties: {
            port: { type: "integer" },
            host: { type: "string" },
          },
          required: ["port", "host"],
        },
      },
      required: ["server"],
    };
    await writeFile(schemaPath, JSON.stringify(schema), "utf-8");

    const result = await loadConfig({
      identity,
      defaultsPath,
      schemaPath,
    });

    expect(result.metadata.schema.validated).toBe(true);
    expect(result.metadata.schema.path).toBe(schemaPath);
  });

  it("should throw validation error for invalid config", async () => {
    const schemaPath = join(tempDir, "schema.json");
    const schema = {
      type: "object",
      properties: {
        server: {
          type: "object",
          properties: {
            port: { type: "integer", maximum: 1000 }, // Max 1000, defaults has 8080
          },
        },
      },
    };
    await writeFile(schemaPath, JSON.stringify(schema), "utf-8");

    await expect(
      loadConfig({
        identity,
        defaultsPath,
        schemaPath,
      }),
    ).rejects.toThrow("Configuration validation failed");
  });
});
