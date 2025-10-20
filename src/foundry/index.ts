/**
 * Foundry module - Main exports
 *
 * Provides ergonomic access to Crucible Foundry Pattern Catalog data including
 * patterns, HTTP status codes, MIME types, and country codes with Bun-first
 * implementation and comprehensive TypeScript support.
 */

export const VERSION = '0.1.1';

// Export error classes
export { FoundryCatalogError } from './errors.js';
// Export loader functions
export {
  loadAllCatalogs,
  loadCountryCodeCatalog,
  loadHttpStatusCatalog,
  loadMimeTypeCatalog,
  loadPatternCatalog,
} from './loader.js';
// Export types
export type {
  Country,
  CountryCatalog,
  DetectionOptions,
  FileInput,
  HttpStatusCatalog,
  HttpStatusCode,
  HttpStatusGroup,
  HttpStatusGroupId,
  LanguageFlags,
  MimeType,
  MimeTypeCatalog,
  Pattern,
  PatternCatalog,
  PatternFlags,
  PatternKind,
  StreamInput,
} from './types.js';

// Future exports (to be implemented in subsequent phases):
// export * from './patterns.js';
// export * from './http-statuses.js';
// export * from './mime-types.js';
// export * from './country-codes.js';
