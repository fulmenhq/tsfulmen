/**
 * Helpers Tests
 *
 * Test convenience helper functions
 */

import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildEnvVar,
  clearIdentityCache,
  getBinaryName,
  getConfigIdentifiers,
  getConfigName,
  getEnvPrefix,
  getEnvVar,
  getTelemetryNamespace,
  getVendor,
} from "../index.js";

describe("identity helpers", () => {
  const fixturesDir = join(__dirname, "../__fixtures__/valid");
  const minimalFixture = join(fixturesDir, "minimal.yaml");
  const completeFixture = join(fixturesDir, "complete.yaml");

  beforeEach(() => {
    clearIdentityCache();
  });

  afterEach(() => {
    clearIdentityCache();
  });

  describe("field accessors", () => {
    it("should get binary name", async () => {
      const binaryName = await getBinaryName({ path: minimalFixture });
      expect(binaryName).toBe("testapp");
    });

    it("should get vendor", async () => {
      const vendor = await getVendor({ path: minimalFixture });
      expect(vendor).toBe("testvendor");
    });

    it("should get env prefix", async () => {
      const envPrefix = await getEnvPrefix({ path: minimalFixture });
      expect(envPrefix).toBe("TESTAPP_");
    });

    it("should get config name", async () => {
      const configName = await getConfigName({ path: minimalFixture });
      expect(configName).toBe("testapp");
    });
  });

  describe("getTelemetryNamespace", () => {
    it("should return metadata.telemetry_namespace if present", async () => {
      const namespace = await getTelemetryNamespace({ path: completeFixture });
      expect(namespace).toBe("acmecorp_myapp");
    });

    it("should fall back to binary_name if telemetry_namespace not present", async () => {
      const namespace = await getTelemetryNamespace({ path: minimalFixture });
      expect(namespace).toBe("testapp"); // Falls back to binary_name
    });
  });

  describe("getConfigIdentifiers", () => {
    it("should return vendor and configName", async () => {
      const identifiers = await getConfigIdentifiers({ path: minimalFixture });

      expect(identifiers).toEqual({
        vendor: "testvendor",
        configName: "testapp",
      });
    });

    it("should return frozen object for immutability", async () => {
      const identifiers = await getConfigIdentifiers({ path: minimalFixture });

      expect(Object.isFrozen(identifiers)).toBe(true);
      expect(identifiers.vendor).toBe("testvendor");
      expect(identifiers.configName).toBe("testapp");
    });
  });

  describe("buildEnvVar", () => {
    it("should build env var name with prefix", async () => {
      const envVar = await buildEnvVar("database_url", { path: minimalFixture });
      expect(envVar).toBe("TESTAPP_DATABASE_URL");
    });

    it("should uppercase the key", async () => {
      const envVar = await buildEnvVar("my_var", { path: minimalFixture });
      expect(envVar).toBe("TESTAPP_MY_VAR");
    });

    it("should handle already uppercase keys", async () => {
      const envVar = await buildEnvVar("API_KEY", { path: minimalFixture });
      expect(envVar).toBe("TESTAPP_API_KEY");
    });

    it("should handle mixed case keys", async () => {
      const envVar = await buildEnvVar("MyVariable", { path: minimalFixture });
      expect(envVar).toBe("TESTAPP_MYVARIABLE");
    });

    it("should normalize hyphens to underscores", async () => {
      const envVar = await buildEnvVar("database-url", { path: minimalFixture });
      expect(envVar).toBe("TESTAPP_DATABASE_URL");
    });

    it("should normalize dots to underscores", async () => {
      const envVar = await buildEnvVar("my.config", { path: minimalFixture });
      expect(envVar).toBe("TESTAPP_MY_CONFIG");
    });

    it("should normalize multiple invalid characters", async () => {
      const envVar = await buildEnvVar("my-config.value@test", { path: minimalFixture });
      expect(envVar).toBe("TESTAPP_MY_CONFIG_VALUE_TEST");
    });

    it("should preserve existing underscores", async () => {
      const envVar = await buildEnvVar("my_valid_var", { path: minimalFixture });
      expect(envVar).toBe("TESTAPP_MY_VALID_VAR");
    });
  });

  describe("getEnvVar", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      // Restore original env
      process.env = { ...originalEnv };
    });

    it("should get env var value using app prefix", async () => {
      process.env.TESTAPP_DATABASE_URL = "postgres://localhost/db";

      const value = await getEnvVar("database_url", { path: minimalFixture });
      expect(value).toBe("postgres://localhost/db");
    });

    it("should return undefined if env var not set", async () => {
      delete process.env.TESTAPP_MISSING_VAR;

      const value = await getEnvVar("missing_var", { path: minimalFixture });
      expect(value).toBeUndefined();
    });

    it("should handle uppercase keys", async () => {
      process.env.TESTAPP_API_KEY = "secret123";

      const value = await getEnvVar("API_KEY", { path: minimalFixture });
      expect(value).toBe("secret123");
    });

    it("should work with complete fixture", async () => {
      process.env.MYAPP_PORT = "3000";

      const value = await getEnvVar("port", { path: completeFixture });
      expect(value).toBe("3000");
    });
  });

  describe("caching behavior", () => {
    it("should benefit from loadIdentity caching", async () => {
      // First call loads identity
      const name1 = await getBinaryName({ path: minimalFixture });

      // Second call should use cache (same path, no skipCache)
      const name2 = await getBinaryName({ path: minimalFixture });

      expect(name1).toBe(name2);
      expect(name1).toBe("testapp");
    });

    it("should work with different helpers on same identity", async () => {
      const binaryName = await getBinaryName({ path: minimalFixture });
      const vendor = await getVendor({ path: minimalFixture });
      const envPrefix = await getEnvPrefix({ path: minimalFixture });

      expect(binaryName).toBe("testapp");
      expect(vendor).toBe("testvendor");
      expect(envPrefix).toBe("TESTAPP_");
    });

    it("should respect skipCache option", async () => {
      const name1 = await getBinaryName({ path: minimalFixture });
      const name2 = await getBinaryName({
        path: minimalFixture,
        skipCache: true,
      });

      // Both should return same value
      expect(name1).toBe("testapp");
      expect(name2).toBe("testapp");
    });
  });

  describe("test injection support", () => {
    it("should work with test injection", async () => {
      const testIdentity = {
        app: {
          binary_name: "injected",
          vendor: "testco",
          env_prefix: "INJECTED_",
          config_name: "injected",
          description: "Test injection",
        },
      };

      const binaryName = await getBinaryName({ identity: testIdentity });
      const vendor = await getVendor({ identity: testIdentity });

      expect(binaryName).toBe("injected");
      expect(vendor).toBe("testco");
    });

    it("should build env vars with test injection", async () => {
      const testIdentity = {
        app: {
          binary_name: "mytest",
          vendor: "testco",
          env_prefix: "MYTEST_",
          config_name: "mytest",
          description: "Test injection",
        },
      };

      const envVar = await buildEnvVar("api_key", { identity: testIdentity });
      expect(envVar).toBe("MYTEST_API_KEY");
    });
  });

  describe("error handling", () => {
    it("should propagate errors from loadIdentity", async () => {
      await expect(getBinaryName({ path: "/nonexistent/app.yaml" })).rejects.toThrow();
    });

    it("should propagate validation errors", async () => {
      const invalidDir = join(__dirname, "../__fixtures__/invalid");
      await expect(
        getVendor({ path: join(invalidDir, "missing-required.yaml") }),
      ).rejects.toThrow();
    });
  });
});
