/**
 * Middleware implementations for log processing pipeline
 */

import type { LogEvent, Middleware } from "./types.js";

/**
 * Redact secrets middleware - removes sensitive data from log events
 */
export class RedactSecretsMiddleware implements Middleware {
  private readonly secretKeys: string[];

  constructor(secretKeys?: string[]) {
    this.secretKeys = secretKeys ?? [
      "password",
      "apiKey",
      "api_key",
      "token",
      "secret",
      "authorization",
      "auth",
      "accessToken",
      "access_token",
      "refreshToken",
      "refresh_token",
    ];
  }

  process(event: LogEvent): LogEvent {
    const redacted = { ...event };

    // Redact top-level secret fields
    for (const key of this.secretKeys) {
      if (key in redacted) {
        redacted[key] = "[REDACTED]";
      }
    }

    // Recursively redact nested objects
    this.redactNested(redacted);

    return redacted;
  }

  private redactNested(obj: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(obj)) {
      if (this.secretKeys.includes(key)) {
        obj[key] = "[REDACTED]";
      } else if (value && typeof value === "object") {
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

  private redactArray(arr: unknown[]): void {
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (item && typeof item === "object") {
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
