/**
 * Schema validation types - implements Fulmen Schema Validation Standard
 */

/**
 * Schema format types
 */
export type SchemaFormat = 'json' | 'yaml';

/**
 * Schema metadata structure
 */
export interface SchemaMetadata {
  /** Logical identifier (e.g., 'observability/logging/v1.0.0/logger-config') */
  id: string;
  /** Absolute file path */
  path: string;
  /** Relative path from schemas directory */
  relativePath: string;
  /** Schema format (json/yaml) */
  format: SchemaFormat;
  /** Schema version from $schema or filename */
  version?: string;
  /** Description from schema title or $id */
  description?: string;
  /** JSON Schema draft version */
  schemaDraft?: string;
}

/**
 * Schema validation diagnostic
 */
export interface SchemaValidationDiagnostic {
  /** JSON Pointer to the offending location */
  pointer: string;
  /** Human-readable description */
  message: string;
  /** JSON Schema keyword triggering the error */
  keyword: string;
  /** Error severity */
  severity: 'ERROR' | 'WARN';
  /** Validation source (ajv or goneat) */
  source: 'ajv' | 'goneat';
  /** Additional context data */
  data?: unknown;
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation diagnostics (empty if valid) */
  diagnostics: SchemaValidationDiagnostic[];
  /** Normalized schema used for validation */
  schema?: unknown;
  /** Source of validation (ajv or goneat) */
  source: 'ajv' | 'goneat';
}

/**
 * Schema comparison result
 */
export interface SchemaComparisonResult {
  /** Whether schemas are semantically equal */
  equal: boolean;
  /** Normalized version of first schema */
  normalizedA: string;
  /** Normalized version of second schema */
  normalizedB: string;
}

/**
 * Schema normalization options
 */
export interface SchemaNormalizationOptions {
  /** Emit compact (minified) JSON instead of pretty-printed */
  compact?: boolean;
  /** Custom key ordering function */
  keySorter?: (a: string, b: string) => number;
  /** Whether to strip YAML comments */
  stripComments?: boolean;
}

/**
 * Schema validation options
 */
export interface SchemaValidationOptions {
  /** Base directory override for schema lookup */
  baseDir?: string;
  /** Custom schema resolver function */
  customResolver?: (id: string) => Promise<unknown> | unknown;
  /** Path to goneat binary */
  goneatPath?: string;
  /** Enable schema normalization */
  enableNormalization?: boolean;
  /** Opt-in to goneat validation (default: false) */
  useGoneat?: boolean;
  /** AJV validator cache size */
  cacheSize?: number;
  /** Additional custom formats to register */
  formats?: string[];
  /** Whether to include warnings in diagnostics */
  includeWarnings?: boolean;
}

/**
 * Schema registry options
 */
export interface SchemaRegistryOptions {
  /** Base directory for schema discovery (defaults to schemas/crucible-ts) */
  baseDir?: string;
  /** File patterns to include (defaults to ['*.schema.json', '*.schema.yaml']) */
  patterns?: string[];
  /** Whether to follow symbolic links */
  followSymlinks?: boolean;
  /** Maximum depth for directory traversal */
  maxDepth?: number;
}

/**
 * Schema input types
 */
export type SchemaInput = string | Buffer | Record<string, unknown>;

/**
 * Schema source information
 */
export interface SchemaSource {
  /** Source type */
  type: 'file' | 'string' | 'object';
  /** Source identifier for error reporting */
  id?: string;
  /** Raw source content (for error context) */
  content?: string;
}

/**
 * AJV error object structure
 */
export interface AjvError {
  instancePath?: string;
  schemaPath?: string;
  keyword?: string;
  params?: Record<string, unknown>;
  message?: string;
}

/**
 * Compiled validator function (AJV) with errors property
 */
export interface CompiledValidator {
  (data: unknown): boolean;
  errors?: AjvError[] | null;
}

/**
 * CLI options
 */
export interface CLIOptions {
  /** Enable colorized output */
  color?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Custom schema base directory */
  baseDir?: string;
}
