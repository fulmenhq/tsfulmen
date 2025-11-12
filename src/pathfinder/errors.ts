/**
 * Pathfinder errors - Domain-specific error helpers
 *
 * Provides pathfinder-specific error codes and factory functions
 * that wrap FulmenError with appropriate metadata.
 */

import type { FulmenErrorOptions } from "../errors/index.js";
import { FulmenError } from "../errors/index.js";

/**
 * Pathfinder error codes
 *
 * All codes prefixed with 'pathfinder.' for domain identification.
 */
export enum PathfinderErrorCode {
  /** Configuration validation failed */
  INVALID_CONFIG = "pathfinder.invalid_config",

  /** Root directory invalid or inaccessible */
  INVALID_ROOT = "pathfinder.invalid_root",

  /** Filesystem traversal operation failed */
  TRAVERSAL_FAILED = "pathfinder.traversal_failed",

  /** Path constraint violation detected */
  CONSTRAINT_VIOLATION = "pathfinder.constraint_violation",

  /** Checksum calculation failed */
  CHECKSUM_FAILED = "pathfinder.checksum_failed",

  /** Schema validation failed */
  VALIDATION_FAILED = "pathfinder.validation_failed",

  /** Ignore file parsing failed */
  IGNORE_FILE_ERROR = "pathfinder.ignore_file_error",
}

/**
 * Create a pathfinder-specific FulmenError
 *
 * Factory function that creates properly structured errors with
 * pathfinder domain, filesystem category, and appropriate severity.
 *
 * @param code - Pathfinder error code
 * @param message - Human-readable error message
 * @param options - Additional error options (severity, context, etc.)
 * @returns FulmenError instance with pathfinder metadata
 *
 * @example
 * ```typescript
 * throw createPathfinderError(
 *   PathfinderErrorCode.INVALID_ROOT,
 *   'Root directory does not exist',
 *   { severity: 'high', context: { root: '/nonexistent' } }
 * );
 * ```
 */
export function createPathfinderError(
  code: PathfinderErrorCode,
  message: string,
  options?: Partial<FulmenErrorOptions>,
): FulmenError {
  return new FulmenError({
    code,
    message,
    severity: options?.severity ?? "medium",
    context: {
      domain: "pathfinder",
      category: "filesystem",
      ...options?.context,
    },
    ...options,
  });
}

/**
 * Wrap an existing error as a PathfinderError
 *
 * Preserves the original error as the cause while adding
 * pathfinder-specific metadata.
 *
 * @param error - Original error to wrap
 * @param code - Pathfinder error code
 * @param context - Additional context information
 * @returns FulmenError wrapping the original error
 *
 * @example
 * ```typescript
 * try {
 *   await fs.readdir(dir);
 * } catch (err) {
 *   throw wrapPathfinderError(
 *     err,
 *     PathfinderErrorCode.TRAVERSAL_FAILED,
 *     { directory: dir }
 *   );
 * }
 * ```
 */
export function wrapPathfinderError(
  error: Error,
  code: PathfinderErrorCode,
  context?: Record<string, unknown>,
): FulmenError {
  return FulmenError.wrap(error, {
    code,
    severity: "medium",
    context: {
      domain: "pathfinder",
      category: "filesystem",
      ...context,
    },
  });
}
