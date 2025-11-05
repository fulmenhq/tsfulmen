/**
 * Signal Capability Detection
 *
 * Platform-aware signal support detection driven by catalog metadata.
 * Ensures cross-language parity by querying windows_event/fallback fields
 * rather than hardcoding signal names.
 */

import { getSignal, getSignalCatalog } from './catalog.js';

/**
 * Platform types
 */
export type Platform = 'linux' | 'darwin' | 'win32' | 'freebsd' | 'unknown';

/**
 * Platform capabilities summary
 */
export interface PlatformCapabilities {
  platform: Platform;
  isPOSIX: boolean;
  isWindows: boolean;
  supportsNativeSignals: boolean;
  supportsSignalExitCodes: boolean;
  supportedSignals: string[];
  unsupportedSignals: string[];
  mappedSignals: string[]; // Windows console events
}

/**
 * Detect current platform
 */
export function getPlatform(): Platform {
  const platform = process.platform;

  switch (platform) {
    case 'linux':
      return 'linux';
    case 'darwin':
      return 'darwin';
    case 'win32':
      return 'win32';
    case 'freebsd':
      return 'freebsd';
    default:
      return 'unknown';
  }
}

/**
 * Check if current platform is POSIX-compliant
 */
export function isPOSIX(): boolean {
  const platform = getPlatform();
  return platform === 'linux' || platform === 'darwin' || platform === 'freebsd';
}

/**
 * Check if current platform is Windows
 */
export function isWindows(): boolean {
  return getPlatform() === 'win32';
}

/**
 * Check if a signal is supported on the current platform
 *
 * Uses catalog metadata (windows_event field) to determine support.
 * Returns true if:
 * - Platform is POSIX (all signals natively supported)
 * - Platform is Windows AND signal has non-null windows_event
 *
 * @param signalName - Signal name (e.g., "SIGTERM") or id (e.g., "term")
 */
export async function supportsSignal(signalName: string): Promise<boolean> {
  const signal = await getSignal(signalName);
  if (!signal) {
    return false;
  }

  // POSIX platforms support all signals natively
  if (isPOSIX()) {
    return true;
  }

  // Windows: check if signal has a console event mapping
  if (isWindows()) {
    // Signal is supported if windows_event is non-null
    return signal.windows_event !== null;
  }

  // Unknown platform: conservative approach (assume unsupported)
  return false;
}

/**
 * Check if platform supports signal-based exit codes (128+N pattern)
 *
 * Windows doesn't propagate signal numbers via exit codes in the same way
 * as POSIX systems. This function helps applications decide whether to
 * rely on signal exit codes for process monitoring.
 */
export function supportsSignalExitCodes(): boolean {
  // Only POSIX systems reliably support 128+N exit code pattern
  return isPOSIX();
}

/**
 * Get comprehensive platform capabilities
 *
 * Queries catalog to build a complete picture of signal support.
 * Useful for capability reporting, documentation generation, and testing.
 */
export async function getPlatformCapabilities(): Promise<PlatformCapabilities> {
  const platform = getPlatform();
  const isPosix = isPOSIX();
  const isWin = isWindows();
  const catalog = await getSignalCatalog();

  const supported: string[] = [];
  const unsupported: string[] = [];
  const mapped: string[] = [];

  // Categorize signals based on platform
  for (const signal of catalog.signals) {
    if (isPosix) {
      // All signals supported on POSIX
      supported.push(signal.name);
    } else if (isWin) {
      if (signal.windows_event !== null) {
        // Signal has Windows console event mapping
        supported.push(signal.name);
        mapped.push(signal.name);
      } else {
        // No Windows support - requires fallback
        unsupported.push(signal.name);
      }
    } else {
      // Unknown platform - mark as unsupported
      unsupported.push(signal.name);
    }
  }

  return {
    platform,
    isPOSIX: isPosix,
    isWindows: isWin,
    supportsNativeSignals: isPosix,
    supportsSignalExitCodes: supportsSignalExitCodes(),
    supportedSignals: supported,
    unsupportedSignals: unsupported,
    mappedSignals: mapped,
  };
}

/**
 * Get the signal number for the current platform
 *
 * Handles platform-specific overrides (e.g., SIGUSR1/SIGUSR2 on macOS/FreeBSD).
 * Returns the appropriate signal number based on platform_overrides.
 *
 * @param signalName - Signal name (e.g., "SIGTERM") or id (e.g., "term")
 * @returns Signal number for current platform, or null if signal not found
 */
export async function getSignalNumber(signalName: string): Promise<number | null> {
  const signal = await getSignal(signalName);
  if (!signal) {
    return null;
  }

  const platform = getPlatform();

  // Check for platform-specific override
  if (signal.platform_overrides) {
    if (platform === 'darwin' && signal.platform_overrides.darwin !== undefined) {
      return signal.platform_overrides.darwin;
    }
    if (platform === 'freebsd' && signal.platform_overrides.freebsd !== undefined) {
      return signal.platform_overrides.freebsd;
    }
  }

  // Return standard Unix number
  return signal.unix_number;
}

/**
 * Get the Windows console event name for a signal
 *
 * Returns the Windows console event that corresponds to a Unix signal,
 * or null if the signal is not supported on Windows.
 *
 * @param signalName - Signal name (e.g., "SIGTERM") or id (e.g., "term")
 */
export async function getWindowsEvent(signalName: string): Promise<string | null> {
  const signal = await getSignal(signalName);
  if (!signal) {
    return null;
  }

  return signal.windows_event;
}
