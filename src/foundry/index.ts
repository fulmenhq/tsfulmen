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
// HTTP Status catalog exports
export {
  clearHttpStatusCache,
  getHttpStatus,
  getStatusReason,
  isClientError,
  isInformational,
  isRedirection,
  isServerError,
  isSuccess,
  listHttpStatuses,
} from './http-statuses.js';
// Export loader functions
export {
  loadAllCatalogs,
  loadCountryCodeCatalog,
  loadHttpStatusCatalog,
  loadMimeTypeCatalog,
  loadPatternCatalog,
} from './loader.js';
// Pattern catalog exports
export {
  clearPatternCache,
  describePattern,
  getPattern,
  getPatternRegex,
  listPatterns,
  matchPattern,
} from './patterns.js';

// Future exports (to be implemented in subsequent phases):
// export * from './mime-types.js';
// export * from './country-codes.js';
