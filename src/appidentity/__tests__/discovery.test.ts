/**
 * Discovery Tests
 *
 * Test discovery precedence algorithm and error cases
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { APP_IDENTITY_DIR, APP_IDENTITY_ENV_VAR, APP_IDENTITY_FILENAME } from "../constants.js";
import { discoverIdentityPath } from "../discovery.js";
import { AppIdentityError } from "../errors.js";

describe("discoverIdentityPath", () => {
  const originalEnv = process.env[APP_IDENTITY_ENV_VAR];
  let tempDir: string;

  beforeEach(async () => {
    // Clean up env var
    delete process.env[APP_IDENTITY_ENV_VAR];

    // Create temp directory for tests
    tempDir = join(tmpdir(), `appidentity-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Restore env var
    if (originalEnv) {
      process.env[APP_IDENTITY_ENV_VAR] = originalEnv;
    } else {
      delete process.env[APP_IDENTITY_ENV_VAR];
    }

    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("precedence order", () => {
    it("should prioritize explicit path parameter", async () => {
      const explicitPath = join(tempDir, "explicit-app.yaml");
      await writeFile(explicitPath, "app: {}");

      const result = await discoverIdentityPath({ path: explicitPath });

      expect(result).toBeDefined();
      expect(result?.source).toBe("explicit");
      expect(result?.path).toBe(explicitPath);
    });

    it("should use FULMEN_APP_IDENTITY_PATH env var", async () => {
      const envPath = join(tempDir, "env-app.yaml");
      await writeFile(envPath, "app: {}");

      process.env[APP_IDENTITY_ENV_VAR] = envPath;

      const result = await discoverIdentityPath();

      expect(result).toBeDefined();
      expect(result?.source).toBe("env");
      expect(result?.path).toBe(envPath);
    });

    it("should search ancestors from CWD", async () => {
      const identityDir = join(tempDir, APP_IDENTITY_DIR);
      const identityPath = join(identityDir, APP_IDENTITY_FILENAME);
      await mkdir(identityDir, { recursive: true });
      await writeFile(identityPath, "app: {}");

      const result = await discoverIdentityPath({ startDir: tempDir });

      expect(result).toBeDefined();
      expect(result?.source).toBe("ancestor");
      expect(result?.path).toBe(identityPath);
    });

    it("should prefer explicit over env var", async () => {
      const explicitPath = join(tempDir, "explicit-app.yaml");
      const envPath = join(tempDir, "env-app.yaml");
      await writeFile(explicitPath, "app: {}");
      await writeFile(envPath, "app: {}");

      process.env[APP_IDENTITY_ENV_VAR] = envPath;

      const result = await discoverIdentityPath({ path: explicitPath });

      expect(result?.source).toBe("explicit");
      expect(result?.path).toBe(explicitPath);
    });

    it("should prefer env var over ancestor", async () => {
      const envPath = join(tempDir, "env-app.yaml");
      const identityDir = join(tempDir, APP_IDENTITY_DIR);
      const identityPath = join(identityDir, APP_IDENTITY_FILENAME);
      await writeFile(envPath, "app: {}");
      await mkdir(identityDir, { recursive: true });
      await writeFile(identityPath, "app: {}");

      process.env[APP_IDENTITY_ENV_VAR] = envPath;

      const result = await discoverIdentityPath({ startDir: tempDir });

      expect(result?.source).toBe("env");
      expect(result?.path).toBe(envPath);
    });
  });

  describe("ancestor search", () => {
    it("should find identity in parent directory", async () => {
      const parentDir = join(tempDir, "parent");
      const childDir = join(parentDir, "child");
      const identityDir = join(parentDir, APP_IDENTITY_DIR);
      const identityPath = join(identityDir, APP_IDENTITY_FILENAME);

      await mkdir(childDir, { recursive: true });
      await mkdir(identityDir, { recursive: true });
      await writeFile(identityPath, "app: {}");

      const result = await discoverIdentityPath({ startDir: childDir });

      expect(result).toBeDefined();
      expect(result?.source).toBe("ancestor");
      expect(result?.path).toBe(identityPath);
    });

    it("should find identity in grandparent directory", async () => {
      const grandparentDir = join(tempDir, "grandparent");
      const parentDir = join(grandparentDir, "parent");
      const childDir = join(parentDir, "child");
      const identityDir = join(grandparentDir, APP_IDENTITY_DIR);
      const identityPath = join(identityDir, APP_IDENTITY_FILENAME);

      await mkdir(childDir, { recursive: true });
      await mkdir(identityDir, { recursive: true });
      await writeFile(identityPath, "app: {}");

      const result = await discoverIdentityPath({ startDir: childDir });

      expect(result).toBeDefined();
      expect(result?.source).toBe("ancestor");
      expect(result?.path).toBe(identityPath);
    });

    it("should use closest ancestor when multiple exist", async () => {
      const grandparentDir = join(tempDir, "grandparent");
      const parentDir = join(grandparentDir, "parent");
      const childDir = join(parentDir, "child");

      // Create identity in both grandparent and parent
      const grandparentIdentityDir = join(grandparentDir, APP_IDENTITY_DIR);
      const parentIdentityDir = join(parentDir, APP_IDENTITY_DIR);
      const grandparentIdentityPath = join(grandparentIdentityDir, APP_IDENTITY_FILENAME);
      const parentIdentityPath = join(parentIdentityDir, APP_IDENTITY_FILENAME);

      await mkdir(childDir, { recursive: true });
      await mkdir(grandparentIdentityDir, { recursive: true });
      await mkdir(parentIdentityDir, { recursive: true });
      await writeFile(grandparentIdentityPath, "app: {name: grandparent}");
      await writeFile(parentIdentityPath, "app: {name: parent}");

      const result = await discoverIdentityPath({ startDir: childDir });

      expect(result).toBeDefined();
      expect(result?.path).toBe(parentIdentityPath); // Closer one
    });
  });

  describe("error cases", () => {
    it("should throw when explicit path does not exist", async () => {
      const nonExistentPath = join(tempDir, "does-not-exist.yaml");

      await expect(discoverIdentityPath({ path: nonExistentPath })).rejects.toThrow(
        AppIdentityError,
      );
    });

    it("should throw when env var points to missing file", async () => {
      const nonExistentPath = join(tempDir, "does-not-exist.yaml");
      process.env[APP_IDENTITY_ENV_VAR] = nonExistentPath;

      await expect(discoverIdentityPath()).rejects.toThrow(AppIdentityError);
    });

    it("should throw when ancestor search finds nothing", async () => {
      // Empty temp directory, no identity file
      await expect(discoverIdentityPath({ startDir: tempDir })).rejects.toThrow(AppIdentityError);
    });

    it("should include searched paths in error message", async () => {
      try {
        await discoverIdentityPath({ startDir: tempDir });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AppIdentityError);
        expect((error as Error).message).toContain("Searched paths");
      }
    });
  });
});
