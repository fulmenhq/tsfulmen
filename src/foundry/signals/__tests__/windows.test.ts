/**
 * Windows Fallback Tests
 *
 * Tests Windows signal fallback behavior including logging, telemetry, and operational hints.
 * Platform-agnostic tests using catalog metadata.
 */

import { describe, expect, test } from "vitest";
import {
  type FallbackLogger,
  getFallbackMetadata,
  getHttpFallbackGuidance,
  handleWindowsFallback,
  requiresFallback,
  type TelemetryEmitter,
} from "../windows.js";

describe("Windows Signal Fallback", () => {
  // Mock logger for testing
  const createMockLogger = (): FallbackLogger & {
    calls: Array<{
      level: string;
      message: string;
      meta?: Record<string, unknown>;
    }>;
  } => {
    const calls: Array<{
      level: string;
      message: string;
      meta?: Record<string, unknown>;
    }> = [];
    return {
      calls,
      info(message: string, meta?: Record<string, unknown>) {
        calls.push({ level: "info", message, meta });
      },
      warn(message: string, meta?: Record<string, unknown>) {
        calls.push({ level: "warn", message, meta });
      },
    };
  };

  // Mock telemetry emitter for testing
  const createMockTelemetry = (): TelemetryEmitter & {
    calls: Array<{ event: string; tags: Record<string, string> }>;
  } => {
    const calls: Array<{ event: string; tags: Record<string, string> }> = [];
    return {
      calls,
      emit(event: string, tags: Record<string, string>) {
        calls.push({ event, tags });
      },
    };
  };

  describe("getFallbackMetadata", () => {
    test("returns fallback metadata for unsupported signals", async () => {
      const sighupFallback = await getFallbackMetadata("SIGHUP");
      expect(sighupFallback).not.toBeNull();
      expect(sighupFallback?.fallback_behavior).toBe("http_admin_endpoint");
      expect(sighupFallback?.log_level).toBe("INFO");
      expect(sighupFallback?.telemetry_event).toBe("fulmen.signal.unsupported");
    });

    test("returns null for supported signals", async () => {
      const sigtermFallback = await getFallbackMetadata("SIGTERM");
      // SIGTERM has windows_event, so no fallback metadata
      expect(sigtermFallback).toBeNull();
    });

    test("returns null for unknown signals", async () => {
      const fallback = await getFallbackMetadata("SIGNONEXISTENT");
      expect(fallback).toBeNull();
    });

    test("fallback metadata contains required fields", async () => {
      const fallback = await getFallbackMetadata("SIGHUP");
      expect(fallback).toHaveProperty("fallback_behavior");
      expect(fallback).toHaveProperty("log_level");
      expect(fallback).toHaveProperty("log_message");
      expect(fallback).toHaveProperty("log_template");
      expect(fallback).toHaveProperty("operation_hint");
      expect(fallback).toHaveProperty("telemetry_event");
      expect(fallback).toHaveProperty("telemetry_tags");
    });

    test("telemetry tags include required fields", async () => {
      const fallback = await getFallbackMetadata("SIGHUP");
      expect(fallback?.telemetry_tags).toHaveProperty("signal");
      expect(fallback?.telemetry_tags).toHaveProperty("platform");
      expect(fallback?.telemetry_tags).toHaveProperty("fallback_behavior");
    });
  });

  describe("requiresFallback", () => {
    test("returns true for signals without Windows support", async () => {
      const sighupRequires = await requiresFallback("SIGHUP");
      expect(sighupRequires).toBe(true);

      const sigpipeRequires = await requiresFallback("SIGPIPE");
      expect(sigpipeRequires).toBe(true);
    });

    test("returns false for signals with Windows support", async () => {
      const sigtermRequires = await requiresFallback("SIGTERM");
      expect(sigtermRequires).toBe(false);

      const sigintRequires = await requiresFallback("SIGINT");
      expect(sigintRequires).toBe(false);
    });

    test("returns false for unknown signals", async () => {
      const requires = await requiresFallback("SIGNONEXISTENT");
      expect(requires).toBe(false);
    });
  });

  describe("getHttpFallbackGuidance", () => {
    test("returns guidance for HTTP fallback signals", async () => {
      const guidance = await getHttpFallbackGuidance("SIGHUP");
      expect(guidance).not.toBeNull();
      expect(guidance).toContain("POST /admin/signal");
      expect(guidance).toContain("HUP");
    });

    test("returns null for non-HTTP fallback signals", async () => {
      const guidance = await getHttpFallbackGuidance("SIGPIPE");
      expect(guidance).toBeNull(); // Uses exception_handling, not HTTP
    });

    test("returns null for supported signals", async () => {
      const guidance = await getHttpFallbackGuidance("SIGTERM");
      expect(guidance).toBeNull();
    });
  });

  describe("handleWindowsFallback", () => {
    test("returns supported: true for signals with windows_event", async () => {
      const result = await handleWindowsFallback("SIGTERM", { silent: true });
      expect(result.supported).toBe(true);
      expect(result.logged).toBe(false);
    });

    test("returns supported: false for signals without windows_event", async () => {
      const result = await handleWindowsFallback("SIGHUP", { silent: true });
      expect(result.supported).toBe(false);
      expect(result.fallback).toBeDefined();
    });

    test("returns fallback metadata for unsupported signals", async () => {
      const result = await handleWindowsFallback("SIGHUP", { silent: true });
      expect(result.fallback).toBeDefined();
      expect(result.fallback?.fallback_behavior).toBe("http_admin_endpoint");
    });

    test("logs at INFO level with structured metadata", async () => {
      const logger = createMockLogger();
      await handleWindowsFallback("SIGHUP", { logger });

      expect(logger.calls.length).toBe(1);
      expect(logger.calls[0].level).toBe("info");
      expect(logger.calls[0].meta).toBeDefined();
      expect(logger.calls[0].meta?.signal).toBe("SIGHUP");
      expect(logger.calls[0].meta?.platform).toBe("windows");
      expect(logger.calls[0].meta?.fallback).toBe("http_admin_endpoint");
    });

    test("emits standardized telemetry event", async () => {
      const telemetry = createMockTelemetry();
      await handleWindowsFallback("SIGHUP", { telemetry });

      expect(telemetry.calls.length).toBe(1);
      expect(telemetry.calls[0].event).toBe("fulmen.signal.unsupported");
      expect(telemetry.calls[0].tags.signal).toBe("SIGHUP");
      expect(telemetry.calls[0].tags.platform).toBe("windows");
      expect(telemetry.calls[0].tags.fallback_behavior).toBe("http_admin_endpoint");
    });

    test("silent mode skips logging and telemetry", async () => {
      const logger = createMockLogger();
      const telemetry = createMockTelemetry();

      const result = await handleWindowsFallback("SIGHUP", {
        logger,
        telemetry,
        silent: true,
      });

      expect(result.logged).toBe(false);
      expect(logger.calls.length).toBe(0);
      expect(telemetry.calls.length).toBe(0);
    });

    test("uses default console logger when none provided", async () => {
      // This test verifies the function doesn't throw when using default logger
      // (actual console output is not captured)
      const result = await handleWindowsFallback("SIGHUP", { silent: true });
      expect(result.logged).toBe(false);
    });
  });

  describe("Fallback Behavior Types", () => {
    test("SIGHUP uses http_admin_endpoint fallback", async () => {
      const fallback = await getFallbackMetadata("SIGHUP");
      expect(fallback?.fallback_behavior).toBe("http_admin_endpoint");
    });

    test("SIGPIPE uses exception_handling fallback", async () => {
      const fallback = await getFallbackMetadata("SIGPIPE");
      expect(fallback?.fallback_behavior).toBe("exception_handling");
    });

    test("SIGALRM uses timer_api fallback", async () => {
      const fallback = await getFallbackMetadata("SIGALRM");
      expect(fallback?.fallback_behavior).toBe("timer_api");
    });

    test("SIGUSR1 uses http_admin_endpoint fallback", async () => {
      const fallback = await getFallbackMetadata("SIGUSR1");
      expect(fallback?.fallback_behavior).toBe("http_admin_endpoint");
    });

    test("SIGUSR2 uses http_admin_endpoint fallback", async () => {
      const fallback = await getFallbackMetadata("SIGUSR2");
      expect(fallback?.fallback_behavior).toBe("http_admin_endpoint");
    });
  });

  describe("Cross-Language Parity", () => {
    test("all unsupported signals have fallback metadata", async () => {
      const unsupportedSignals = ["SIGHUP", "SIGPIPE", "SIGALRM", "SIGUSR1", "SIGUSR2"];

      for (const signal of unsupportedSignals) {
        const fallback = await getFallbackMetadata(signal);
        expect(fallback, `${signal} should have fallback metadata`).not.toBeNull();
        expect(fallback?.log_level).toBe("INFO");
        expect(fallback?.telemetry_event).toBe("fulmen.signal.unsupported");
      }
    });

    test("log templates follow Crucible standard format", async () => {
      const fallback = await getFallbackMetadata("SIGHUP");
      const template = fallback?.log_template;

      // Template should contain: signal=${signal} platform=${platform} fallback=${fallback_behavior}
      expect(template).toContain("signal=");
      expect(template).toContain("platform=");
      expect(template).toContain("fallback=");
    });

    test("operation hints provide actionable guidance", async () => {
      const sighupFallback = await getFallbackMetadata("SIGHUP");
      expect(sighupFallback?.operation_hint).toContain("POST");
      expect(sighupFallback?.operation_hint).toContain("/admin/signal");

      const sigpipeFallback = await getFallbackMetadata("SIGPIPE");
      expect(sigpipeFallback?.operation_hint).toContain("Error"); // Exception handling

      const sigalrmFallback = await getFallbackMetadata("SIGALRM");
      expect(sigalrmFallback?.operation_hint).toContain("Timer"); // Timer API
    });
  });
});
