/**
 * Signal Capability Tests
 *
 * Tests platform detection and signal support checking.
 * Uses catalog metadata to determine support (no hardcoded signal names).
 */

import { describe, expect, test } from 'vitest';
import {
  getPlatform,
  getPlatformCapabilities,
  getSignalNumber,
  getWindowsEvent,
  isPOSIX,
  isWindows,
  supportsSignal,
  supportsSignalExitCodes,
} from '../capabilities.js';

describe('Signal Capabilities', () => {
  describe('Platform Detection', () => {
    test('getPlatform returns current platform', () => {
      const platform = getPlatform();
      expect(['linux', 'darwin', 'win32', 'freebsd', 'unknown']).toContain(platform);
    });

    test('isPOSIX returns true on Unix-like systems', () => {
      const platform = getPlatform();
      const posixPlatforms = ['linux', 'darwin', 'freebsd'];
      expect(isPOSIX()).toBe(posixPlatforms.includes(platform));
    });

    test('isWindows returns true only on win32', () => {
      const platform = getPlatform();
      expect(isWindows()).toBe(platform === 'win32');
    });

    test('exactly one of isPOSIX() or isWindows() is true', () => {
      const posix = isPOSIX();
      const windows = isWindows();
      const platform = getPlatform();

      // XOR logic: either POSIX or Windows (not both, unless unknown platform)
      if (platform === 'unknown') {
        expect(posix).toBe(false);
        expect(windows).toBe(false);
      } else {
        expect(posix || windows).toBe(true);
        expect(posix && windows).toBe(false);
      }
    });
  });

  describe('supportsSignal - Catalog-Driven', () => {
    test('SIGTERM is supported (has windows_event on all platforms)', async () => {
      // SIGTERM maps to CTRL_CLOSE_EVENT on Windows
      const supported = await supportsSignal('SIGTERM');
      expect(supported).toBe(true);
    });

    test('SIGINT is supported (has windows_event on all platforms)', async () => {
      // SIGINT maps to CTRL_C_EVENT on Windows
      const supported = await supportsSignal('SIGINT');
      expect(supported).toBe(true);
    });

    test('SIGHUP support depends on platform (no windows_event)', async () => {
      const supported = await supportsSignal('SIGHUP');

      if (isPOSIX()) {
        expect(supported).toBe(true);
      } else {
        // Windows: SIGHUP has windows_event = null
        expect(supported).toBe(false);
      }
    });

    test('SIGPIPE support depends on platform (no windows_event)', async () => {
      const supported = await supportsSignal('SIGPIPE');

      if (isPOSIX()) {
        expect(supported).toBe(true);
      } else {
        // Windows: SIGPIPE has windows_event = null
        expect(supported).toBe(false);
      }
    });

    test('SIGUSR1 support depends on platform (no windows_event)', async () => {
      const supported = await supportsSignal('SIGUSR1');

      if (isPOSIX()) {
        expect(supported).toBe(true);
      } else {
        // Windows: SIGUSR1 has windows_event = null
        expect(supported).toBe(false);
      }
    });

    test('can query by signal ID instead of name', async () => {
      const supportedByName = await supportsSignal('SIGTERM');
      const supportedById = await supportsSignal('term');
      expect(supportedByName).toBe(supportedById);
    });

    test('returns false for unknown signal', async () => {
      const supported = await supportsSignal('SIGNONEXISTENT');
      expect(supported).toBe(false);
    });
  });

  describe('supportsSignalExitCodes', () => {
    test('returns true only on POSIX platforms', () => {
      const result = supportsSignalExitCodes();
      expect(result).toBe(isPOSIX());
    });

    test('matches isPOSIX result', () => {
      expect(supportsSignalExitCodes()).toBe(isPOSIX());
    });
  });

  describe('getPlatformCapabilities', () => {
    test('returns complete capability summary', async () => {
      const caps = await getPlatformCapabilities();

      expect(caps).toHaveProperty('platform');
      expect(caps).toHaveProperty('isPOSIX');
      expect(caps).toHaveProperty('isWindows');
      expect(caps).toHaveProperty('supportsNativeSignals');
      expect(caps).toHaveProperty('supportsSignalExitCodes');
      expect(caps).toHaveProperty('supportedSignals');
      expect(caps).toHaveProperty('unsupportedSignals');
      expect(caps).toHaveProperty('mappedSignals');
    });

    test('platform field matches getPlatform()', async () => {
      const caps = await getPlatformCapabilities();
      expect(caps.platform).toBe(getPlatform());
    });

    test('POSIX platforms support all signals', async () => {
      const caps = await getPlatformCapabilities();

      if (caps.isPOSIX) {
        expect(caps.supportedSignals.length).toBe(8); // All 8 signals
        expect(caps.unsupportedSignals.length).toBe(0);
        expect(caps.mappedSignals.length).toBe(0);
        expect(caps.supportsNativeSignals).toBe(true);
      }
    });

    test('Windows has mapped and unsupported signals', async () => {
      const caps = await getPlatformCapabilities();

      if (caps.isWindows) {
        // Windows should have some mapped signals (TERM, INT, QUIT)
        expect(caps.mappedSignals.length).toBeGreaterThan(0);
        // And some unsupported (HUP, PIPE, ALRM, USR1, USR2)
        expect(caps.unsupportedSignals.length).toBeGreaterThan(0);
        // Total should be 8
        expect(caps.supportedSignals.length + caps.unsupportedSignals.length).toBe(8);
      }
    });

    test('supportsSignalExitCodes matches standalone function', async () => {
      const caps = await getPlatformCapabilities();
      expect(caps.supportsSignalExitCodes).toBe(supportsSignalExitCodes());
    });

    test('supported signals array contains expected signals', async () => {
      const caps = await getPlatformCapabilities();

      // SIGTERM and SIGINT should be supported on all platforms
      expect(caps.supportedSignals).toContain('SIGTERM');
      expect(caps.supportedSignals).toContain('SIGINT');
    });
  });

  describe('getSignalNumber', () => {
    test('returns Unix number for standard signals', async () => {
      const sigtermNum = await getSignalNumber('SIGTERM');
      expect(sigtermNum).toBe(15);

      const sigintNum = await getSignalNumber('SIGINT');
      expect(sigintNum).toBe(2);
    });

    test('returns platform-specific number for SIGUSR1/SIGUSR2', async () => {
      const platform = getPlatform();
      const sigusr1Num = await getSignalNumber('SIGUSR1');

      if (platform === 'linux') {
        expect(sigusr1Num).toBe(10);
      } else if (platform === 'darwin' || platform === 'freebsd') {
        expect(sigusr1Num).toBe(30);
      }
    });

    test('returns null for unknown signal', async () => {
      const num = await getSignalNumber('SIGNONEXISTENT');
      expect(num).toBeNull();
    });

    test('can query by signal ID', async () => {
      const numByName = await getSignalNumber('SIGTERM');
      const numById = await getSignalNumber('term');
      expect(numByName).toBe(numById);
    });
  });

  describe('getWindowsEvent', () => {
    test('returns Windows event for supported signals', async () => {
      const sigtermEvent = await getWindowsEvent('SIGTERM');
      expect(sigtermEvent).toBe('CTRL_CLOSE_EVENT');

      const sigintEvent = await getWindowsEvent('SIGINT');
      expect(sigintEvent).toBe('CTRL_C_EVENT');
    });

    test('returns null for unsupported signals', async () => {
      const sighupEvent = await getWindowsEvent('SIGHUP');
      expect(sighupEvent).toBeNull();

      const sigpipeEvent = await getWindowsEvent('SIGPIPE');
      expect(sigpipeEvent).toBeNull();
    });

    test('returns null for unknown signal', async () => {
      const event = await getWindowsEvent('SIGNONEXISTENT');
      expect(event).toBeNull();
    });
  });

  describe('Cross-Platform Consistency', () => {
    test('all signals return consistent support status', async () => {
      const signals = [
        'SIGTERM',
        'SIGINT',
        'SIGHUP',
        'SIGQUIT',
        'SIGPIPE',
        'SIGALRM',
        'SIGUSR1',
        'SIGUSR2',
      ];

      for (const signal of signals) {
        const supported = await supportsSignal(signal);
        const windowsEvent = await getWindowsEvent(signal);

        if (isPOSIX()) {
          // All signals supported on POSIX
          expect(supported).toBe(true);
        } else if (isWindows()) {
          // Windows support matches windows_event presence
          expect(supported).toBe(windowsEvent !== null);
        }
      }
    });

    test('capabilities summary matches individual queries', async () => {
      const caps = await getPlatformCapabilities();

      for (const signalName of caps.supportedSignals) {
        const supported = await supportsSignal(signalName);
        expect(supported).toBe(true);
      }

      for (const signalName of caps.unsupportedSignals) {
        const supported = await supportsSignal(signalName);
        expect(supported).toBe(false);
      }
    });
  });
});
