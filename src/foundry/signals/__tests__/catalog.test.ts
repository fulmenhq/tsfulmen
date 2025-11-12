/**
 * Signal Catalog Unit Tests
 *
 * Tests for catalog loading, caching, and accessor functions
 */

import { describe, expect, test } from "vitest";
import {
  getBehavior,
  getSignal,
  getSignalCatalog,
  getSignalsVersion,
  listBehaviors,
  listSignals,
} from "../catalog.js";

describe("Signal Catalog Loader", () => {
  describe("getSignalsVersion", () => {
    test("returns valid semver version", async () => {
      const version = await getSignalsVersion();
      expect(version).toMatch(/^v?\d+\.\d+\.\d+$/);
    });

    test("version is v1.0.0", async () => {
      const version = await getSignalsVersion();
      expect(version).toBe("v1.0.0");
    });
  });

  describe("listSignals", () => {
    test("returns non-empty array", async () => {
      const signals = await listSignals();
      expect(Array.isArray(signals)).toBe(true);
      expect(signals.length).toBeGreaterThan(0);
    });

    test("contains expected signals", async () => {
      const signals = await listSignals();
      const names = signals.map((s) => s.name);

      expect(names).toContain("SIGTERM");
      expect(names).toContain("SIGINT");
      expect(names).toContain("SIGHUP");
    });

    test("all signals have required properties", async () => {
      const signals = await listSignals();

      for (const signal of signals) {
        expect(signal).toHaveProperty("id");
        expect(signal).toHaveProperty("name");
        expect(signal).toHaveProperty("unix_number");
        expect(signal).toHaveProperty("description");
        expect(signal).toHaveProperty("default_behavior");
        expect(signal).toHaveProperty("exit_code");
      }
    });

    test("returns immutable copies", async () => {
      const signals1 = await listSignals();
      const signals2 = await listSignals();

      // Should be different array instances but equivalent content
      expect(signals1).not.toBe(signals2);
      expect(signals1).toEqual(signals2);
    });
  });

  describe("getSignal", () => {
    test("retrieves signal by name", async () => {
      const signal = await getSignal("SIGTERM");
      expect(signal).not.toBeNull();
      expect(signal?.name).toBe("SIGTERM");
      expect(signal?.id).toBe("term");
    });

    test("retrieves signal by id", async () => {
      const signal = await getSignal("term");
      expect(signal).not.toBeNull();
      expect(signal?.name).toBe("SIGTERM");
      expect(signal?.id).toBe("term");
    });

    test("returns null for unknown signal", async () => {
      const signal = await getSignal("SIGNONEXISTENT");
      expect(signal).toBeNull();
    });

    test("case-sensitive matching", async () => {
      const signal = await getSignal("sigterm");
      expect(signal).toBeNull();
    });
  });

  describe("listBehaviors", () => {
    test("returns non-empty array", async () => {
      const behaviors = await listBehaviors();
      expect(Array.isArray(behaviors)).toBe(true);
      expect(behaviors.length).toBeGreaterThan(0);
    });

    test("contains expected behaviors", async () => {
      const behaviors = await listBehaviors();
      const ids = behaviors.map((b) => b.id);

      expect(ids).toContain("graceful_shutdown");
      expect(ids).toContain("graceful_shutdown_with_double_tap");
      expect(ids).toContain("reload_via_restart");
      expect(ids).toContain("immediate_exit");
    });

    test("all behaviors have phases", async () => {
      const behaviors = await listBehaviors();

      for (const behavior of behaviors) {
        expect(behavior).toHaveProperty("id");
        expect(behavior).toHaveProperty("name");
        expect(behavior).toHaveProperty("description");
        expect(behavior).toHaveProperty("phases");
        expect(Array.isArray(behavior.phases)).toBe(true);
        expect(behavior.phases.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getBehavior", () => {
    test("retrieves behavior by id", async () => {
      const behavior = await getBehavior("graceful_shutdown");
      expect(behavior).not.toBeNull();
      expect(behavior?.id).toBe("graceful_shutdown");
      expect(behavior?.name).toBe("Graceful Shutdown");
    });

    test("returns null for unknown behavior", async () => {
      const behavior = await getBehavior("nonexistent_behavior");
      expect(behavior).toBeNull();
    });
  });

  describe("getSignalCatalog", () => {
    test("returns complete catalog structure", async () => {
      const catalog = await getSignalCatalog();

      expect(catalog).toHaveProperty("version");
      expect(catalog).toHaveProperty("description");
      expect(catalog).toHaveProperty("signals");
      expect(catalog).toHaveProperty("behaviors");
      expect(catalog).toHaveProperty("os_mappings");
      expect(catalog).toHaveProperty("platform_support");
      expect(catalog).toHaveProperty("exit_codes");
    });

    test("os_mappings has required sections", async () => {
      const catalog = await getSignalCatalog();

      expect(catalog.os_mappings).toHaveProperty("unix");
      expect(catalog.os_mappings).toHaveProperty("windows");
      expect(catalog.os_mappings).toHaveProperty("signal_to_event");
    });

    test("exit_codes section is populated", async () => {
      const catalog = await getSignalCatalog();

      expect(catalog.exit_codes.SIGTERM).toBe(143);
      expect(catalog.exit_codes.SIGINT).toBe(130);
      expect(catalog.exit_codes.SIGHUP).toBe(129);
      expect(catalog.exit_codes).toHaveProperty("note");
    });
  });

  describe("Catalog Caching", () => {
    test("subsequent calls return cached catalog", async () => {
      const catalog1 = await getSignalCatalog();
      const catalog2 = await getSignalCatalog();

      // Same reference - proves caching
      expect(catalog1).toBe(catalog2);
    });

    test("accessor functions use cached catalog", async () => {
      // First call loads catalog
      const signals1 = await listSignals();

      // Second call should use cache (faster)
      const signals2 = await listSignals();

      // Content should be equivalent
      expect(signals1).toEqual(signals2);
    });
  });

  describe("Signal Metadata", () => {
    test("SIGTERM metadata is complete", async () => {
      const sigterm = await getSignal("SIGTERM");

      expect(sigterm?.unix_number).toBe(15);
      expect(sigterm?.exit_code).toBe(143); // 128 + 15
      expect(sigterm?.default_behavior).toBe("graceful_shutdown");
      expect(sigterm?.windows_event).toBe("CTRL_CLOSE_EVENT");
      expect(sigterm?.cleanup_actions).toContain("close_connections");
    });

    test("SIGINT double-tap metadata is complete", async () => {
      const sigint = await getSignal("SIGINT");

      expect(sigint?.unix_number).toBe(2);
      expect(sigint?.exit_code).toBe(130); // 128 + 2
      expect(sigint?.default_behavior).toBe("graceful_shutdown_with_double_tap");
      expect(sigint?.double_tap_window_seconds).toBe(2);
      expect(sigint?.double_tap_exit_code).toBe(130);
    });

    test("SIGHUP reload metadata is complete", async () => {
      const sighup = await getSignal("SIGHUP");

      expect(sighup?.unix_number).toBe(1);
      expect(sighup?.exit_code).toBe(129); // 128 + 1
      expect(sighup?.default_behavior).toBe("reload_via_restart");
      expect(sighup?.reload_strategy).toBe("restart_based");
      expect(sighup?.validation_required).toBe(true);
      expect(sighup?.windows_event).toBeNull(); // No Windows support
      expect(sighup?.windows_fallback).toBeDefined();
    });
  });
});
