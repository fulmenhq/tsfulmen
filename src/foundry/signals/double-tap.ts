/**
 * Double-Tap Signal Handling
 *
 * Implements Ctrl+C double-tap pattern for graceful shutdown with force-quit option.
 * Per Crucible standard: 2-second window, immediate exit on second signal.
 */

import { getSignal } from "./catalog.js";
import type { FallbackLogger } from "./windows.js";

/**
 * Double-tap configuration
 */
export interface DoubleTapConfig {
  /**
   * Debounce window in milliseconds (default: 2000ms per Crucible standard)
   */
  windowMs?: number;

  /**
   * Exit code for forced double-tap exit (default: 130 for SIGINT)
   */
  exitCode?: number;

  /**
   * Message to display on first signal (default: from catalog)
   */
  hintMessage?: string;

  /**
   * Logger for double-tap events
   */
  logger?: FallbackLogger;

  /**
   * Enable test mode (prevents process.exit calls)
   */
  testMode?: boolean;
}

/**
 * Double-tap state tracker
 */
export interface DoubleTapState {
  firstTapTime: number | null;
  windowMs: number;
  exitCode: number;
  hintMessage: string;
  logger?: FallbackLogger;
  testMode: boolean;
}

/**
 * Create double-tap state tracker for a signal
 *
 * @param signalName - Signal name (typically "SIGINT")
 * @param config - Double-tap configuration
 */
export async function createDoubleTapTracker(
  signalName: string,
  config: DoubleTapConfig = {},
): Promise<DoubleTapState> {
  const signal = await getSignal(signalName);

  // Get defaults from catalog if available
  const defaultWindowMs = signal?.double_tap_window_seconds
    ? signal.double_tap_window_seconds * 1000
    : 2000;
  const defaultExitCode = signal?.double_tap_exit_code || 130;
  const defaultHintMessage =
    signal?.double_tap_message || "Press Ctrl+C again within 2s to force quit";

  return {
    firstTapTime: null,
    windowMs: config.windowMs ?? defaultWindowMs,
    exitCode: config.exitCode ?? defaultExitCode,
    hintMessage: config.hintMessage ?? defaultHintMessage,
    logger: config.logger,
    testMode: config.testMode ?? false,
  };
}

/**
 * Handle double-tap signal logic
 *
 * Returns true if this is the second tap (force-quit), false if first tap.
 * Updates state to track timing between taps.
 *
 * @param state - Double-tap state tracker
 * @returns true if force-quit should proceed, false if graceful shutdown
 */
export function handleDoubleTap(state: DoubleTapState): boolean {
  const now = Date.now();

  // First tap
  if (state.firstTapTime === null) {
    state.firstTapTime = now;
    if (state.logger) {
      state.logger.info(state.hintMessage);
    } else {
      console.log(state.hintMessage);
    }
    return false; // Start graceful shutdown
  }

  // Check if within window
  const elapsed = now - state.firstTapTime;
  if (elapsed < state.windowMs) {
    // Second tap within window - force quit
    if (state.logger) {
      state.logger.info("Force quitting...");
    } else {
      console.log("Force quitting...");
    }

    if (!state.testMode) {
      process.exit(state.exitCode);
    }

    return true; // Force quit
  }

  // Outside window - treat as new first tap
  state.firstTapTime = now;
  if (state.logger) {
    state.logger.info(state.hintMessage);
  } else {
    console.log(state.hintMessage);
  }
  return false; // Start new graceful shutdown
}

/**
 * Reset double-tap state
 *
 * Called when graceful shutdown completes before second tap.
 */
export function resetDoubleTap(state: DoubleTapState): void {
  state.firstTapTime = null;
}

/**
 * Check if currently within double-tap window
 *
 * Useful for testing and debugging.
 */
export function isWithinWindow(state: DoubleTapState): boolean {
  if (state.firstTapTime === null) {
    return false;
  }
  const elapsed = Date.now() - state.firstTapTime;
  return elapsed < state.windowMs;
}

/**
 * Get time remaining in double-tap window (milliseconds)
 *
 * Returns null if not in a window, otherwise milliseconds remaining.
 */
export function getWindowTimeRemaining(state: DoubleTapState): number | null {
  if (state.firstTapTime === null) {
    return null;
  }
  const elapsed = Date.now() - state.firstTapTime;
  const remaining = state.windowMs - elapsed;
  return remaining > 0 ? remaining : null;
}
