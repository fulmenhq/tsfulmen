/**
 * Signal Support Guards
 *
 * Validation functions that throw actionable errors when signals are unsupported.
 * Used to fail-fast with clear operational guidance.
 */

import { FoundryCatalogError } from "../errors.js";
import { isPOSIX, isWindows, supportsSignal } from "./capabilities.js";
import { getSignal } from "./catalog.js";
import { getFallbackMetadata } from "./windows.js";

/**
 * Guard options
 */
export interface GuardOptions {
  /**
   * Include platform-specific operational guidance in error message
   */
  includeGuidance?: boolean;
}

/**
 * Ensure a signal is supported on the current platform
 *
 * Throws an error with actionable guidance if the signal is not supported.
 * Use this as a guard at the start of signal registration functions.
 *
 * @param signalName - Signal name (e.g., "SIGTERM") or id (e.g., "term")
 * @param options - Guard configuration
 * @throws {FoundryCatalogError} If signal is not found or not supported
 *
 * @example
 * ```typescript
 * await ensureSupported("SIGHUP");
 * // On Windows: throws with HTTP fallback guidance
 * // On POSIX: passes through
 * ```
 */
export async function ensureSupported(
  signalName: string,
  options: GuardOptions = {},
): Promise<void> {
  const { includeGuidance = true } = options;

  // Check if signal exists in catalog
  const signal = await getSignal(signalName);
  if (!signal) {
    throw FoundryCatalogError.invalidSchema(
      "signals",
      `Signal "${signalName}" not found in catalog. ` +
        `Valid signals: SIGTERM, SIGINT, SIGHUP, SIGQUIT, SIGPIPE, SIGALRM, SIGUSR1, SIGUSR2`,
    );
  }

  // Check platform support
  const supported = await supportsSignal(signalName);
  if (supported) {
    return; // Signal is supported
  }

  // Signal is not supported - build actionable error message
  let message = `Signal ${signal.name} is not supported on this platform`;

  if (isWindows() && includeGuidance) {
    const fallback = await getFallbackMetadata(signalName);
    if (fallback) {
      message += `. ${fallback.log_message}`;

      // Add specific guidance based on fallback type
      switch (fallback.fallback_behavior) {
        case "http_admin_endpoint":
          message += `. Use HTTP endpoint: ${fallback.operation_hint}`;
          break;
        case "exception_handling":
          message += `. Alternative: ${fallback.operation_hint}`;
          break;
        case "timer_api":
          message += `. Alternative: ${fallback.operation_hint}`;
          break;
      }
    }
  }

  throw FoundryCatalogError.invalidSchema("signals", message);
}

/**
 * Ensure platform supports signal-based exit codes
 *
 * Throws an error if the platform doesn't support the POSIX 128+N exit code pattern.
 * Use this when exit code semantics are critical to application logic.
 *
 * @throws {FoundryCatalogError} If platform doesn't support signal exit codes
 *
 * @example
 * ```typescript
 * ensureSignalExitCodesSupported();
 * // On Windows: throws with guidance
 * // On POSIX: passes through
 * ```
 */
export function ensureSignalExitCodesSupported(): void {
  if (!isPOSIX()) {
    throw FoundryCatalogError.invalidSchema(
      "signals",
      "Signal-based exit codes (128+N pattern) are not supported on this platform. " +
        "Windows does not propagate signal numbers via exit codes. " +
        "Use explicit exit codes or monitor via HTTP admin endpoint.",
    );
  }
}

/**
 * Ensure platform is POSIX
 *
 * Throws an error if the platform is not POSIX-compliant.
 * Use this for functionality that strictly requires POSIX signal semantics.
 *
 * @throws {FoundryCatalogError} If platform is not POSIX
 */
export function ensurePOSIX(): void {
  if (!isPOSIX()) {
    throw FoundryCatalogError.invalidSchema(
      "signals",
      "This operation requires a POSIX-compliant platform (Linux, macOS, FreeBSD). " +
        "Current platform does not support native signal handling.",
    );
  }
}

/**
 * Ensure platform is Windows
 *
 * Throws an error if the platform is not Windows.
 * Use this for Windows-specific fallback testing or functionality.
 *
 * @throws {FoundryCatalogError} If platform is not Windows
 */
export function ensureWindows(): void {
  if (!isWindows()) {
    throw FoundryCatalogError.invalidSchema(
      "signals",
      "This operation requires Windows platform. Current platform uses native signals.",
    );
  }
}
