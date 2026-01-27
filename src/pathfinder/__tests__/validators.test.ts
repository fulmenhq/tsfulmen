/**
 * Tests for pathfinder validators
 */

import { describe, expect, it } from "vitest";
import { FulmenError } from "../../errors/index.js";
import { PathfinderErrorCode } from "../errors.js";
import { LoaderType, ChecksumAlgorithm, EnforcementLevel } from "../types.js";
import {
  assertValidConfig,
  assertValidPathResult,
  compileConfigSchema,
  compilePathResultSchema,
  validateConfig,
  validatePathResult,
} from "../validators.js";

describe("Pathfinder Validators", () => {
  describe("compileConfigSchema", () => {
    it("should return a compiled validator", async () => {
      const validator = await compileConfigSchema();
      expect(validator).toBeDefined();
      expect(typeof validator).toBe("function");
    });

    it("should be reusable for multiple validations", async () => {
      const validator = await compileConfigSchema();

      const validConfig = { maxWorkers: 4, loaderType: LoaderType.LOCAL };
      const invalidConfig = { maxWorkers: 0, loaderType: "invalid" };

      expect(validator(validConfig)).toBe(true);
      expect(validator(invalidConfig)).toBe(false);
    });
  });

  describe("compilePathResultSchema", () => {
    it("should return a compiled validator", async () => {
      const validator = await compilePathResultSchema();
      expect(validator).toBeDefined();
      expect(typeof validator).toBe("function");
    });

    it("should validate path results correctly", async () => {
      const validator = await compilePathResultSchema();

      const validResult = {
        relativePath: "src/index.ts",
        sourcePath: "/tmp/src/index.ts",
        loaderType: LoaderType.LOCAL,
        metadata: {},
      };

      expect(validator(validResult)).toBe(true);
    });
  });

  describe("assertValidConfig", () => {
    it("should not throw for valid config", async () => {
      const config = {
        maxWorkers: 4,
        loaderType: LoaderType.LOCAL,
        calculateChecksums: true,
        checksumAlgorithm: ChecksumAlgorithm.SHA256,
      };

      await expect(assertValidConfig(config)).resolves.toBeUndefined();
    });

    it("should throw FulmenError for invalid config", async () => {
      const invalidConfig = {
        maxWorkers: -1,
        loaderType: "not-a-valid-type",
      };

      await expect(assertValidConfig(invalidConfig)).rejects.toThrow(FulmenError);
    });

    it("should include validation diagnostics in error context", async () => {
      const invalidConfig = {
        maxWorkers: 0,
        loaderType: "invalid",
      };

      try {
        await assertValidConfig(invalidConfig);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(FulmenError);
        const fulmenError = error as FulmenError;
        expect(fulmenError.data.code).toBe(PathfinderErrorCode.VALIDATION_FAILED);
        expect(fulmenError.data.severity).toBe("high");
        expect(fulmenError.data.context?.diagnostics).toBeDefined();
      }
    });

    it("should handle empty config object", async () => {
      // Empty config should be valid (all fields optional)
      await expect(assertValidConfig({})).resolves.toBeUndefined();
    });

    it("should validate constraint configuration", async () => {
      const configWithConstraint = {
        constraint: {
          enforcementLevel: EnforcementLevel.STRICT,
          root: "/workspace",
        },
      };

      await expect(assertValidConfig(configWithConstraint)).resolves.toBeUndefined();
    });
  });

  describe("assertValidPathResult", () => {
    it("should not throw for valid path result", async () => {
      const result = {
        relativePath: "src/components/Button.tsx",
        sourcePath: "/workspace/project/src/components/Button.tsx",
        loaderType: LoaderType.LOCAL,
        metadata: {
          size: 1234,
          modified: "2025-01-15T12:00:00Z",
        },
      };

      await expect(assertValidPathResult(result)).resolves.toBeUndefined();
    });

    it("should throw FulmenError for missing required fields", async () => {
      const invalidResult = {
        path: "wrong-field",
      };

      await expect(assertValidPathResult(invalidResult)).rejects.toThrow(FulmenError);
    });

    it("should include error details in thrown error", async () => {
      const invalidResult = {
        relativePath: 123, // Should be string
        sourcePath: null,
        loaderType: "unknown",
      };

      try {
        await assertValidPathResult(invalidResult);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(FulmenError);
        const fulmenError = error as FulmenError;
        expect(fulmenError.data.code).toBe(PathfinderErrorCode.VALIDATION_FAILED);
        expect(fulmenError.data.message).toContain("Invalid path result");
      }
    });

    it("should validate path result with checksum metadata", async () => {
      const result = {
        relativePath: "file.txt",
        sourcePath: "/tmp/file.txt",
        loaderType: LoaderType.LOCAL,
        metadata: {
          size: 100,
          checksum: "xxh3-128:abc123def456",
          checksumAlgorithm: ChecksumAlgorithm.XXH3_128,
        },
      };

      await expect(assertValidPathResult(result)).resolves.toBeUndefined();
    });

    it("should validate path result with symlink metadata", async () => {
      const result = {
        relativePath: "link.txt",
        sourcePath: "/tmp/link.txt",
        loaderType: LoaderType.LOCAL,
        metadata: {
          size: 50,
          isSymlink: true,
          symlinkTarget: "/tmp/target.txt",
        },
      };

      await expect(assertValidPathResult(result)).resolves.toBeUndefined();
    });
  });

  describe("validateConfig", () => {
    it("should return valid=true for valid config", async () => {
      const result = await validateConfig({
        maxWorkers: 8,
        cacheEnabled: true,
      });

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should return valid=false with diagnostics for invalid config", async () => {
      const result = await validateConfig({
        maxWorkers: -5,
      });

      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe("validatePathResult", () => {
    it("should return valid=true for valid path result", async () => {
      const result = await validatePathResult({
        relativePath: "test.ts",
        sourcePath: "/abs/test.ts",
        loaderType: LoaderType.LOCAL,
        metadata: {},
      });

      expect(result.valid).toBe(true);
    });

    it("should return valid=false for invalid path result", async () => {
      const result = await validatePathResult({
        wrongField: "value",
      });

      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });
  });
});
