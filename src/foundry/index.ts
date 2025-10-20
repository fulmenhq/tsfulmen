/**
 * Foundry module - Main exports
 *
 * Provides ergonomic access to Crucible Foundry Pattern Catalog data including
 * patterns, HTTP status codes, MIME types, and country codes with Bun-first
 * implementation and comprehensive TypeScript support.
 */

export const VERSION = '0.1.1';

// Country Code catalog exports
export {
  clearCountryCodeCache,
  getCountryByAlpha2,
  getCountryByAlpha3,
  getCountryByNumeric,
  listCountries,
} from './country-codes.js';
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
// MIME Type catalog exports
export {
  clearMimeTypeCache,
  detectMimeType,
  getMimeType,
  getMimeTypeByExtension,
  isSupportedMimeType,
  listMimeTypes,
} from './mime-types.js';
// Pattern catalog exports
export {
  clearPatternCache,
  describePattern,
  getPattern,
  getPatternRegex,
  listPatterns,
  matchPattern,
} from './patterns.js';
