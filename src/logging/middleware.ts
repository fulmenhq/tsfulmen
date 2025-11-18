/**
 * Middleware implementations for log processing pipeline
 */

import type { LogEvent, Middleware } from "./types.js";

/**
 * Default secret field names (case-insensitive) aligned with gofulmen
 */
const DEFAULT_SECRET_KEYS = [
  "password",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "secret",
  "cardnumber",
  "card_number",
  "cvv",
  "ssn",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
];

/**
 * Default secret patterns aligned with gofulmen
 */
const DEFAULT_SECRET_PATTERNS = [
  /SECRET_[A-Z0-9_]+/g, // Environment variable secrets
  /[A-Z0-9_]*TOKEN[A-Z0-9_]*/g, // Token variants
  /[A-Z0-9_]*KEY[A-Z0-9_]*/g, // Key variants
  /[A-Za-z0-9+/]{40,}={0,2}/g, // Base64 blobs (~40+ chars)
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email addresses
  /\b\d{13,19}\b/g, // Credit card numbers (13-19 digits)
];

/**
 * Size threshold for pattern scanning (bytes)
 * Strings larger than this will skip pattern scanning for performance
 */
const MAX_PATTERN_SCAN_SIZE = 10240; // 10KB

/**
 * Redact secrets middleware - removes sensitive data from log events
 *
 * Supports both field-based redaction (case-insensitive) and pattern-based
 * redaction with gofulmen-aligned defaults.
 */
export class RedactSecretsMiddleware implements Middleware {
  private readonly secretKeys: string[];
  private readonly secretKeysLower: string[];
  private readonly patterns: RegExp[];

  constructor(
    optionsOrKeys?:
      | string[]
      | {
          secretKeys?: string[];
          patterns?: RegExp[];
          useDefaultPatterns?: boolean;
        },
  ) {
    // Backward compatibility: support both old array format and new options format
    let secretKeys: string[];
    let patterns: RegExp[] = [];
    let useDefaultPatterns = true;

    if (Array.isArray(optionsOrKeys)) {
      // Old format: array of secret keys
      secretKeys = optionsOrKeys;
      useDefaultPatterns = false; // Old behavior: custom keys disable defaults
    } else {
      // New format: options object
      secretKeys = optionsOrKeys?.secretKeys ?? DEFAULT_SECRET_KEYS;
      patterns = optionsOrKeys?.patterns ?? [];
      useDefaultPatterns = optionsOrKeys?.useDefaultPatterns ?? true;
    }

    // Field-based redaction (case-insensitive)
    this.secretKeys = secretKeys;
    this.secretKeysLower = secretKeys.map((k) => k.toLowerCase());

    // Pattern-based redaction
    this.patterns = [...(useDefaultPatterns ? DEFAULT_SECRET_PATTERNS : []), ...patterns];
  }

  process(event: LogEvent): LogEvent {
    const redacted = { ...event };

    // Redact top-level secret fields (case-insensitive)
    for (const key of Object.keys(redacted)) {
      if (this.isSecretKey(key)) {
        redacted[key] = "[REDACTED]";
      }
    }

    // Recursively redact nested objects
    this.redactNested(redacted);

    return redacted;
  }

  private isSecretKey(key: string): boolean {
    return this.secretKeysLower.includes(key.toLowerCase());
  }

  private redactNested(obj: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(obj)) {
      if (this.isSecretKey(key)) {
        obj[key] = "[REDACTED]";
      } else if (typeof value === "string") {
        // Apply pattern-based redaction to string values
        obj[key] = this.redactPatterns(value);
      } else if (value && typeof value === "object") {
        // Skip non-plain objects (Date, Buffer, Error, etc.)
        if (this.isPlainObject(value)) {
          if (Array.isArray(value)) {
            // Recursively redact array elements
            this.redactArray(value);
          } else {
            // Recursively redact object properties
            this.redactNested(value as Record<string, unknown>);
          }
        }
      }
    }
  }

  private redactArray(arr: unknown[]): void {
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (typeof item === "string") {
        // Apply pattern-based redaction to string values
        arr[i] = this.redactPatterns(item);
      } else if (item && typeof item === "object") {
        // Skip non-plain objects
        if (this.isPlainObject(item)) {
          if (Array.isArray(item)) {
            // Handle nested arrays
            this.redactArray(item);
          } else {
            // Handle objects within arrays
            this.redactNested(item as Record<string, unknown>);
          }
        }
      }
    }
  }

  /**
   * Apply regex patterns to redact secrets from string values
   * Skips strings larger than MAX_PATTERN_SCAN_SIZE for performance
   */
  private redactPatterns(value: string): string {
    // Skip large strings to avoid performance issues
    if (value.length > MAX_PATTERN_SCAN_SIZE) {
      return value;
    }

    let result = value;
    for (const pattern of this.patterns) {
      // Reset regex state for global patterns
      pattern.lastIndex = 0;
      result = result.replace(pattern, "[REDACTED]");
    }
    return result;
  }

  /**
   * Check if value is a plain object (not Date, Buffer, Error, etc.)
   */
  private isPlainObject(value: unknown): boolean {
    if (!value || typeof value !== "object") {
      return false;
    }

    // Skip built-in types that shouldn't be recursed
    if (
      value instanceof Date ||
      value instanceof Error ||
      value instanceof RegExp ||
      ArrayBuffer.isView(value) || // Covers Buffer, TypedArray, DataView
      value instanceof ArrayBuffer
    ) {
      return false;
    }

    // Arrays are handled separately
    if (Array.isArray(value)) {
      return true;
    }

    // Accept plain objects
    return true;
  }
}

/**
 * Add fields middleware - enriches log events with additional context
 */
export class AddFieldsMiddleware implements Middleware {
  constructor(private readonly fields: Record<string, unknown>) {}

  process(event: LogEvent): LogEvent {
    return {
      ...event,
      ...this.fields,
    };
  }
}

/**
 * Transform middleware - applies a transformation function to log events
 */
export class TransformMiddleware implements Middleware {
  constructor(private readonly transformer: (event: LogEvent) => LogEvent) {}

  process(event: LogEvent): LogEvent {
    return this.transformer(event);
  }
}
