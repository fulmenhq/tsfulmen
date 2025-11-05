/**
 * Windows Signal Fallback
 *
 * Implements standardized Windows fallback behavior for unsupported signals.
 * Follows Crucible specification for logging, telemetry, and operational hints.
 */

import { getSignal } from './catalog.js';
import type { WindowsFallback } from './types.js';

/**
 * Windows fallback result
 */
export interface WindowsFallbackResult {
  supported: boolean;
  fallback?: WindowsFallback;
  logged: boolean;
}

/**
 * Logger interface for Windows fallback
 *
 * Applications should provide a logger instance that implements this interface.
 * If no logger is provided, messages are written to console.
 */
export interface FallbackLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Telemetry emitter interface
 *
 * Applications should provide a telemetry emitter for observability.
 * If no emitter is provided, telemetry events are skipped.
 */
export interface TelemetryEmitter {
  emit(event: string, tags: Record<string, string>): void;
}

/**
 * Windows fallback options
 */
export interface WindowsFallbackOptions {
  logger?: FallbackLogger;
  telemetry?: TelemetryEmitter;
  silent?: boolean; // Skip logging/telemetry (for testing)
}

/**
 * Default console logger implementation
 */
const defaultLogger: FallbackLogger = {
  info(message: string, meta?: Record<string, unknown>) {
    if (meta) {
      console.info(message, meta);
    } else {
      console.info(message);
    }
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (meta) {
      console.warn(message, meta);
    } else {
      console.warn(message);
    }
  },
};

/**
 * Handle Windows signal registration fallback
 *
 * This function is called when attempting to register a signal handler
 * on Windows for a signal that lacks native support.
 *
 * Behavior per Crucible standard:
 * 1. Log structured message at INFO level (not WARN - this is expected on Windows)
 * 2. Emit standardized telemetry event (fulmen.signal.unsupported)
 * 3. Return fallback metadata for operational guidance
 *
 * @param signalName - Signal name (e.g., "SIGHUP")
 * @param options - Logging and telemetry configuration
 */
export async function handleWindowsFallback(
  signalName: string,
  options: WindowsFallbackOptions = {},
): Promise<WindowsFallbackResult> {
  const signal = await getSignal(signalName);

  // Signal not found in catalog
  if (!signal) {
    return {
      supported: false,
      logged: false,
    };
  }

  // Signal is supported (has windows_event)
  if (signal.windows_event !== null) {
    return {
      supported: true,
      logged: false,
    };
  }

  // Signal is unsupported on Windows - apply fallback
  const fallback = signal.windows_fallback;
  if (!fallback) {
    // No fallback metadata defined (shouldn't happen with valid catalog)
    return {
      supported: false,
      logged: false,
    };
  }

  // Skip logging/telemetry if silent mode
  if (options.silent) {
    return {
      supported: false,
      fallback,
      logged: false,
    };
  }

  const logger = options.logger || defaultLogger;
  const telemetry = options.telemetry;

  // Structured logging per Crucible standard
  // Template: signal=${signal} platform=${platform} fallback=${fallback_behavior} message='${operation_hint}'
  const logMeta = {
    signal: signal.name,
    platform: 'windows',
    fallback: fallback.fallback_behavior,
    operation_hint: fallback.operation_hint,
  };

  // Log at INFO level (not WARN - this is expected Windows behavior)
  logger.info(fallback.log_message, logMeta);

  // Emit standardized telemetry
  if (telemetry) {
    telemetry.emit(fallback.telemetry_event, fallback.telemetry_tags);
  }

  return {
    supported: false,
    fallback,
    logged: true,
  };
}

/**
 * Get fallback metadata for a signal without logging
 *
 * Useful for capability checking and testing without side effects.
 *
 * @param signalName - Signal name (e.g., "SIGHUP")
 */
export async function getFallbackMetadata(signalName: string): Promise<WindowsFallback | null> {
  const signal = await getSignal(signalName);
  if (!signal || !signal.windows_fallback) {
    return null;
  }
  return signal.windows_fallback;
}

/**
 * Check if a signal requires Windows fallback
 *
 * Returns true if signal is defined in catalog but lacks Windows support
 * (windows_event is null and windows_fallback is defined).
 *
 * @param signalName - Signal name (e.g., "SIGHUP")
 */
export async function requiresFallback(signalName: string): Promise<boolean> {
  const signal = await getSignal(signalName);
  if (!signal) {
    return false;
  }
  return signal.windows_event === null && signal.windows_fallback !== undefined;
}

/**
 * Get HTTP endpoint recommendation for Windows fallback
 *
 * Returns formatted operational guidance for signals that require
 * HTTP admin endpoint fallback on Windows.
 *
 * @param signalName - Signal name (e.g., "SIGHUP")
 */
export async function getHttpFallbackGuidance(signalName: string): Promise<string | null> {
  const fallback = await getFallbackMetadata(signalName);
  if (!fallback || fallback.fallback_behavior !== 'http_admin_endpoint') {
    return null;
  }
  return fallback.operation_hint;
}
