/**
 * Exit Code Capabilities Detection
 *
 * Detects platform capabilities for exit code support, particularly
 * for signal-based exit codes which are POSIX-specific.
 *
 * @module foundry/exit-codes/capabilities
 */

/**
 * Check if the current platform supports signal-based exit codes
 *
 * Signal exit codes (128+N pattern) are POSIX-specific and not
 * meaningful on Windows. Applications should use this to decide
 * whether to use simplified mode.
 *
 * @returns true if platform supports signal exit codes (POSIX), false otherwise (Windows)
 *
 * @example
 * ```ts
 * import { supportsSignalExitCodes, SimplifiedMode } from '@fulmenhq/tsfulmen/foundry/exit-codes';
 *
 * const exitCodeMode = supportsSignalExitCodes()
 *   ? 'full' // Use all 54 exit codes
 *   : SimplifiedMode.SEVERITY; // Use simplified mode on Windows
 *
 * console.log(`Exit code mode: ${exitCodeMode}`);
 * ```
 *
 * @example
 * ```ts
 * // Guard signal exit code usage
 * import { exitCodes, supportsSignalExitCodes } from '@fulmenhq/tsfulmen/foundry/exit-codes';
 *
 * function handleTermination() {
 *   if (supportsSignalExitCodes()) {
 *     // POSIX: Use specific signal exit code
 *     process.exit(exitCodes.EXIT_SIGNAL_TERM);
 *   } else {
 *     // Windows: Use generic failure
 *     process.exit(exitCodes.EXIT_FAILURE);
 *   }
 * }
 * ```
 */
export function supportsSignalExitCodes(): boolean {
  // Windows does not support POSIX signals in the same way
  // WSL reports as 'linux' so it will correctly return true
  return process.platform !== 'win32';
}

/**
 * Get the current platform identifier
 *
 * Useful for logging and diagnostics.
 *
 * @returns Platform string (linux, darwin, win32, etc.)
 */
export function getPlatform(): NodeJS.Platform {
  return process.platform;
}

/**
 * Check if running on Windows (including WSL detection)
 *
 * Note: WSL reports as 'linux' not 'win32', so this only returns
 * true for native Windows processes.
 *
 * @returns true if running on native Windows
 */
export function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Check if running on a POSIX-compliant platform
 *
 * @returns true if running on Linux, macOS, or other POSIX systems
 */
export function isPOSIX(): boolean {
  return !isWindows();
}

/**
 * Platform capabilities summary
 */
export interface PlatformCapabilities {
  platform: NodeJS.Platform;
  supportsSignalExitCodes: boolean;
  isPOSIX: boolean;
  isWindows: boolean;
}

/**
 * Get a summary of platform capabilities
 *
 * @returns Platform capabilities object
 *
 * @example
 * ```ts
 * import { getPlatformCapabilities } from '@fulmenhq/tsfulmen/foundry/exit-codes';
 *
 * const caps = getPlatformCapabilities();
 * console.log(`Platform: ${caps.platform}`);
 * console.log(`Supports signal exit codes: ${caps.supportsSignalExitCodes}`);
 * ```
 */
export function getPlatformCapabilities(): PlatformCapabilities {
  return {
    platform: getPlatform(),
    supportsSignalExitCodes: supportsSignalExitCodes(),
    isPOSIX: isPOSIX(),
    isWindows: isWindows(),
  };
}
