/**
 * Schema validation for FulmenError data
 *
 * Provides singleton validator that pre-compiles error-response schema
 * using existing src/schema infrastructure. Performance target: <1ms per validation.
 */

import { compileSchemaById } from "../schema/index.js";
import type { CompiledValidator } from "../schema/types.js";

/**
 * Singleton validator for FulmenError data
 *
 * Pre-compiles the error-response schema at first access for optimal performance.
 * Reuses existing AJV setup from src/schema module.
 */
class ErrorValidator {
  private static instance: ErrorValidator;
  private validateFn: CompiledValidator | null = null;
  private initPromise: Promise<void> | null = null;
  private initError: Error | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ErrorValidator {
    if (!ErrorValidator.instance) {
      ErrorValidator.instance = new ErrorValidator();
    }
    return ErrorValidator.instance;
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
        // Ensure dependency schemas are registered before compiling error-response
        // Error handling schema references pathfinder error-response relatively.
        await compileSchemaById("pathfinder/v1.0.0/error-response");
        await compileSchemaById("assessment/v1.0.0/severity-definitions");

        // Compile schema using existing schema infrastructure
        // Schema ID for error-response extends pathfinder error-response
        this.validateFn = await compileSchemaById("error-handling/v1.0.0/error-response");
      } catch (err) {
        this.initError = err instanceof Error ? err : new Error(String(err));
        throw new Error(`Failed to initialize error validator: ${this.initError.message}`);
      }
    })();

    return this.initPromise;
  }

  /**
   * Validate error data against schema
   *
   * @param data - Data to validate
   * @returns Promise resolving to true if valid, false otherwise
   * @throws {Error} If validator failed to initialize
   */
  async validate(data: unknown): Promise<boolean> {
    if (this.validateFn === null) {
      await this.init();
    }

    if (this.initError) {
      throw this.initError;
    }

    if (!this.validateFn) {
      throw new Error("Validator not initialized");
    }

    return this.validateFn(data);
  }

  /**
   * Get validation errors from last validation
   *
   * @returns Validation errors or null
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
    ErrorValidator.instance = new ErrorValidator();
  }
}

/**
 * Validate FulmenError data against error-response schema
 *
 * Uses pre-compiled validator singleton for optimal performance (<1ms target).
 *
 * @param data - Error data to validate
 * @returns Promise resolving to true if valid, false otherwise
 *
 * @example
 * ```typescript
 * const data = {
 *   code: 'CONFIG_INVALID',
 *   message: 'Configuration validation failed'
 * };
 *
 * if (await validateErrorData(data)) {
 *   // Data is schema-compliant
 * } else {
 *   const errors = await getValidationErrors();
 *   console.error('Validation failed:', errors);
 * }
 * ```
 */
export async function validateErrorData(data: unknown): Promise<boolean> {
  return ErrorValidator.getInstance().validate(data);
}

/**
 * Get validation errors from last validation
 *
 * @returns Validation errors or null
 *
 * @example
 * ```typescript
 * if (!(await validateErrorData(data))) {
 *   const errors = getValidationErrors();
 *   errors?.forEach(err => {
 *     console.error(`${err.instancePath}: ${err.message}`);
 *   });
 * }
 * ```
 */
export function getValidationErrors() {
  return ErrorValidator.getInstance().getErrors();
}

/**
 * Format validation errors as human-readable string
 *
 * @param errors - Validation error objects
 * @returns Formatted error message
 *
 * @example
 * ```typescript
 * const errors = getValidationErrors();
 * if (errors) {
 *   throw new Error(formatValidationErrors(errors));
 * }
 * ```
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
 * Validate and throw if invalid
 *
 * @param data - Error data to validate
 * @throws {Error} If validation fails
 *
 * @example
 * ```typescript
 * await assertValidErrorData(data); // Throws if invalid
 * // Safe to use data here
 * ```
 */
export async function assertValidErrorData(data: unknown): Promise<void> {
  if (!(await validateErrorData(data))) {
    const errors = getValidationErrors();
    const message = errors ? formatValidationErrors(errors) : "Error data validation failed";
    throw new Error(`Invalid error data: ${message}`);
  }
}

// Export for testing
export { ErrorValidator };
