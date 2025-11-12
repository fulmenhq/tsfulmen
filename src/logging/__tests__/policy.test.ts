/**
 * Tests for policy enforcement
 */

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PolicyEnforcer } from "../policy.js";
import { LoggingProfile, PolicyError } from "../types.js";

const FIXTURES_DIR = join(__dirname, "fixtures");

describe("PolicyEnforcer", () => {
  describe("constructor", () => {
    it("should load valid policy file", () => {
      const policyFile = join(FIXTURES_DIR, "basic-policy.yaml");
      const enforcer = new PolicyEnforcer(policyFile);
      expect(enforcer).toBeDefined();
    });

    it("should throw PolicyError for missing file", () => {
      const policyFile = join(FIXTURES_DIR, "nonexistent.yaml");
      expect(() => new PolicyEnforcer(policyFile)).toThrow(PolicyError);
      expect(() => new PolicyEnforcer(policyFile)).toThrow("not found");
    });

    it("should throw PolicyError for invalid policy", () => {
      const policyFile = join(FIXTURES_DIR, "invalid-policy.yaml");
      expect(() => new PolicyEnforcer(policyFile)).toThrow(PolicyError);
      expect(() => new PolicyEnforcer(policyFile)).toThrow("allowedProfiles");
    });

    it("should throw PolicyError for malformed requiredProfiles (not an array)", () => {
      const policyFile = join(FIXTURES_DIR, "malformed-required-profiles.yaml");
      expect(() => new PolicyEnforcer(policyFile)).toThrow(PolicyError);
      expect(() => new PolicyEnforcer(policyFile)).toThrow("must be an array");
      expect(() => new PolicyEnforcer(policyFile)).toThrow("Check YAML formatting");
    });

    it("should throw PolicyError for malformed environmentRules (not an array)", () => {
      const policyFile = join(FIXTURES_DIR, "malformed-environment-rules.yaml");
      expect(() => new PolicyEnforcer(policyFile)).toThrow(PolicyError);
      expect(() => new PolicyEnforcer(policyFile)).toThrow("must be an array");
      expect(() => new PolicyEnforcer(policyFile)).toThrow("Check YAML formatting");
    });

    it("should throw PolicyError for unknown profile in requiredProfiles", () => {
      const policyFile = join(FIXTURES_DIR, "invalid-profile-in-rules.yaml");
      expect(() => new PolicyEnforcer(policyFile)).toThrow(PolicyError);
      expect(() => new PolicyEnforcer(policyFile)).toThrow("unknown profile");
      expect(() => new PolicyEnforcer(policyFile)).toThrow("super-enterprise");
    });
  });

  describe("validateProfile - basic policy", () => {
    const policyFile = join(FIXTURES_DIR, "basic-policy.yaml");
    const enforcer = new PolicyEnforcer(policyFile);

    it("should allow SIMPLE profile", () => {
      expect(enforcer.validateProfile(LoggingProfile.SIMPLE)).toBe(true);
    });

    it("should allow STRUCTURED profile", () => {
      expect(enforcer.validateProfile(LoggingProfile.STRUCTURED)).toBe(true);
    });

    it("should allow ENTERPRISE profile", () => {
      expect(enforcer.validateProfile(LoggingProfile.ENTERPRISE)).toBe(true);
    });

    it("should allow CUSTOM profile", () => {
      expect(enforcer.validateProfile(LoggingProfile.CUSTOM)).toBe(true);
    });
  });

  describe("validateProfile - restrictive policy", () => {
    const policyFile = join(FIXTURES_DIR, "restrictive-policy.yaml");
    const enforcer = new PolicyEnforcer(policyFile);

    it("should reject SIMPLE profile (not in allowed list)", () => {
      expect(enforcer.validateProfile(LoggingProfile.SIMPLE)).toBe(false);
    });

    it("should allow STRUCTURED profile", () => {
      expect(enforcer.validateProfile(LoggingProfile.STRUCTURED)).toBe(true);
    });

    it("should allow ENTERPRISE profile", () => {
      expect(enforcer.validateProfile(LoggingProfile.ENTERPRISE)).toBe(true);
    });

    it("should reject CUSTOM profile (not in allowed list)", () => {
      expect(enforcer.validateProfile(LoggingProfile.CUSTOM)).toBe(false);
    });
  });

  describe("validateProfile - environment rules", () => {
    const policyFile = join(FIXTURES_DIR, "restrictive-policy.yaml");
    const enforcer = new PolicyEnforcer(policyFile);

    it("should reject STRUCTURED in production environment", () => {
      expect(
        enforcer.validateProfile(LoggingProfile.STRUCTURED, {
          environment: "production",
        }),
      ).toBe(false);
    });

    it("should allow ENTERPRISE in production environment", () => {
      expect(
        enforcer.validateProfile(LoggingProfile.ENTERPRISE, {
          environment: "production",
        }),
      ).toBe(true);
    });

    it("should allow STRUCTURED in staging environment", () => {
      expect(
        enforcer.validateProfile(LoggingProfile.STRUCTURED, {
          environment: "staging",
        }),
      ).toBe(true);
    });

    it("should allow ENTERPRISE in staging environment", () => {
      expect(
        enforcer.validateProfile(LoggingProfile.ENTERPRISE, {
          environment: "staging",
        }),
      ).toBe(true);
    });

    it("should reject SIMPLE in development (not in allowed profiles)", () => {
      expect(
        enforcer.validateProfile(LoggingProfile.SIMPLE, {
          environment: "development",
        }),
      ).toBe(false);
    });

    it("should allow STRUCTURED in development", () => {
      expect(
        enforcer.validateProfile(LoggingProfile.STRUCTURED, {
          environment: "development",
        }),
      ).toBe(true);
    });
  });

  describe("validateProfile - app type rules", () => {
    const policyFile = join(FIXTURES_DIR, "restrictive-policy.yaml");
    const enforcer = new PolicyEnforcer(policyFile);

    it("should reject STRUCTURED for api-server app type", () => {
      expect(
        enforcer.validateProfile(LoggingProfile.STRUCTURED, {
          appType: "api-server",
        }),
      ).toBe(false);
    });

    it("should allow ENTERPRISE for api-server app type", () => {
      expect(
        enforcer.validateProfile(LoggingProfile.ENTERPRISE, {
          appType: "api-server",
        }),
      ).toBe(true);
    });

    it("should reject SIMPLE for cli-tool (not in allowed profiles)", () => {
      expect(
        enforcer.validateProfile(LoggingProfile.SIMPLE, {
          appType: "cli-tool",
        }),
      ).toBe(false);
    });

    it("should allow STRUCTURED for cli-tool", () => {
      expect(
        enforcer.validateProfile(LoggingProfile.STRUCTURED, {
          appType: "cli-tool",
        }),
      ).toBe(true);
    });

    it("should allow ENTERPRISE for worker app type", () => {
      expect(
        enforcer.validateProfile(LoggingProfile.ENTERPRISE, {
          appType: "worker",
        }),
      ).toBe(true);
    });
  });

  describe("validateProfile - combined rules", () => {
    const policyFile = join(FIXTURES_DIR, "restrictive-policy.yaml");
    const enforcer = new PolicyEnforcer(policyFile);

    it("should allow ENTERPRISE for api-server in production", () => {
      expect(
        enforcer.validateProfile(LoggingProfile.ENTERPRISE, {
          appType: "api-server",
          environment: "production",
        }),
      ).toBe(true);
    });

    it("should reject STRUCTURED for api-server in production", () => {
      expect(
        enforcer.validateProfile(LoggingProfile.STRUCTURED, {
          appType: "api-server",
          environment: "production",
        }),
      ).toBe(false);
    });

    it("should allow STRUCTURED for cli-tool in staging", () => {
      expect(
        enforcer.validateProfile(LoggingProfile.STRUCTURED, {
          appType: "cli-tool",
          environment: "staging",
        }),
      ).toBe(true);
    });
  });

  describe("getRequiredProfile", () => {
    const policyFile = join(FIXTURES_DIR, "restrictive-policy.yaml");
    const enforcer = new PolicyEnforcer(policyFile);

    it("should return ENTERPRISE for api-server in production", () => {
      const profile = enforcer.getRequiredProfile("api-server", "production");
      expect(profile).toBe(LoggingProfile.ENTERPRISE);
    });

    it("should return ENTERPRISE for worker in production", () => {
      const profile = enforcer.getRequiredProfile("worker", "production");
      expect(profile).toBe(LoggingProfile.ENTERPRISE);
    });

    it("should return STRUCTURED for cli-tool in staging", () => {
      const profile = enforcer.getRequiredProfile("cli-tool", "staging");
      expect(profile).toBe(LoggingProfile.STRUCTURED);
    });

    it("should throw PolicyError for unknown app type", () => {
      expect(() => enforcer.getRequiredProfile("unknown-app", "production")).toThrow(PolicyError);
      expect(() => enforcer.getRequiredProfile("unknown-app", "production")).toThrow(
        "No required profile found",
      );
    });
  });

  describe("getValidationErrorMessage", () => {
    const policyFile = join(FIXTURES_DIR, "restrictive-policy.yaml");
    const enforcer = new PolicyEnforcer(policyFile);

    it("should return helpful error message with no options", () => {
      const message = enforcer.getValidationErrorMessage(LoggingProfile.SIMPLE);
      expect(message).toContain('Profile "simple" not allowed');
      expect(message).toContain("Allowed profiles: structured, enterprise");
    });

    it("should include environment in error message", () => {
      const message = enforcer.getValidationErrorMessage(LoggingProfile.STRUCTURED, {
        environment: "production",
      });
      expect(message).toContain("Environment: production");
      expect(message).toContain('Environment "production" allows: enterprise');
    });

    it("should include app type in error message", () => {
      const message = enforcer.getValidationErrorMessage(LoggingProfile.STRUCTURED, {
        appType: "api-server",
      });
      expect(message).toContain("App Type: api-server");
      expect(message).toContain('App type "api-server" requires: enterprise');
    });

    it("should include both environment and app type in error message", () => {
      const message = enforcer.getValidationErrorMessage(LoggingProfile.SIMPLE, {
        environment: "production",
        appType: "api-server",
      });
      expect(message).toContain("Environment: production");
      expect(message).toContain("App Type: api-server");
      expect(message).toContain('Environment "production" allows: enterprise');
      expect(message).toContain('App type "api-server" requires: enterprise');
    });
  });
});
