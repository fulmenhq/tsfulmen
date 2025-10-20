/**
 * Schema validation module - implements Fulmen Schema Validation Standard
 *
 * Provides schema discovery, validation, and normalization utilities for Crucible schemas
 * with JSON Schema 2020-12 support and optional goneat integration.
 */

export const VERSION = '0.1.0';

// CLI exports
export { createCLI } from './cli.js';
// Error exports
export * from './errors.js';
// Goneat bridge exports (CLI-only, optional)
export {
  detectGoneat,
  isGoneatAvailable,
  runGoneatValidation,
} from './goneat-bridge.js';
// Normalizer exports
export { compareSchemas, normalizeSchema } from './normalizer.js';
// Registry exports
export {
  getSchema,
  getSchemaByPath,
  getSchemaRegistry,
  hasSchema,
  listSchemas,
  SchemaRegistry,
} from './registry.js';
// Core exports
export * from './types.js';
// Utility exports
export {
  countDiagnostics,
  createDiagnostic,
  formatDiagnostics,
  formatValidationResult,
  groupDiagnosticsBySeverity,
  isValidationError,
  normalizePointer,
} from './utils.js';
// Validator exports
export {
  clearCache,
  compileSchema,
  compileSchemaById,
  getCacheSize,
  validateData,
  validateDataBySchemaId,
  validateFile,
  validateFileBySchemaId,
  validateSchema,
} from './validator.js';
