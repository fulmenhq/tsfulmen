/**
 * Error serialization utilities
 *
 * Provides safe serialization of Error objects and unknown errors to structured data
 */

import { Severity, type SeverityLevel, type SeverityName } from "./severity.js";

/**
 * FulmenError data structure (for serialization)
 * Defined here to avoid circular dependency
 */
export interface FulmenErrorData {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly path?: string;
  readonly timestamp?: string;
  readonly severity?: SeverityName;
  readonly severity_level?: SeverityLevel;
  readonly correlation_id?: string;
  readonly trace_id?: string;
  readonly exit_code?: number;
  readonly context?: Record<string, unknown>;
  readonly original?: string | object;
}

/**
 * Safely serialize any error-like value to FulmenErrorData structure
 *
 * Handles native Error objects, plain objects, strings, and unknown types.
 *
 * @param error - Error value to serialize
 * @param code - Optional error code (defaults to 'UNKNOWN_ERROR')
 * @param severity - Optional severity (defaults to 'medium')
 * @returns Structured error data
 *
 * @example
 * ```typescript
 * try {
 *   throw new Error('Something failed');
 * } catch (err) {
 *   const data = serializeError(err, 'OPERATION_FAILED', 'high');
 *   console.log(JSON.stringify(data));
 * }
 * ```
 */
export function serializeError(
  error: unknown,
  code = "UNKNOWN_ERROR",
  severity: SeverityName = Severity.MEDIUM,
): FulmenErrorData {
  // Handle Error instances
  if (error instanceof Error) {
    return {
      code,
      message: error.message,
      severity,
      timestamp: new Date().toISOString(),
      context: {
        name: error.name,
        stack: error.stack,
      },
      original: error.stack || error.message,
    };
  }

  // Handle plain objects with message
  if (isErrorLike(error)) {
    return {
      code,
      message: error.message,
      severity,
      timestamp: new Date().toISOString(),
      details: error.details,
      context: error.context,
      original: JSON.stringify(error),
    };
  }

  // Handle strings
  if (typeof error === "string") {
    return {
      code,
      message: error,
      severity,
      timestamp: new Date().toISOString(),
    };
  }

  // Handle everything else
  return {
    code,
    message: String(error),
    severity,
    timestamp: new Date().toISOString(),
    original: typeof error === "object" ? JSON.stringify(error) : String(error),
  };
}

/**
 * Extract error message from unknown error value
 *
 * @param error - Error value
 * @returns Error message string
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (isErrorLike(error)) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

/**
 * Extract stack trace from error if available
 *
 * @param error - Error value
 * @returns Stack trace string or undefined
 */
export function extractStackTrace(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  if (isErrorLike(error) && typeof error.stack === "string") {
    return error.stack;
  }
  return undefined;
}

/**
 * Type guard for error-like objects
 */
function isErrorLike(value: unknown): value is {
  message: string;
  stack?: string;
  details?: Record<string, unknown>;
  context?: Record<string, unknown>;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  );
}
