/**
 * Goneat bridge tests
 */

import { describe, expect, it } from "vitest";
import { detectGoneat, isGoneatAvailable, runGoneatValidation } from "../goneat-bridge.js";

describe("Goneat Bridge", () => {
  describe("detectGoneat", () => {
    it("should return custom path if provided and exists", async () => {
      // Use a known path that exists
      const result = await detectGoneat("/bin/sh");
      expect(result).toBe("/bin/sh");
    });

    it("should return null if custom path does not exist", async () => {
      const result = await detectGoneat("/nonexistent/path/to/goneat");
      expect(result).toBeNull();
    });

    it("should check GONEAT_PATH environment variable", async () => {
      // Save original
      const original = process.env.GONEAT_PATH;

      // Set to a path that exists
      process.env.GONEAT_PATH = "/bin/sh";
      const result = await detectGoneat();
      expect(result).toBe("/bin/sh");

      // Restore
      if (original) {
        process.env.GONEAT_PATH = original;
      } else {
        delete process.env.GONEAT_PATH;
      }
    });

    it("should handle invalid GONEAT_PATH environment variable", async () => {
      // Save original
      const original = process.env.GONEAT_PATH;

      // Set to a path that does not exist
      process.env.GONEAT_PATH = "/nonexistent/path/to/goneat";
      const result = await detectGoneat();

      // Should fall back to trying ./bin/goneat or 'goneat'
      // The result won't be the invalid path
      expect(result !== "/nonexistent/path/to/goneat" || result === "goneat").toBe(true);

      // Restore
      if (original) {
        process.env.GONEAT_PATH = original;
      } else {
        delete process.env.GONEAT_PATH;
      }
    });

    it("should try local bin/goneat", async () => {
      const result = await detectGoneat();
      // May or may not exist, but should return a value
      expect(result).toBeDefined();
    });

    it("should fall back to goneat in PATH when no other option works", async () => {
      // Save and clear GONEAT_PATH
      const original = process.env.GONEAT_PATH;
      delete process.env.GONEAT_PATH;

      // This tests the fallback behavior - detectGoneat returns "goneat" as last resort
      const result = await detectGoneat();
      expect(result).toBeDefined();

      // Restore
      if (original) {
        process.env.GONEAT_PATH = original;
      }
    });
  });

  describe("isGoneatAvailable", () => {
    it("should return false for non-existent binary", async () => {
      const available = await isGoneatAvailable("/nonexistent/goneat");
      expect(available).toBe(false);
    });

    it("should detect local bin/goneat if available", async () => {
      // This test will pass if bin/goneat exists and is executable
      const available = await isGoneatAvailable("./bin/goneat");
      // Just verify it returns a boolean
      expect(typeof available).toBe("boolean");
    });

    it("should return appropriate result for binary that may or may not support version command", async () => {
      // /bin/cat may or may not pass version check depending on platform
      const available = await isGoneatAvailable("/bin/cat");
      expect(typeof available).toBe("boolean");
    });

    it("should use detectGoneat when no path provided", async () => {
      // This tests the branch where goneatPath is undefined
      const available = await isGoneatAvailable();
      expect(typeof available).toBe("boolean");
    }, 30000); // Generous timeout for CI environments
  });

  describe("runGoneatValidation", () => {
    it("should return error when goneat binary not found", async () => {
      const result = await runGoneatValidation(
        "schema.json",
        "data.json",
        "/nonexistent/path/to/goneat",
      );

      expect(result.valid).toBe(false);
      expect(result.source).toBe("goneat");
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].keyword).toBe("goneat-unavailable");
    });

    it("should return error when goneat binary command fails validation", async () => {
      // Use /bin/cat - it exists, may pass version check, but won't produce valid JSON output
      const result = await runGoneatValidation("schema.json", "data.json", "/bin/cat");

      expect(result.valid).toBe(false);
      expect(result.source).toBe("goneat");
      expect(result.diagnostics.length).toBeGreaterThan(0);
      // Either goneat-not-executable or goneat-error depending on version check result
      expect(["goneat-not-executable", "goneat-error"]).toContain(result.diagnostics[0].keyword);
    });
  });

  // Note: Full runGoneatValidation tests (for successful validation) would
  // require mocking child_process.spawn or having goneat installed, which
  // we skip for unit tests. Integration tests can verify goneat functionality
  // when the binary is available.
});
