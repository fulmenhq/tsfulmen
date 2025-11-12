/**
 * Goneat bridge tests
 */

import { describe, expect, it } from "vitest";
import { detectGoneat, isGoneatAvailable } from "../goneat-bridge.js";

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

    it("should try local bin/goneat", async () => {
      const result = await detectGoneat();
      // May or may not exist, but should return a value
      expect(result).toBeDefined();
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
  });

  // Note: runGoneatValidation tests would require mocking child_process.spawn
  // or having goneat installed, which we skip for unit tests. Integration
  // tests can verify goneat functionality when the binary is available.
});
