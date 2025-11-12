/**
 * Signal Guard Tests
 *
 * Tests for guard functions that validate signal support and throw actionable errors.
 */

import { describe, expect, test } from "vitest";
import { FoundryCatalogError } from "../../errors.js";
import { isPOSIX, isWindows } from "../capabilities.js";
import {
  ensurePOSIX,
  ensureSignalExitCodesSupported,
  ensureSupported,
  ensureWindows,
} from "../guards.js";

describe("Signal Guards", () => {
  describe("ensureSupported", () => {
    test("passes for supported signals", async () => {
      // SIGTERM is supported on all platforms
      await expect(ensureSupported("SIGTERM")).resolves.toBeUndefined();
      await expect(ensureSupported("SIGINT")).resolves.toBeUndefined();
    });

    test("throws for unknown signals", async () => {
      await expect(ensureSupported("SIGNONEXISTENT")).rejects.toThrow(FoundryCatalogError);
      await expect(ensureSupported("SIGNONEXISTENT")).rejects.toThrow(/not found in catalog/);
    });

    test("error message lists valid signals", async () => {
      try {
        await ensureSupported("SIGFAKE");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(FoundryCatalogError);
        const message = (error as Error).message;
        expect(message).toContain("Valid signals");
        expect(message).toContain("SIGTERM");
        expect(message).toContain("SIGINT");
      }
    });

    test("behavior depends on platform for SIGHUP", async () => {
      if (isPOSIX()) {
        // SIGHUP supported on POSIX
        await expect(ensureSupported("SIGHUP")).resolves.toBeUndefined();
      } else if (isWindows()) {
        // SIGHUP not supported on Windows
        await expect(ensureSupported("SIGHUP")).rejects.toThrow(FoundryCatalogError);
      }
    });

    test("Windows error includes HTTP fallback guidance", async () => {
      // This test only validates behavior on Windows
      // On POSIX, it will pass (no error thrown)
      if (isWindows()) {
        try {
          await ensureSupported("SIGHUP");
          expect.fail("Should have thrown on Windows");
        } catch (error) {
          expect(error).toBeInstanceOf(FoundryCatalogError);
          const message = (error as Error).message;
          expect(message).toContain("HTTP endpoint");
          expect(message).toContain("POST /admin/signal");
        }
      }
    });

    test("can disable guidance in error message", async () => {
      if (isWindows()) {
        try {
          await ensureSupported("SIGHUP", { includeGuidance: false });
          expect.fail("Should have thrown on Windows");
        } catch (error) {
          expect(error).toBeInstanceOf(FoundryCatalogError);
          const message = (error as Error).message;
          // Should not contain detailed guidance
          expect(message).not.toContain("POST /admin/signal");
        }
      }
    });

    test("accepts signal by ID or name", async () => {
      await expect(ensureSupported("SIGTERM")).resolves.toBeUndefined();
      await expect(ensureSupported("term")).resolves.toBeUndefined();
    });
  });

  describe("ensureSignalExitCodesSupported", () => {
    test("passes on POSIX platforms", () => {
      if (isPOSIX()) {
        expect(() => ensureSignalExitCodesSupported()).not.toThrow();
      }
    });

    test("throws on Windows", () => {
      if (isWindows()) {
        expect(() => ensureSignalExitCodesSupported()).toThrow(FoundryCatalogError);
        expect(() => ensureSignalExitCodesSupported()).toThrow(/128\+N pattern/);
      }
    });

    test("error message explains Windows limitation", () => {
      if (isWindows()) {
        try {
          ensureSignalExitCodesSupported();
          expect.fail("Should have thrown on Windows");
        } catch (error) {
          expect(error).toBeInstanceOf(FoundryCatalogError);
          const message = (error as Error).message;
          expect(message).toContain("Windows does not propagate signal numbers");
          expect(message).toContain("explicit exit codes");
        }
      }
    });
  });

  describe("ensurePOSIX", () => {
    test("passes on POSIX platforms", () => {
      if (isPOSIX()) {
        expect(() => ensurePOSIX()).not.toThrow();
      }
    });

    test("throws on Windows", () => {
      if (isWindows()) {
        expect(() => ensurePOSIX()).toThrow(FoundryCatalogError);
        expect(() => ensurePOSIX()).toThrow(/POSIX-compliant platform/);
      }
    });

    test("error message lists valid platforms", () => {
      if (isWindows()) {
        try {
          ensurePOSIX();
          expect.fail("Should have thrown on Windows");
        } catch (error) {
          const message = (error as Error).message;
          expect(message).toContain("Linux");
          expect(message).toContain("macOS");
          expect(message).toContain("FreeBSD");
        }
      }
    });
  });

  describe("ensureWindows", () => {
    test("passes on Windows", () => {
      if (isWindows()) {
        expect(() => ensureWindows()).not.toThrow();
      }
    });

    test("throws on POSIX platforms", () => {
      if (isPOSIX()) {
        expect(() => ensureWindows()).toThrow(FoundryCatalogError);
        expect(() => ensureWindows()).toThrow(/Windows platform/);
      }
    });
  });

  describe("Guard Error Types", () => {
    test("all guards throw FoundryCatalogError", async () => {
      const errors: Error[] = [];

      try {
        await ensureSupported("SIGNONEXISTENT");
      } catch (e) {
        errors.push(e as Error);
      }

      if (isWindows()) {
        try {
          ensureSignalExitCodesSupported();
        } catch (e) {
          errors.push(e as Error);
        }
        try {
          ensurePOSIX();
        } catch (e) {
          errors.push(e as Error);
        }
      }

      if (isPOSIX()) {
        try {
          ensureWindows();
        } catch (e) {
          errors.push(e as Error);
        }
      }

      for (const error of errors) {
        expect(error).toBeInstanceOf(FoundryCatalogError);
      }
    });
  });
});
