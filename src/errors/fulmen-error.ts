/**
 * FulmenError - Structured error data model for observability
 *
 * Implements ADR-0006 error data model extending Pathfinder error-response
 * with optional telemetry metadata (severity, correlation_id, trace_id, etc.)
 */

import { extractErrorMessage, extractStackTrace, type FulmenErrorData } from "./serialization.js";
import type { SeverityLevel, SeverityName } from "./severity.js";
import { getDefaultSeverity, SEVERITY_LEVELS, Severity } from "./severity.js";
import { validateErrorData } from "./validators.js";

// Re-export FulmenErrorData from serialization
export type { FulmenErrorData } from "./serialization.js";

/**
 * Options for creating/wrapping FulmenError
 */
export interface FulmenErrorOptions {
  code?: string;
  severity?: SeverityName;
  correlation_id?: string;
  trace_id?: string;
  exit_code?: number;
  context?: Record<string, unknown>;
  details?: Record<string, unknown>;
  path?: string;
}

/**
 * FulmenError class - wraps structured error data with helper methods
 *
 * Implements ADR-0006 canonical data model pattern:
 * - Data stored in immutable FulmenErrorData interface
 * - Class provides ergonomic API and methods
 * - Extends native Error for stack traces and instanceof checks
 */
export class FulmenError extends Error {
  readonly data: FulmenErrorData;

  constructor(data: FulmenErrorData) {
    super(data.message);
    this.name = "FulmenError";

    // Freeze data for immutability
    this.data = Object.freeze({ ...data });

    // Capture stack trace
    Error.captureStackTrace(this, FulmenError);
  }

  /**
   * Serialize to JSON (schema-compliant)
   */
  toJSON(): FulmenErrorData {
    return this.data;
  }

  /**
   * Check equality with another FulmenError
   */
  equals(other: FulmenError): boolean {
    return JSON.stringify(this.data) === JSON.stringify(other.data);
  }

  /**
   * Get severity level for comparison
   */
  getSeverityLevel(): SeverityLevel {
    return this.data.severity_level ?? SEVERITY_LEVELS[this.data.severity ?? "medium"];
  }

  /**
   * Wrap an existing error with FulmenError structure
   *
   * @param error - Error to wrap (Error instance or FulmenErrorData)
   * @param options - Additional error options
   * @returns New FulmenError instance
   *
   * @example
   * ```typescript
   * try {
   *   throw new Error('Config invalid');
   * } catch (err) {
   *   const fulmenErr = FulmenError.wrap(err, {
   *     code: 'CONFIG_INVALID',
   *     severity: 'high',
   *     exit_code: 2
   *   });
   *   throw fulmenErr;
   * }
   * ```
   */
  static wrap(error: Error | FulmenErrorData, options: FulmenErrorOptions = {}): FulmenError {
    // If already FulmenError, merge options with recomputed derived fields
    if (error instanceof FulmenError) {
      // Determine effective severity (prefer options, fallback to existing, default to medium)
      const effectiveSeverity = options.severity ?? error.data.severity ?? Severity.MEDIUM;
      // CRITICAL: Recompute severity_level from severity to maintain consistency (ADR-0006)
      const effectiveSeverityLevel = SEVERITY_LEVELS[effectiveSeverity];

      // Update timestamp when re-wrapping (indicates new error context)
      const timestamp = new Date().toISOString();

      return new FulmenError({
        ...error.data,
        ...options,
        code: options.code ?? error.data.code,
        message: error.data.message,
        severity: effectiveSeverity, // Consistent severity
        severity_level: effectiveSeverityLevel, // Recomputed level
        timestamp, // Updated timestamp
      });
    }

    // If FulmenErrorData, recompute derived fields
    if (isFulmenErrorData(error)) {
      const defaultSeverity = getDefaultSeverity();
      // Prefer options.severity, fall back to error.severity, default to medium
      const effectiveSeverity = options.severity ?? error.severity ?? defaultSeverity.name;
      // CRITICAL: Always recompute severity_level from severity (never trust provided level)
      const effectiveSeverityLevel = SEVERITY_LEVELS[effectiveSeverity];

      return new FulmenError({
        ...error,
        ...options,
        severity: effectiveSeverity,
        severity_level: effectiveSeverityLevel, // Recomputed, not from error.severity_level
        timestamp: error.timestamp ?? new Date().toISOString(),
      });
    }

    // Wrap native Error
    return FulmenError.fromError(error, options);
  }

  /**
   * Create FulmenError from native Error object
   *
   * @param err - Native Error instance
   * @param options - Error options
   * @returns New FulmenError instance
   *
   * @example
   * ```typescript
   * const err = new TypeError('Invalid type');
   * const fulmenErr = FulmenError.fromError(err, {
   *   code: 'TYPE_ERROR',
   *   severity: 'medium'
   * });
   * ```
   */
  static fromError(err: Error | unknown, options: FulmenErrorOptions = {}): FulmenError {
    const code = options.code ?? "UNKNOWN_ERROR";
    const severity = options.severity ?? Severity.MEDIUM;
    const severityLevel = SEVERITY_LEVELS[severity];

    const message = extractErrorMessage(err);
    const stack = extractStackTrace(err);

    const data: FulmenErrorData = {
      code,
      message,
      severity,
      severity_level: severityLevel,
      timestamp: new Date().toISOString(),
      ...options,
      context: {
        ...options.context,
        originalName: err instanceof Error ? err.name : typeof err,
        stack,
      },
      original: stack || message,
    };

    return new FulmenError(data);
  }

  /**
   * Validate error data against schema
   *
   * @param data - Error data to validate
   * @returns Promise resolving to true if valid
   *
   * @example
   * ```typescript
   * const data = { code: 'TEST', message: 'Test error' };
   * if (await FulmenError.validate(data)) {
   *   const err = new FulmenError(data);
   * }
   * ```
   */
  static async validate(data: unknown): Promise<boolean> {
    return validateErrorData(data);
  }

  /**
   * Exit process with structured error
   *
   * Logs error as JSON and exits with specified exit code.
   * Mockable for testing (override process.exit).
   *
   * @param error - FulmenError instance
   * @param options - Exit options
   *
   * @example
   * ```typescript
   * const err = FulmenError.fromError(new Error('Fatal'), {
   *   code: 'FATAL_ERROR',
   *   exit_code: 1
   * });
   * FulmenError.exitWithError(err); // Exits with code 1
   * ```
   */
  static exitWithError(
    error: FulmenError,
    options: { logger?: (msg: string) => void } = {},
  ): never {
    const logger = options.logger ?? console.error;
    const exitCode = error.data.exit_code ?? 1;

    // Log structured error
    logger(JSON.stringify(error.toJSON(), null, 2));

    // Exit with code
    process.exit(exitCode);
  }
}

/**
 * Type guard to check if value is FulmenError instance
 *
 * @param value - Value to check
 * @returns True if value is FulmenError
 */
export function isFulmenError(value: unknown): value is FulmenError {
  return value instanceof FulmenError;
}

/**
 * Type guard to check if value is FulmenErrorData
 *
 * @param value - Value to check
 * @returns True if value is FulmenErrorData
 */
export function isFulmenErrorData(value: unknown): value is FulmenErrorData {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as FulmenErrorData).code === "string" &&
    "message" in value &&
    typeof (value as FulmenErrorData).message === "string"
  );
}
