/**
 * Double-Tap Signal Tests
 *
 * Tests for Ctrl+C double-tap pattern with timing control.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  createDoubleTapTracker,
  type DoubleTapState,
  getWindowTimeRemaining,
  handleDoubleTap,
  isWithinWindow,
  resetDoubleTap,
} from '../double-tap.js';

describe('Double-Tap Signal Handling', () => {
  describe('createDoubleTapTracker', () => {
    test('creates tracker with default config', async () => {
      const tracker = await createDoubleTapTracker('SIGINT');
      expect(tracker.firstTapTime).toBeNull();
      expect(tracker.windowMs).toBe(2000); // Default from catalog
      expect(tracker.exitCode).toBe(130); // Default from catalog
      expect(tracker.testMode).toBe(false);
    });

    test('creates tracker with custom config', async () => {
      const tracker = await createDoubleTapTracker('SIGINT', {
        windowMs: 3000,
        exitCode: 99,
        testMode: true,
      });
      expect(tracker.windowMs).toBe(3000);
      expect(tracker.exitCode).toBe(99);
      expect(tracker.testMode).toBe(true);
    });

    test('uses catalog defaults for SIGINT', async () => {
      const tracker = await createDoubleTapTracker('SIGINT');
      expect(tracker.hintMessage).toContain('Ctrl+C');
      expect(tracker.hintMessage).toContain('2s');
    });
  });

  describe('handleDoubleTap - First Tap', () => {
    let tracker: DoubleTapState;

    beforeEach(async () => {
      tracker = await createDoubleTapTracker('SIGINT', { testMode: true });
    });

    test('first tap returns false (graceful shutdown)', () => {
      const result = handleDoubleTap(tracker);
      expect(result).toBe(false);
    });

    test('first tap sets timestamp', () => {
      expect(tracker.firstTapTime).toBeNull();
      handleDoubleTap(tracker);
      expect(tracker.firstTapTime).not.toBeNull();
    });

    test('first tap is within window after tap', () => {
      handleDoubleTap(tracker);
      expect(isWithinWindow(tracker)).toBe(true);
    });

    test('first tap has time remaining', () => {
      handleDoubleTap(tracker);
      const remaining = getWindowTimeRemaining(tracker);
      expect(remaining).not.toBeNull();
      expect(remaining!).toBeGreaterThan(0);
    });
  });

  describe('handleDoubleTap - Second Tap', () => {
    let tracker: DoubleTapState;

    beforeEach(async () => {
      tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
        windowMs: 2000,
      });
    });

    test('second tap within window returns true (force quit)', async () => {
      handleDoubleTap(tracker); // First tap

      // Simulate small delay (within window)
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = handleDoubleTap(tracker); // Second tap
      expect(result).toBe(true);
    });

    test('second tap outside window returns false (new graceful)', async () => {
      handleDoubleTap(tracker); // First tap

      // Simulate delay beyond window
      await new Promise((resolve) => setTimeout(resolve, 2100));

      const result = handleDoubleTap(tracker); // Second tap (actually new first)
      expect(result).toBe(false);
    }, 3000);

    test('second tap outside window resets timing', async () => {
      handleDoubleTap(tracker); // First tap
      const firstTime = tracker.firstTapTime;

      // Wait beyond window
      await new Promise((resolve) => setTimeout(resolve, 2100));

      handleDoubleTap(tracker); // Treated as new first tap
      expect(tracker.firstTapTime).not.toBe(firstTime);
    }, 3000);
  });

  describe('resetDoubleTap', () => {
    test('clears first tap timestamp', async () => {
      const tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
      });
      handleDoubleTap(tracker);
      expect(tracker.firstTapTime).not.toBeNull();

      resetDoubleTap(tracker);
      expect(tracker.firstTapTime).toBeNull();
    });

    test('reset puts tracker back to initial state', async () => {
      const tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
      });
      handleDoubleTap(tracker);
      resetDoubleTap(tracker);

      expect(isWithinWindow(tracker)).toBe(false);
      expect(getWindowTimeRemaining(tracker)).toBeNull();
    });
  });

  describe('isWithinWindow', () => {
    test('returns false with no taps', async () => {
      const tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
      });
      expect(isWithinWindow(tracker)).toBe(false);
    });

    test('returns true immediately after first tap', async () => {
      const tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
      });
      handleDoubleTap(tracker);
      expect(isWithinWindow(tracker)).toBe(true);
    });

    test('returns false after window expires', async () => {
      const tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
        windowMs: 100,
      });
      handleDoubleTap(tracker);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(isWithinWindow(tracker)).toBe(false);
    }, 300);
  });

  describe('getWindowTimeRemaining', () => {
    test('returns null with no taps', async () => {
      const tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
      });
      expect(getWindowTimeRemaining(tracker)).toBeNull();
    });

    test('returns positive value immediately after tap', async () => {
      const tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
        windowMs: 2000,
      });
      handleDoubleTap(tracker);

      const remaining = getWindowTimeRemaining(tracker);
      expect(remaining).not.toBeNull();
      expect(remaining!).toBeGreaterThan(1800); // Should be close to 2000
    });

    test('returns null after window expires', async () => {
      const tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
        windowMs: 100,
      });
      handleDoubleTap(tracker);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(getWindowTimeRemaining(tracker)).toBeNull();
    }, 300);

    test('remaining time decreases over time', async () => {
      const tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
        windowMs: 1000,
      });
      handleDoubleTap(tracker);

      const remaining1 = getWindowTimeRemaining(tracker);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const remaining2 = getWindowTimeRemaining(tracker);

      expect(remaining2).toBeLessThan(remaining1!);
    }, 500);
  });

  describe('Message Logging', () => {
    test('logs hint message on first tap', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
      });

      handleDoubleTap(tracker);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Ctrl+C'));
      consoleSpy.mockRestore();
    });

    test('logs force quit message on second tap', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
      });

      handleDoubleTap(tracker); // First
      await new Promise((resolve) => setTimeout(resolve, 100));
      handleDoubleTap(tracker); // Second

      expect(consoleSpy).toHaveBeenCalledWith('Force quitting...');
      consoleSpy.mockRestore();
    });

    test('uses custom logger when provided', async () => {
      const logCalls: string[] = [];
      const logger = {
        info: (msg: string) => {
          logCalls.push(msg);
        },
        warn: () => {},
      };

      const tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
        logger,
      });

      handleDoubleTap(tracker);
      expect(logCalls.length).toBeGreaterThan(0);
      expect(logCalls[0]).toContain('Ctrl+C');
    });
  });

  describe('Edge Cases', () => {
    test('handles rapid triple tap correctly', async () => {
      const tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
      });

      const first = handleDoubleTap(tracker);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const second = handleDoubleTap(tracker);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const third = handleDoubleTap(tracker);

      expect(first).toBe(false); // Graceful
      expect(second).toBe(true); // Force quit
      expect(third).toBe(true); // Still force (window still active)
    }, 300);

    test('handles very short window', async () => {
      const tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
        windowMs: 10,
      });

      handleDoubleTap(tracker);
      await new Promise((resolve) => setTimeout(resolve, 20));
      const result = handleDoubleTap(tracker);

      // Window expired - new first tap
      expect(result).toBe(false);
    });

    test('handles zero window (immediate)', async () => {
      const tracker = await createDoubleTapTracker('SIGINT', {
        testMode: true,
        windowMs: 0,
      });

      handleDoubleTap(tracker);
      const result = handleDoubleTap(tracker);

      // Window always expired with 0ms
      expect(result).toBe(false);
    });
  });
});
