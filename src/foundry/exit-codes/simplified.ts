/**
 * Simplified Exit Code Mapping
 *
 * Provides simplified exit code modes for applications that don't need
 * the full granularity of 54 exit codes. Useful for:
 * - Windows environments where signal codes may not be relevant
 * - Simple scripts that only need basic success/failure indication
 * - Wrapper scripts that aggregate multiple failure types
 *
 * @module foundry/exit-codes/simplified
 */

import type { ExitCode } from '../../crucible/foundry/exitCodes.js';
import { exitCodeMetadata } from '../../crucible/foundry/exitCodes.js';

/**
 * Simplified exit code modes
 */
export enum SimplifiedMode {
  /**
   * BASIC mode: Only success (0) and failure (1)
   * - 0 = EXIT_SUCCESS
   * - 1 = All failures
   */
  BASIC = 'basic',

  /**
   * SEVERITY mode: Success, recoverable, config, fatal
   * - 0 = EXIT_SUCCESS
   * - 1 = Recoverable errors (retry possible)
   * - 2 = Configuration/usage errors (fix config, don't retry)
   * - 3 = Fatal errors (investigate required)
   */
  SEVERITY = 'severity',
}

/**
 * Map a full exit code to a simplified code based on mode
 *
 * @param code - Full exit code from exitCodes
 * @param mode - Simplified mode to use
 * @returns Simplified exit code (0-3 depending on mode)
 *
 * @example
 * ```ts
 * import { exitCodes, mapExitCodeToSimplified, SimplifiedMode } from '@fulmenhq/tsfulmen/foundry/exit-codes';
 *
 * // Basic mode - only 0 or 1
 * const basicCode = mapExitCodeToSimplified(exitCodes.EXIT_CONFIG_INVALID, SimplifiedMode.BASIC);
 * console.log(basicCode); // 1 (any failure)
 *
 * // Severity mode - categorizes failures
 * const sevCode = mapExitCodeToSimplified(exitCodes.EXIT_CONFIG_INVALID, SimplifiedMode.SEVERITY);
 * console.log(sevCode); // 2 (config error - don't retry)
 *
 * const retryCode = mapExitCodeToSimplified(exitCodes.EXIT_DATABASE_UNAVAILABLE, SimplifiedMode.SEVERITY);
 * console.log(retryCode); // 1 (recoverable - retry possible)
 * ```
 */
export function mapExitCodeToSimplified(
  code: ExitCode,
  mode: SimplifiedMode = SimplifiedMode.BASIC,
): number {
  // Success is always 0
  if (code === 0) {
    return 0;
  }

  // BASIC mode: everything else is 1
  if (mode === SimplifiedMode.BASIC) {
    return 1;
  }

  // SEVERITY mode: categorize based on metadata
  const info = exitCodeMetadata[code];
  if (!info) {
    // Unknown code - treat as fatal
    return 3;
  }

  // Check retry hint first
  if (info.retryHint === 'retry') {
    // Recoverable - likely transient failure
    return 1;
  }

  if (info.retryHint === 'no_retry') {
    // Configuration/permanent error - don't retry
    return 2;
  }

  if (info.retryHint === 'investigate') {
    // Serious issue requiring investigation
    return 3;
  }

  // Category-based fallback
  switch (info.category) {
    case 'configuration':
    case 'usage':
      // Config and usage errors - fix config, don't retry
      return 2;

    case 'networking':
    case 'runtime':
      // Network and runtime issues - often recoverable
      return 1;

    case 'permissions':
    case 'data':
      // Permission and data errors - likely permanent
      return 2;

    case 'security':
      // Security issues - investigate
      return 3;

    case 'observability':
      // Observability failures - recoverable if non-critical
      return 1;

    case 'testing':
      // Test failures - depends on context, default to failure
      return 1;

    case 'signals':
      // Signal termination - not applicable on Windows
      // Treat as fatal since process was forcibly terminated
      return 3;

    default:
      // Unknown category - treat as generic failure
      return 1;
  }
}

/**
 * Get all simplified exit codes for a given mode
 *
 * @param mode - Simplified mode
 * @returns Array of simplified codes for this mode
 *
 * @example
 * ```ts
 * import { getSimplifiedCodes, SimplifiedMode } from '@fulmenhq/tsfulmen/foundry/exit-codes';
 *
 * console.log(getSimplifiedCodes(SimplifiedMode.BASIC));
 * // [0, 1]
 *
 * console.log(getSimplifiedCodes(SimplifiedMode.SEVERITY));
 * // [0, 1, 2, 3]
 * ```
 */
export function getSimplifiedCodes(mode: SimplifiedMode): number[] {
  switch (mode) {
    case SimplifiedMode.BASIC:
      return [0, 1];
    case SimplifiedMode.SEVERITY:
      return [0, 1, 2, 3];
    default:
      return [0, 1];
  }
}

/**
 * Get description for a simplified exit code
 *
 * @param code - Simplified exit code
 * @param mode - Simplified mode
 * @returns Human-readable description
 */
export function getSimplifiedCodeDescription(code: number, mode: SimplifiedMode): string {
  if (mode === SimplifiedMode.BASIC) {
    switch (code) {
      case 0:
        return 'Success';
      case 1:
        return 'Failure';
      default:
        return 'Unknown';
    }
  }

  if (mode === SimplifiedMode.SEVERITY) {
    switch (code) {
      case 0:
        return 'Success';
      case 1:
        return 'Recoverable error (retry possible)';
      case 2:
        return "Configuration error (fix config, don't retry)";
      case 3:
        return 'Fatal error (investigate required)';
      default:
        return 'Unknown';
    }
  }

  return 'Unknown mode';
}
