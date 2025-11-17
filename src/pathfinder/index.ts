/**
 * Pathfinder - Enterprise filesystem traversal with checksums and observability
 *
 * Provides filesystem discovery with pattern matching, ignore files, optional checksums,
 * and comprehensive observability through structured errors and telemetry.
 *
 * @example Basic usage
 * ```typescript
 * import { Pathfinder } from '@fulmenhq/tsfulmen/pathfinder';
 *
 * const finder = new Pathfinder();
 *
 * const results = await finder.find({
 *   root: './src',
 *   include: ['*.ts'],
 *   followSymlinks: false,
 * });
 * ```
 *
 * @example Convenience helpers
 * ```typescript
 * import { findConfigFiles, findSchemaFiles } from '@fulmenhq/tsfulmen/pathfinder';
 *
 * const configs = await findConfigFiles('./config');
 * const schemas = await findSchemaFiles('./schemas');
 * ```
 *
 * @module pathfinder
 */

export const VERSION = "0.1.0";

// Checksum helpers
export { calculateChecksum, calculateChecksumsBatch } from "./checksum.js";
// Constants
export {
  DEFAULT_CONFIG,
  DEFAULT_IGNORE_FILES,
  DEFAULT_MAX_DEPTH,
  GitMarkers,
  GoModMarkers,
  MAX_PATH_LENGTH,
  MonorepoMarkers,
  NodeMarkers,
  PATH_SEPARATOR,
  PythonMarkers,
} from "./constants.js";
// Convenience helpers
export { findByExtensions, findConfigFiles, findSchemaFiles } from "./convenience.js";
// Error types
export {
  createPathfinderError,
  PathfinderErrorCode,
  wrapPathfinderError,
} from "./errors.js";
export type { PathfinderOptions } from "./finder.js";
// Core exports
export { Pathfinder } from "./finder.js";
// Repository root discovery
export { findRepositoryRoot } from "./repoRoot.js";
// Types
export type {
  ErrorCallback,
  FileMetadata,
  FindRepoOptions,
  PathfinderConfig,
  PathfinderExecuteOptions,
  PathfinderQuery,
  PathResult,
  ProgressCallback,
  ResultCallback,
} from "./types.js";
export {
  ChecksumAlgorithm,
  ChecksumEncoding,
  ConstraintType,
  EnforcementLevel,
  LoaderType,
  withBoundary,
  withConstraint,
  withFollowSymlinks,
  withMaxDepth,
  withStopAtFirst,
} from "./types.js";
// Validators
export {
  assertValidConfig,
  assertValidPathResult,
  compileConfigSchema,
  compilePathResultSchema,
  validateConfig,
  validatePathResult,
} from "./validators.js";
