/**
 * Type inference and immutability tests for app identity
 */

import { describe, expect, it } from "vitest";
import type {
  AppIdentity,
  Identity,
  IdentityMetadata,
  LoadIdentityOptions,
  RepositoryCategory,
} from "../types.js";

describe("AppIdentity types", () => {
  it("should enforce readonly properties", () => {
    const identity: AppIdentity = {
      binary_name: "testapp",
      vendor: "testvendor",
      env_prefix: "TESTAPP_",
      config_name: "testapp",
      description: "Test application for unit tests",
    };

    // TypeScript should prevent mutation at compile time
    // This test ensures the type structure is correct
    expect(identity.binary_name).toBe("testapp");
    expect(identity.vendor).toBe("testvendor");
    expect(identity.env_prefix).toBe("TESTAPP_");
    expect(identity.config_name).toBe("testapp");
    expect(identity.description).toBe("Test application for unit tests");
  });

  it("should support all repository categories", () => {
    const categories: RepositoryCategory[] = [
      "cli",
      "workhorse",
      "service",
      "library",
      "pipeline",
      "codex",
      "sdk",
    ];

    // Ensure all category literals are valid
    for (const category of categories) {
      const metadata: IdentityMetadata = { repository_category: category };
      expect(metadata.repository_category).toBe(category);
    }
  });

  it("should support optional metadata fields", () => {
    const metadata: IdentityMetadata = {
      project_url: "https://github.com/example/repo",
      support_email: "support@example.com",
      license: "MIT",
      repository_category: "library",
      telemetry_namespace: "custom-namespace",
      registry_id: "01234567-89ab-cdef-0123-456789abcdef",
    };

    expect(metadata.project_url).toBeDefined();
    expect(metadata.license).toBe("MIT");
    expect(metadata.repository_category).toBe("library");
  });

  it("should support metadata extensibility", () => {
    const metadata: IdentityMetadata = {
      customField: "custom value",
      nestedObject: { key: "value" },
    };

    expect(metadata.customField).toBe("custom value");
    expect(metadata.nestedObject).toEqual({ key: "value" });
  });

  it("should compose full identity document", () => {
    const identity: Identity = {
      app: {
        binary_name: "testapp",
        vendor: "testvendor",
        env_prefix: "TESTAPP_",
        config_name: "testapp",
        description: "Test application",
      },
      metadata: {
        license: "MIT",
        repository_category: "cli",
      },
    };

    expect(identity.app.binary_name).toBe("testapp");
    expect(identity.metadata?.license).toBe("MIT");
  });

  it("should support minimal identity without metadata", () => {
    const identity: Identity = {
      app: {
        binary_name: "minimal",
        vendor: "minvendor",
        env_prefix: "MIN_",
        config_name: "minimal",
        description: "Minimal application",
      },
    };

    expect(identity.metadata).toBeUndefined();
  });

  it("should support Python metadata", () => {
    const metadata: IdentityMetadata = {
      python: {
        distribution_name: "my-package",
        package_name: "mypackage",
        console_scripts: [
          { name: "mycli", entry_point: "mypackage.cli:main" },
          { name: "mytool", entry_point: "mypackage.tool:run" },
        ],
      },
    };

    expect(metadata.python?.distribution_name).toBe("my-package");
    expect(metadata.python?.console_scripts).toHaveLength(2);
  });
});

describe("LoadIdentityOptions", () => {
  it("should support all option combinations", () => {
    const options: LoadIdentityOptions = {
      path: "/explicit/path/app.yaml",
      startDir: "/start/dir",
      skipCache: true,
      skipValidation: false,
    };

    expect(options.path).toBe("/explicit/path/app.yaml");
    expect(options.skipCache).toBe(true);
  });

  it("should support test injection", () => {
    const fixture: Identity = {
      app: {
        binary_name: "testapp",
        vendor: "testvendor",
        env_prefix: "TEST_",
        config_name: "testapp",
        description: "Test fixture",
      },
    };

    const options: LoadIdentityOptions = {
      identity: fixture,
    };

    expect(options.identity).toBeDefined();
    expect(options.identity?.app.binary_name).toBe("testapp");
  });

  it("should support empty options", () => {
    const options: LoadIdentityOptions = {};
    expect(options).toBeDefined();
  });
});
