/**
 * Config Reload Helper Tests
 *
 * Tests for restart-based config reload with schema validation.
 */

import { describe, expect, test, vi } from 'vitest';
import { ConfigReloadTracker, createConfigReloadHandler } from '../reload.js';

describe('Config Reload Helper', () => {
  describe('createConfigReloadHandler', () => {
    test('validates and exits on valid config', async () => {
      const config = { setting: 'value' };
      const loader = vi.fn().mockResolvedValue(config);
      const validator = vi.fn().mockResolvedValue({ valid: true });
      const onValidated = vi.fn();

      const handler = createConfigReloadHandler({
        loader,
        validator,
        onValidated,
        testMode: true, // Prevents process.exit
      });

      await handler();

      expect(loader).toHaveBeenCalled();
      expect(validator).toHaveBeenCalledWith(config);
      expect(onValidated).toHaveBeenCalledWith(config);
    });

    test('rejects invalid config without exit', async () => {
      const config = { setting: 'invalid' };
      const loader = vi.fn().mockResolvedValue(config);
      const validator = vi.fn().mockResolvedValue({
        valid: false,
        errors: [{ path: 'setting', message: 'Invalid value' }],
      });
      const onValidated = vi.fn();

      const handler = createConfigReloadHandler({
        loader,
        validator,
        onValidated,
        testMode: true,
      });

      await handler();

      expect(loader).toHaveBeenCalled();
      expect(validator).toHaveBeenCalledWith(config);
      expect(onValidated).not.toHaveBeenCalled(); // No callback on invalid
    });

    test('continues on loader error', async () => {
      const loader = vi.fn().mockRejectedValue(new Error('Load failed'));
      const validator = vi.fn();
      const onValidated = vi.fn();

      const handler = createConfigReloadHandler({
        loader,
        validator,
        onValidated,
        testMode: true,
      });

      await handler(); // Should not throw

      expect(loader).toHaveBeenCalled();
      expect(validator).not.toHaveBeenCalled();
      expect(onValidated).not.toHaveBeenCalled();
    });

    test('continues on validator error', async () => {
      const config = { setting: 'value' };
      const loader = vi.fn().mockResolvedValue(config);
      const validator = vi.fn().mockRejectedValue(new Error('Validation failed'));
      const onValidated = vi.fn();

      const handler = createConfigReloadHandler({
        loader,
        validator,
        onValidated,
        testMode: true,
      });

      await handler(); // Should not throw

      expect(loader).toHaveBeenCalled();
      expect(validator).toHaveBeenCalled();
      expect(onValidated).not.toHaveBeenCalled();
    });

    test('logs reload events', async () => {
      const logCalls: Array<{ level: string; message: string }> = [];
      const logger = {
        info: (msg: string) => logCalls.push({ level: 'info', message: msg }),
        warn: (msg: string) => logCalls.push({ level: 'warn', message: msg }),
      };

      const handler = createConfigReloadHandler({
        loader: () => ({ setting: 'value' }),
        validator: () => ({ valid: true }),
        logger,
        testMode: true,
      });

      await handler();

      expect(logCalls).toContainEqual(
        expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('reload requested'),
        }),
      );
      expect(logCalls).toContainEqual(
        expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('validation succeeded'),
        }),
      );
    });

    test('emits telemetry events', async () => {
      const telemetryCalls: Array<{ event: string }> = [];
      const telemetry = {
        emit: (event: string) => telemetryCalls.push({ event }),
      };

      const handler = createConfigReloadHandler({
        loader: () => ({ setting: 'value' }),
        validator: () => ({ valid: true }),
        telemetry,
        testMode: true,
      });

      await handler();

      expect(telemetryCalls).toContainEqual(
        expect.objectContaining({
          event: 'fulmen.signal.config_reload_requested',
        }),
      );
      expect(telemetryCalls).toContainEqual(
        expect.objectContaining({
          event: 'fulmen.signal.config_reload_accepted',
        }),
      );
    });

    test('emits rejection telemetry on invalid config', async () => {
      const telemetryCalls: Array<{ event: string }> = [];
      const telemetry = {
        emit: (event: string) => telemetryCalls.push({ event }),
      };

      const handler = createConfigReloadHandler({
        loader: () => ({ setting: 'invalid' }),
        validator: () => ({ valid: false, errors: [] }),
        telemetry,
        testMode: true,
      });

      await handler();

      expect(telemetryCalls).toContainEqual(
        expect.objectContaining({
          event: 'fulmen.signal.config_reload_rejected',
        }),
      );
    });

    test('uses custom exit code', async () => {
      // Can't test actual process.exit without testMode, but verify option accepted
      const handler = createConfigReloadHandler({
        loader: () => ({ setting: 'value' }),
        validator: () => ({ valid: true }),
        exitCode: 42,
        testMode: true,
      });

      await handler(); // Should not throw with custom exit code
    });
  });

  describe('ConfigReloadTracker', () => {
    test('tracks consecutive failures', () => {
      const tracker = new ConfigReloadTracker({ maxFailures: 3 });

      expect(tracker.getFailureCount()).toBe(0);

      tracker.recordFailure();
      expect(tracker.getFailureCount()).toBe(1);

      tracker.recordFailure();
      expect(tracker.getFailureCount()).toBe(2);
    });

    test('returns true when threshold exceeded', () => {
      const tracker = new ConfigReloadTracker({ maxFailures: 3 });

      expect(tracker.recordFailure()).toBe(false); // 1
      expect(tracker.recordFailure()).toBe(false); // 2
      expect(tracker.recordFailure()).toBe(true); // 3 (threshold)
    });

    test('resets counter on success', () => {
      const tracker = new ConfigReloadTracker({ maxFailures: 3 });

      tracker.recordFailure();
      tracker.recordFailure();
      expect(tracker.getFailureCount()).toBe(2);

      tracker.recordSuccess();
      expect(tracker.getFailureCount()).toBe(0);
      expect(tracker.getLastFailureTime()).toBeNull();
    });

    test('tracks failure timestamp', () => {
      const tracker = new ConfigReloadTracker({ maxFailures: 3 });

      expect(tracker.getLastFailureTime()).toBeNull();

      tracker.recordFailure();
      const timestamp = tracker.getLastFailureTime();
      expect(timestamp).not.toBeNull();
      expect(timestamp).toBeGreaterThan(Date.now() - 1000); // Within last second
    });

    test('logs warning when threshold exceeded', () => {
      const logCalls: Array<{ level: string; message: string }> = [];
      const logger = {
        info: (msg: string) => logCalls.push({ level: 'info', message: msg }),
        warn: (msg: string) => logCalls.push({ level: 'warn', message: msg }),
      };

      const tracker = new ConfigReloadTracker({
        maxFailures: 2,
        logger,
      });

      tracker.recordFailure(); // 1
      tracker.recordFailure(); // 2 (threshold)

      expect(logCalls).toContainEqual(
        expect.objectContaining({
          level: 'warn',
          message: expect.stringContaining('consecutive config reload failures'),
        }),
      );
    });

    test('emits telemetry when threshold exceeded', () => {
      const telemetryCalls: Array<{ event: string }> = [];
      const telemetry = {
        emit: (event: string) => telemetryCalls.push({ event }),
      };

      const tracker = new ConfigReloadTracker({
        maxFailures: 2,
        telemetry,
      });

      tracker.recordFailure(); // 1
      tracker.recordFailure(); // 2 (threshold)

      expect(telemetryCalls).toContainEqual(
        expect.objectContaining({
          event: 'fulmen.signal.config_reload_threshold_exceeded',
        }),
      );
    });

    test('uses custom max failures', () => {
      const tracker = new ConfigReloadTracker({ maxFailures: 5 });

      for (let i = 0; i < 4; i++) {
        expect(tracker.recordFailure()).toBe(false);
      }
      expect(tracker.recordFailure()).toBe(true); // 5th is threshold
    });
  });

  describe('Integration with SignalManager', () => {
    test('handler can be registered with manager', async () => {
      const { createSignalManager } = await import('../manager.js');
      const manager = createSignalManager({ testMode: true });

      const handler = createConfigReloadHandler({
        loader: () => ({ setting: 'value' }),
        validator: () => ({ valid: true }),
        testMode: true,
      });

      // Should not throw
      await manager.register('SIGHUP', handler);
      expect(manager.isRegistered('SIGHUP')).toBe(true);
    });
  });
});
