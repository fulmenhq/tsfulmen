/**
 * Metrics event validators
 *
 * Schema validation for metrics events using existing src/schema infrastructure
 */

import { compileSchemaById } from "../schema/index.js";
import type { CompiledValidator } from "../schema/types.js";

/**
 * Singleton validator for metrics events
 *
 * Pre-compiles the metrics-event schema at first access for optimal performance.
 * Reuses existing AJV setup from src/schema module.
 */
class MetricsValidator {
  private static instance: MetricsValidator;
  private validateFn: CompiledValidator | null = null;
  private initPromise: Promise<void> | null = null;
  private initError: Error | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MetricsValidator {
    if (!MetricsValidator.instance) {
      MetricsValidator.instance = new MetricsValidator();
    }
    return MetricsValidator.instance;
  }

  /**
   * Initialize validator (lazy load, async)
   */
  private async init(): Promise<void> {
    if (this.validateFn !== null || this.initError !== null) {
      return; // Already initialized
    }

    if (this.initPromise) {
      return this.initPromise; // Already initializing
    }

    this.initPromise = (async () => {
      try {
        // Compile schema using existing schema infrastructure
        this.validateFn = await compileSchemaById("observability/metrics/v1.0.0/metrics-event");
      } catch (err) {
        this.initError = err instanceof Error ? err : new Error(String(err));
        throw new Error(`Failed to initialize metrics validator: ${this.initError.message}`);
      }
    })();

    return this.initPromise;
  }

  /**
   * Validate metrics event against schema
   *
   * @param event - Metrics event to validate
   * @returns Promise resolving to true if valid, false otherwise
   */
  async validate(event: unknown): Promise<boolean> {
    if (this.validateFn === null) {
      await this.init();
    }

    if (this.initError) {
      throw this.initError;
    }

    if (!this.validateFn) {
      throw new Error("Validator not initialized");
    }

    return this.validateFn(event);
  }

  /**
   * Get validation errors from last validation
   */
  getErrors() {
    if (!this.validateFn) {
      return null;
    }
    return this.validateFn.errors;
  }

  /**
   * Reset validator state (for testing)
   * @internal
   */
  static _reset(): void {
    MetricsValidator.instance = new MetricsValidator();
  }
}

/**
 * Validate metrics event against schema
 *
 * Uses pre-compiled validator singleton for optimal performance.
 *
 * @param event - Metrics event to validate
 * @returns Promise resolving to true if valid
 *
 * @example
 * ```typescript
 * const event: MetricsEvent = {
 *   timestamp: new Date().toISOString(),
 *   name: 'schema_validations',
 *   value: 42
 * };
 *
 * if (await validateMetricsEvent(event)) {
 *   // Event is schema-compliant
 * } else {
 *   const errors = getValidationErrors();
 *   console.error('Validation failed:', errors);
 * }
 * ```
 */
export async function validateMetricsEvent(event: unknown): Promise<boolean> {
  return MetricsValidator.getInstance().validate(event);
}

/**
 * Validate array of metrics events
 *
 * @param events - Array of metrics events
 * @returns Promise resolving to true if all valid
 */
export async function validateMetricsEvents(events: unknown[]): Promise<boolean> {
  for (const event of events) {
    if (!(await validateMetricsEvent(event))) {
      return false;
    }
  }
  return true;
}

/**
 * Get validation errors from last validation
 */
export function getValidationErrors() {
  return MetricsValidator.getInstance().getErrors();
}

/**
 * Format validation errors as human-readable string
 */
export function formatValidationErrors(
  errors: Array<{ instancePath?: string; message?: string }>,
): string {
  return errors
    .map((err) => {
      const path = err.instancePath || "(root)";
      const message = err.message || "validation failed";
      return `${path}: ${message}`;
    })
    .join("; ");
}

/**
 * Assert that metrics event is valid (throws if not)
 *
 * @param event - Metrics event to validate
 * @throws {Error} If validation fails
 */
export async function assertValidMetricsEvent(event: unknown): Promise<void> {
  if (!(await validateMetricsEvent(event))) {
    const errors = getValidationErrors();
    const message = errors ? formatValidationErrors(errors) : "Metrics event validation failed";
    throw new Error(`Invalid metrics event: ${message}`);
  }
}

// Export for testing
export { MetricsValidator };
