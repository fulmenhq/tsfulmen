/**
 * Lifecycle and refresh loop tests
 *
 * Tests for background refresh loop, lifecycle integration, and signal handling.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createSignalManager } from "../../../foundry/signals/index.js";
import { MetricsRegistry } from "../../registry.js";
import { PrometheusExporter } from "../exporter.js";
import { registerPrometheusShutdown } from "../lifecycle.js";

describe("PrometheusExporter - Refresh Loop", () => {
  let registry: MetricsRegistry;
  let exporter: PrometheusExporter;

  beforeEach(() => {
    registry = new MetricsRegistry();
    exporter = new PrometheusExporter({ registry });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("startRefresh", () => {
    test("starts background refresh loop with default interval", async () => {
      const refreshSpy = vi.spyOn(exporter, "refresh").mockResolvedValue();

      exporter.startRefresh();

      // Should not have called refresh yet
      expect(refreshSpy).not.toHaveBeenCalled();

      // Advance time by default interval (15000ms)
      await vi.advanceTimersByTimeAsync(15000);

      // Should have called refresh once
      expect(refreshSpy).toHaveBeenCalledTimes(1);

      // Advance again
      await vi.advanceTimersByTimeAsync(15000);
      expect(refreshSpy).toHaveBeenCalledTimes(2);

      exporter.stopRefresh();
    });

    test("starts background refresh loop with custom interval", async () => {
      const refreshSpy = vi.spyOn(exporter, "refresh").mockResolvedValue();

      exporter.startRefresh({ intervalMs: 5000 });

      await vi.advanceTimersByTimeAsync(5000);
      expect(refreshSpy).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5000);
      expect(refreshSpy).toHaveBeenCalledTimes(2);

      exporter.stopRefresh();
    });

    test("updates isRefreshing stat when started", () => {
      expect(exporter.getStats().isRefreshing).toBe(false);

      exporter.startRefresh();

      expect(exporter.getStats().isRefreshing).toBe(true);

      exporter.stopRefresh();
    });

    test("calls error callback when refresh fails", async () => {
      const errorCallback = vi.fn();
      const error = new Error("Refresh failed");

      vi.spyOn(exporter, "refresh").mockRejectedValue(error);

      exporter.startRefresh({
        intervalMs: 1000,
        onError: errorCallback,
      });

      await vi.advanceTimersByTimeAsync(1000);

      // Error callback should be called
      expect(errorCallback).toHaveBeenCalledWith(error);

      exporter.stopRefresh();
    });

    test("continues refresh loop after error", async () => {
      const refreshSpy = vi
        .spyOn(exporter, "refresh")
        .mockRejectedValueOnce(new Error("First error"))
        .mockResolvedValueOnce();

      exporter.startRefresh({ intervalMs: 1000 });

      // First refresh (fails)
      await vi.advanceTimersByTimeAsync(1000);
      expect(refreshSpy).toHaveBeenCalledTimes(1);

      // Second refresh (succeeds)
      await vi.advanceTimersByTimeAsync(1000);
      expect(refreshSpy).toHaveBeenCalledTimes(2);

      exporter.stopRefresh();
    });
  });

  describe("stopRefresh", () => {
    test("stops background refresh loop", async () => {
      const refreshSpy = vi.spyOn(exporter, "refresh").mockResolvedValue();

      exporter.startRefresh({ intervalMs: 1000 });

      await vi.advanceTimersByTimeAsync(1000);
      expect(refreshSpy).toHaveBeenCalledTimes(1);

      await exporter.stopRefresh();

      // Should not refresh after stop
      await vi.advanceTimersByTimeAsync(1000);
      expect(refreshSpy).toHaveBeenCalledTimes(2); // +1 from final refresh in stopRefresh
    });

    test("performs final refresh on stop", async () => {
      const refreshSpy = vi.spyOn(exporter, "refresh").mockResolvedValue();

      exporter.startRefresh({ intervalMs: 1000 });

      await exporter.stopRefresh();

      // Should have called refresh once for final sync
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });

    test("updates isRefreshing stat when stopped", async () => {
      vi.spyOn(exporter, "refresh").mockResolvedValue();
      exporter.startRefresh();
      expect(exporter.getStats().isRefreshing).toBe(true);

      await exporter.stopRefresh();
      expect(exporter.getStats().isRefreshing).toBe(false);
    });

    test("handles final refresh error gracefully", async () => {
      vi.spyOn(exporter, "refresh").mockRejectedValue(new Error("Final refresh failed"));

      exporter.startRefresh();

      // Should not throw
      await expect(exporter.stopRefresh()).resolves.not.toThrow();
    });

    test("handles stop when not started", async () => {
      // Should not throw
      await expect(exporter.stopRefresh()).resolves.not.toThrow();
    });
  });
});

describe("registerPrometheusShutdown", () => {
  let registry: MetricsRegistry;
  let exporter: PrometheusExporter;

  beforeEach(() => {
    registry = new MetricsRegistry();
    exporter = new PrometheusExporter({ registry });
  });

  test("registers shutdown handlers for SIGTERM and SIGINT", async () => {
    const signalManager = createSignalManager();
    const registerSpy = vi.spyOn(signalManager, "register");

    await registerPrometheusShutdown(exporter, signalManager);

    expect(registerSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(registerSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
  });

  test("calls stopRefresh when shutdown signal received", async () => {
    const signalManager = createSignalManager();
    const stopRefreshSpy = vi.spyOn(exporter, "stopRefresh").mockResolvedValue();

    await registerPrometheusShutdown(exporter, signalManager);

    // Trigger SIGTERM
    await signalManager.trigger("SIGTERM");

    expect(stopRefreshSpy).toHaveBeenCalled();
  });

  test("performs final refresh on shutdown", async () => {
    const signalManager = createSignalManager();
    const refreshSpy = vi.spyOn(exporter, "refresh").mockResolvedValue();

    exporter.startRefresh();

    await registerPrometheusShutdown(exporter, signalManager);

    // Trigger SIGINT
    await signalManager.trigger("SIGINT");

    // Should have called refresh for final sync
    expect(refreshSpy).toHaveBeenCalled();
  });
});
