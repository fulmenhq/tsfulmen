/**
 * Foundry module - Error handling
 *
 * Custom error classes for Foundry catalog operations with fail-fast validation.
 */

export class FoundryCatalogError extends Error {
  constructor(
    message: string,
    public readonly catalog?: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'FoundryCatalogError';

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FoundryCatalogError);
    }
  }

  static invalidSchema(catalog: string, details: string, cause?: Error): FoundryCatalogError {
    return new FoundryCatalogError(
      `Invalid schema in ${catalog} catalog: ${details}`,
      catalog,
      cause,
    );
  }

  static missingCatalog(catalog: string): FoundryCatalogError {
    return new FoundryCatalogError(`Catalog ${catalog} not found or could not be loaded`, catalog);
  }

  static invalidPattern(patternId: string, details: string): FoundryCatalogError {
    return new FoundryCatalogError(`Invalid pattern ${patternId}: ${details}`, 'patterns');
  }

  static compilationError(patternId: string, details: string, cause?: Error): FoundryCatalogError {
    return new FoundryCatalogError(
      `Failed to compile pattern ${patternId}: ${details}`,
      'patterns',
      cause,
    );
  }
}
