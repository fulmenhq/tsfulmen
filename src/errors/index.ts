/**
 * Errors module - structured error handling with telemetry
 *
 * Provides FulmenError data model and utilities for schema-backed error responses
 * with optional telemetry metadata (severity, correlation IDs, exit codes).
 */

export const VERSION = '0.2.0';

// Correlation ID utilities
export {
  generateCorrelationId,
  isCorrelationId,
  isValidCorrelationId,
  normalizeCorrelationId,
} from './correlation.js';
// Core error class and types
export {
  FulmenError,
  type FulmenErrorData,
  type FulmenErrorOptions,
  isFulmenError,
  isFulmenErrorData,
} from './fulmen-error.js';
// Serialization utilities
export {
  extractErrorMessage,
  extractStackTrace,
  serializeError,
} from './serialization.js';
// Severity utilities
export {
  compareSeverity,
  getDefaultSeverity,
  isSeverityLevel,
  isSeverityName,
  LEVEL_TO_SEVERITY,
  levelToSeverity,
  SEVERITY_LEVELS,
  Severity,
  type SeverityLevel,
  type SeverityName,
  severityToLevel,
} from './severity.js';
// Validation utilities
export {
  assertValidErrorData,
  formatValidationErrors,
  getValidationErrors,
  validateErrorData,
} from './validators.js';
