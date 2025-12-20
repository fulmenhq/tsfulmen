/**
 * Embedded Identity Registration Tests
 *
 * Tests for registerEmbeddedIdentity() and related functions
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { AppIdentityError } from "../errors.js";
import {
  clearEmbeddedIdentity,
  clearIdentityCache,
  getEmbeddedIdentity,
  hasEmbeddedIdentity,
  loadIdentity,
  registerEmbeddedIdentity,
} from "../index.js";

// Valid minimal identity YAML
const VALID_YAML = `
app:
  binary_name: testapp
  vendor: testvendor
  env_prefix: TESTAPP_
  config_name: testapp
  description: Test application for unit testing
`;

// Valid identity object
const VALID_IDENTITY = {
  app: {
    binary_name: "testapp",
    vendor: "testvendor",
    env_prefix: "TESTAPP_",
    config_name: "testapp",
    description: "Test application for unit testing",
  },
};

// Invalid YAML (missing required fields)
const INVALID_YAML_MISSING_FIELDS = `
app:
  binary_name: testapp
`;

// Malformed YAML
const MALFORMED_YAML = `
app: {invalid yaml content
  binary_name: testapp
`;

describe("embedded identity registration", () => {
  beforeEach(() => {
    clearEmbeddedIdentity();
    clearIdentityCache();
  });

  afterEach(() => {
    clearEmbeddedIdentity();
    clearIdentityCache();
  });

  describe("registerEmbeddedIdentity", () => {
    test("should register valid YAML string", async () => {
      await registerEmbeddedIdentity(VALID_YAML);

      expect(hasEmbeddedIdentity()).toBe(true);
      const identity = getEmbeddedIdentity();
      expect(identity).not.toBeNull();
      expect(identity?.app.binary_name).toBe("testapp");
      expect(identity?.app.vendor).toBe("testvendor");
    });

    test("should register valid Identity object", async () => {
      await registerEmbeddedIdentity(VALID_IDENTITY);

      expect(hasEmbeddedIdentity()).toBe(true);
      const identity = getEmbeddedIdentity();
      expect(identity).not.toBeNull();
      expect(identity?.app.binary_name).toBe("testapp");
    });

    test("should freeze the registered identity", async () => {
      await registerEmbeddedIdentity(VALID_YAML);

      const identity = getEmbeddedIdentity();
      expect(identity).not.toBeNull();
      expect(Object.isFrozen(identity)).toBe(true);
      expect(Object.isFrozen(identity?.app)).toBe(true);
    });

    test("should throw on second registration (first-wins semantics)", async () => {
      await registerEmbeddedIdentity(VALID_YAML);

      await expect(registerEmbeddedIdentity(VALID_YAML)).rejects.toThrow(AppIdentityError);
      await expect(registerEmbeddedIdentity(VALID_YAML)).rejects.toThrow(/already registered/);
    });

    test("should throw on malformed YAML", async () => {
      await expect(registerEmbeddedIdentity(MALFORMED_YAML)).rejects.toThrow(AppIdentityError);
      expect(hasEmbeddedIdentity()).toBe(false);
    });

    test("should throw on invalid schema (missing required fields)", async () => {
      await expect(registerEmbeddedIdentity(INVALID_YAML_MISSING_FIELDS)).rejects.toThrow(
        AppIdentityError,
      );
      expect(hasEmbeddedIdentity()).toBe(false);
    });

    test("should validate Identity object against schema", async () => {
      const invalidObject = {
        app: {
          binary_name: "test",
          // Missing other required fields
        },
      };

      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input intentionally
      await expect(registerEmbeddedIdentity(invalidObject as any)).rejects.toThrow(
        AppIdentityError,
      );
      expect(hasEmbeddedIdentity()).toBe(false);
    });
  });

  describe("hasEmbeddedIdentity", () => {
    test("should return false before registration", () => {
      expect(hasEmbeddedIdentity()).toBe(false);
    });

    test("should return true after registration", async () => {
      await registerEmbeddedIdentity(VALID_YAML);
      expect(hasEmbeddedIdentity()).toBe(true);
    });

    test("should return false after clearing", async () => {
      await registerEmbeddedIdentity(VALID_YAML);
      clearEmbeddedIdentity();
      expect(hasEmbeddedIdentity()).toBe(false);
    });
  });

  describe("getEmbeddedIdentity", () => {
    test("should return null before registration", () => {
      expect(getEmbeddedIdentity()).toBeNull();
    });

    test("should return identity after registration", async () => {
      await registerEmbeddedIdentity(VALID_YAML);
      const identity = getEmbeddedIdentity();
      expect(identity).not.toBeNull();
      expect(identity?.app.binary_name).toBe("testapp");
    });

    test("should return null after clearing", async () => {
      await registerEmbeddedIdentity(VALID_YAML);
      clearEmbeddedIdentity();
      expect(getEmbeddedIdentity()).toBeNull();
    });
  });

  describe("clearEmbeddedIdentity", () => {
    test("should clear registered identity", async () => {
      await registerEmbeddedIdentity(VALID_YAML);
      expect(hasEmbeddedIdentity()).toBe(true);

      clearEmbeddedIdentity();
      expect(hasEmbeddedIdentity()).toBe(false);
      expect(getEmbeddedIdentity()).toBeNull();
    });

    test("should allow re-registration after clearing", async () => {
      await registerEmbeddedIdentity(VALID_YAML);
      clearEmbeddedIdentity();

      // Should not throw - cleared state allows new registration
      await registerEmbeddedIdentity(VALID_IDENTITY);
      expect(hasEmbeddedIdentity()).toBe(true);
    });
  });
});

describe("loadIdentity with embedded fallback", () => {
  beforeEach(() => {
    clearEmbeddedIdentity();
    clearIdentityCache();
  });

  afterEach(() => {
    clearEmbeddedIdentity();
    clearIdentityCache();
  });

  test("should use embedded identity when filesystem discovery fails", async () => {
    await registerEmbeddedIdentity(VALID_YAML);

    // Use a non-existent directory to force discovery failure
    const identity = await loadIdentity({
      startDir: "/nonexistent/path/that/does/not/exist",
    });

    expect(identity.app.binary_name).toBe("testapp");
    expect(identity.app.vendor).toBe("testvendor");
  });

  test("should throw when no embedded identity and discovery fails", async () => {
    // No embedded identity registered
    await expect(
      loadIdentity({ startDir: "/nonexistent/path/that/does/not/exist" }),
    ).rejects.toThrow(AppIdentityError);
  });

  test("should cache embedded identity for subsequent calls", async () => {
    await registerEmbeddedIdentity(VALID_YAML);

    // First call - uses embedded fallback
    const identity1 = await loadIdentity({
      startDir: "/nonexistent/path/that/does/not/exist",
    });

    // Second call - should use cache
    const identity2 = await loadIdentity({
      startDir: "/nonexistent/path/that/does/not/exist",
    });

    // Should be the same frozen object
    expect(identity1).toBe(identity2);
  });

  test("should prefer filesystem discovery over embedded", async () => {
    await registerEmbeddedIdentity(VALID_YAML);

    const fsYaml = `
app:
  binary_name: fsapp
  vendor: fsvendor
  env_prefix: FSAPP_
  config_name: fsapp
  description: Identity loaded from filesystem
`;

    const tempDir = await mkdtemp(join(tmpdir(), "appidentity-precedence-"));
    try {
      const identityDir = join(tempDir, ".fulmen");
      await mkdir(identityDir, { recursive: true });
      await writeFile(join(identityDir, "app.yaml"), fsYaml, "utf-8");

      const identity = await loadIdentity({ startDir: tempDir });
      expect(identity.app.binary_name).toBe("fsapp");
      expect(identity.app.vendor).toBe("fsvendor");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("should prefer explicit path over embedded", async () => {
    // Register embedded identity
    await registerEmbeddedIdentity(VALID_YAML);

    // Load from explicit fixture path - complete.yaml has different values
    const identity = await loadIdentity({
      path: "src/appidentity/__fixtures__/valid/complete.yaml",
    });

    // Should use fixture, not embedded (complete.yaml has "myapp")
    expect(identity.app.binary_name).toBe("myapp");
    expect(identity.app.vendor).toBe("acmecorp");
  });
});

describe("discovery precedence with embedded", () => {
  beforeEach(() => {
    clearEmbeddedIdentity();
    clearIdentityCache();
    // Clear env var if set
    delete process.env.FULMEN_APP_IDENTITY_PATH;
  });

  afterEach(() => {
    clearEmbeddedIdentity();
    clearIdentityCache();
    delete process.env.FULMEN_APP_IDENTITY_PATH;
  });

  test("env var takes precedence over embedded", async () => {
    await registerEmbeddedIdentity(VALID_YAML);

    // Set env var to a fixture
    process.env.FULMEN_APP_IDENTITY_PATH = "src/appidentity/__fixtures__/valid/complete.yaml";

    const identity = await loadIdentity();

    // Should use env var path, not embedded
    // complete.yaml has myapp as binary_name
    expect(identity.app.binary_name).toBe("myapp");
  });

  test("env var missing file does not fall back to embedded", async () => {
    await registerEmbeddedIdentity(VALID_YAML);

    process.env.FULMEN_APP_IDENTITY_PATH = join(
      tmpdir(),
      `appidentity-missing-env-${Date.now()}.yaml`,
    );

    await expect(loadIdentity()).rejects.toThrow(AppIdentityError);
  });

  test("explicit path missing file does not fall back to embedded", async () => {
    await registerEmbeddedIdentity(VALID_YAML);

    const missingPath = join(tmpdir(), `appidentity-missing-explicit-${Date.now()}.yaml`);

    await expect(loadIdentity({ path: missingPath })).rejects.toThrow(AppIdentityError);
  });

  test("test injection takes precedence over embedded", async () => {
    await registerEmbeddedIdentity(VALID_YAML);

    const injectedIdentity = {
      app: {
        binary_name: "injected",
        vendor: "injectedvendor",
        env_prefix: "INJECTED_",
        config_name: "injected",
        description: "Injected identity for testing",
      },
    };

    const identity = await loadIdentity({ identity: injectedIdentity });

    expect(identity.app.binary_name).toBe("injected");
  });
});

describe("standalone execution behavior", () => {
  test("loadIdentity succeeds outside repo when embedded registered", async () => {
    clearEmbeddedIdentity();
    clearIdentityCache();
    delete process.env.FULMEN_APP_IDENTITY_PATH;

    await registerEmbeddedIdentity(VALID_YAML);

    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(join(tmpdir(), "appidentity-standalone-"));

    try {
      process.chdir(tempDir);

      const identity = await loadIdentity();
      expect(identity.app.binary_name).toBe("testapp");
    } finally {
      process.chdir(originalCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
