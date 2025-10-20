/**
 * Schema validation errors - implements Fulmen Schema Validation Standard
 */

import type { SchemaSource, SchemaValidationDiagnostic } from './types.js';

/**
 * Base error class for schema validation operations
 */
export class SchemaValidationError extends Error {
  constructor(
    message: string,
    public schemaId?: string,
    public diagnostics: SchemaValidationDiagnostic[] = [],
    public source?: SchemaSource,
    public cause?: Error,
  ) {
    super(message);
    this.name = 'SchemaValidationError';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SchemaValidationError);
    }
  }

  /**
   * Create error for schema not found
   */
  static schemaNotFound(schemaId: string): SchemaValidationError {
    return new SchemaValidationError(`Schema not found: ${schemaId}`, schemaId);
  }

  /**
   * Create error for invalid schema input
   */
  static invalidSchemaInput(source: SchemaSource, details: string): SchemaValidationError {
    return new SchemaValidationError(`Invalid schema input: ${details}`, undefined, [], source);
  }

  /**
   * Create error for validation failure
   */
  static validationFailed(
    schemaId: string,
    diagnostics: SchemaValidationDiagnostic[],
    source?: SchemaSource,
  ): SchemaValidationError {
    const errorCount = diagnostics.filter((d) => d.severity === 'ERROR').length;
    const warningCount = diagnostics.filter((d) => d.severity === 'WARN').length;

    const message = `Schema validation failed: ${errorCount} error(s), ${warningCount} warning(s)`;

    return new SchemaValidationError(message, schemaId, diagnostics, source);
  }

  /**
   * Create error for goneat binary not found
   */
  static goneatNotFound(goneatPath?: string): SchemaValidationError {
    const pathInfo = goneatPath ? ` at ${goneatPath}` : '';
    return new SchemaValidationError(
      `Goneat binary not found${pathInfo}. Falling back to AJV validation.`,
    );
  }

  /**
   * Create error for goneat execution failure
   */
  static goneatExecutionFailed(error: Error): SchemaValidationError {
    return new SchemaValidationError(
      'Goneat execution failed. Falling back to AJV validation.',
      undefined,
      [],
      undefined,
      error,
    );
  }

  /**
   * Create error for empty schema input
   */
  static emptySchemaInput(source?: SchemaSource): SchemaValidationError {
    return new SchemaValidationError('Schema content is empty', undefined, [], source);
  }

  /**
   * Create error for parse failure
   */
  static parseFailed(source: SchemaSource, error: Error): SchemaValidationError {
    return new SchemaValidationError(
      `Failed to parse schema: ${error.message}`,
      undefined,
      [],
      source,
      error,
    );
  }

  /**
   * Create error for encoding failure
   */
  static encodingFailed(source: SchemaSource, error: Error): SchemaValidationError {
    return new SchemaValidationError(
      `Failed to encode schema: ${error.message}`,
      undefined,
      [],
      source,
      error,
    );
  }

  /**
   * Create error for registry operation failure
   */
  static registryError(operation: string, details: string): SchemaValidationError {
    return new SchemaValidationError(`Schema registry ${operation} failed: ${details}`);
  }

  /**
   * Format error for display
   */
  format(): string {
    let output = this.message;

    if (this.schemaId) {
      output += `\nSchema ID: ${this.schemaId}`;
    }

    if (this.diagnostics.length > 0) {
      output += '\n\nValidation Issues:';
      this.diagnostics.forEach((diag, index) => {
        output += `\n  ${index + 1}. [${diag.severity}] ${diag.message}`;
        if (diag.pointer) {
          output += ` at ${diag.pointer}`;
        }
        if (diag.keyword) {
          output += ` (keyword: ${diag.keyword})`;
        }
        if (diag.source) {
          output += ` [${diag.source}]`;
        }
      });
    }

    if (this.source) {
      output += `\n\nSource: ${this.source.type}`;
      if (this.source.id) {
        output += ` (${this.source.id})`;
      }
    }

    return output;
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): {
    name: string;
    message: string;
    schemaId?: string;
    diagnostics: SchemaValidationDiagnostic[];
    source?: SchemaSource;
    cause?: string;
  } {
    return {
      name: this.name,
      message: this.message,
      schemaId: this.schemaId,
      diagnostics: this.diagnostics,
      source: this.source,
      cause: this.cause?.message,
    };
  }
}
