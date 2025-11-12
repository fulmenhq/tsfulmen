/**
 * Pattern catalog tests
 */

import { describe, expect, it } from "vitest";
import {
  clearPatternCache,
  describePattern,
  getPattern,
  getPatternRegex,
  listPatterns,
  matchPattern,
} from "../patterns.js";

describe("Pattern Catalog", () => {
  describe("getPattern", () => {
    it("should return pattern by ID", async () => {
      const pattern = await getPattern("slug");
      expect(pattern).toBeDefined();
      expect(pattern?.id).toBe("slug");
      expect(pattern?.kind).toBe("regex");
      expect(pattern?.name).toBe("Slug (kebab/underscore)");
    });

    it("should return null for unknown pattern", async () => {
      const pattern = await getPattern("unknown-pattern");
      expect(pattern).toBeNull();
    });

    it("should return frozen immutable object", async () => {
      const pattern = await getPattern("slug");
      expect(Object.isFrozen(pattern)).toBe(true);
    });

    it("should return defensive copy (not same reference)", async () => {
      const pattern1 = await getPattern("slug");
      const pattern2 = await getPattern("slug");
      expect(pattern1).not.toBe(pattern2);
      expect(pattern1).toEqual(pattern2);
    });

    it("should deep freeze nested objects (flags, examples)", async () => {
      const pattern = await getPattern("ansi-email");
      expect(Object.isFrozen(pattern)).toBe(true);
      expect(Object.isFrozen(pattern?.flags)).toBe(true);
      expect(Object.isFrozen(pattern?.flags?.typescript)).toBe(true);
      expect(Object.isFrozen(pattern?.examples)).toBe(true);

      expect(() => {
        if (pattern?.flags?.typescript) {
          (pattern.flags.typescript as { ignoreCase?: boolean }).ignoreCase = false;
        }
      }).toThrow();
    });

    it("should prevent mutation of nested arrays", async () => {
      const pattern = await getPattern("ansi-email");
      expect(pattern).toBeDefined();
      expect(Object.isFrozen(pattern?.examples)).toBe(true);

      expect(() => {
        if (pattern?.examples) {
          pattern.examples.push("should-not-work@example.com");
        }
      }).toThrow();
    });
  });

  describe("getPatternRegex", () => {
    it("should compile regex pattern", async () => {
      const regex = await getPatternRegex("slug");
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex?.test("fulmen-hq")).toBe(true);
      expect(regex?.test("data_pipeline")).toBe(true);
      expect(regex?.test("Invalid-Slug")).toBe(false);
    });

    it("should return null for unknown pattern", async () => {
      const regex = await getPatternRegex("unknown-pattern");
      expect(regex).toBeNull();
    });

    it("should cache compiled regex", async () => {
      const regex1 = await getPatternRegex("slug");
      const regex2 = await getPatternRegex("slug");
      expect(regex1).toBe(regex2);
    });

    it("should handle ignoreCase flag for TypeScript", async () => {
      const regex = await getPatternRegex("ansi-email");
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex?.test("USER@EXAMPLE.COM")).toBe(true);
      expect(regex?.test("user@example.com")).toBe(true);
    });

    it("should throw for non-regex patterns", async () => {
      await expect(getPatternRegex("glob-any-json")).rejects.toThrow("is not a regex pattern");
    });
  });

  describe("matchPattern", () => {
    it("should match regex pattern - slug", async () => {
      expect(await matchPattern("slug", "fulmen-hq")).toBe(true);
      expect(await matchPattern("slug", "data_pipeline")).toBe(true);
      expect(await matchPattern("slug", "INVALID")).toBe(false);
    });

    it("should match regex pattern - UUID v4", async () => {
      expect(await matchPattern("uuid-v4", "550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(await matchPattern("uuid-v4", "invalid-uuid")).toBe(false);
    });

    it("should match glob pattern", async () => {
      expect(await matchPattern("glob-any-json", "config.json")).toBe(true);
      expect(await matchPattern("glob-any-json", "data/settings.json")).toBe(true);
      expect(await matchPattern("glob-any-json", "file.yaml")).toBe(false);
    });

    it("should handle case-insensitive matching", async () => {
      expect(await matchPattern("ansi-email", "USER@EXAMPLE.COM")).toBe(true);
      expect(await matchPattern("ansi-email", "user@example.com")).toBe(true);
    });

    it("should throw for unknown pattern", async () => {
      await expect(matchPattern("unknown", "value")).rejects.toThrow("not found");
    });
  });

  describe("listPatterns", () => {
    it("should return all patterns", async () => {
      const patterns = await listPatterns();
      expect(patterns.length).toBeGreaterThan(20);
      expect(patterns.every((p) => p.id && p.name && p.kind)).toBe(true);
    });

    it("should return frozen immutable array", async () => {
      const patterns = await listPatterns();
      expect(patterns.every((p) => Object.isFrozen(p))).toBe(true);
    });

    it("should include regex and glob patterns", async () => {
      const patterns = await listPatterns();
      const hasRegex = patterns.some((p) => p.kind === "regex");
      const hasGlob = patterns.some((p) => p.kind === "glob");
      expect(hasRegex).toBe(true);
      expect(hasGlob).toBe(true);
    });
  });

  describe("describePattern", () => {
    it("should return pattern description", async () => {
      const description = await describePattern("slug");
      expect(description).toContain("Lowercase");
      expect(description).toContain("slug");
    });

    it("should return null for unknown pattern", async () => {
      const description = await describePattern("unknown-pattern");
      expect(description).toBeNull();
    });
  });

  describe("clearPatternCache", () => {
    it("should clear cache and reload patterns", async () => {
      const pattern1 = await getPattern("slug");
      clearPatternCache();
      const pattern2 = await getPattern("slug");

      expect(pattern1).toEqual(pattern2);
      expect(pattern1).not.toBe(pattern2);
    });
  });

  describe("Pattern Examples", () => {
    it("should match ansi-email examples", async () => {
      expect(await matchPattern("ansi-email", "user@example.com")).toBe(true);
    });

    it("should match identifier examples", async () => {
      expect(await matchPattern("identifier", "ConfigValue")).toBe(true);
      expect(await matchPattern("identifier", "config_value1")).toBe(true);
    });

    it("should match uri-scheme examples", async () => {
      expect(await matchPattern("uri-scheme", "https")).toBe(true);
      expect(await matchPattern("uri-scheme", "git+ssh")).toBe(true);
    });

    it("should match logger-name examples", async () => {
      expect(await matchPattern("logger-name", "fulmen.logger")).toBe(true);
      expect(await matchPattern("logger-name", "app.core.worker")).toBe(true);
    });

    it("should match env-prefix examples", async () => {
      expect(await matchPattern("env-prefix", "FULMEN_")).toBe(true);
      expect(await matchPattern("env-prefix", "CRUCIBLE_")).toBe(true);
    });
  });
});
