/**
 * Pathfinder types - Core type definitions for filesystem traversal
 *
 * Implements types aligned with Crucible schemas:
 * - schemas/crucible-ts/pathfinder/v1.0.0/finder-config.schema.json
 * - schemas/crucible-ts/pathfinder/v1.0.0/path-result.schema.json
 * - schemas/crucible-ts/pathfinder/v1.0.0/metadata.schema.json
 */

/**
 * Enforcement levels for path constraints
 *
 * Controls how path constraint violations are handled during traversal.
 */
export enum EnforcementLevel {
  /** Reject constraint violations */
  STRICT = "strict",

  /** Log violations but continue */
  WARN = "warn",

  /** Disable constraint enforcement */
  PERMISSIVE = "permissive",
}

/**
 * Supported constraint types (repository/workspace/cloud)
 */
export enum ConstraintType {
  REPOSITORY = "repository",
  WORKSPACE = "workspace",
  CLOUD = "cloud",
}

/**
 * Supported loader implementations for discovery operations
 */
export enum LoaderType {
  LOCAL = "local",
  REMOTE = "remote",
  CLOUD = "cloud",
}

/**
 * Supported checksum algorithms for FulHash integration
 */
export enum ChecksumAlgorithm {
  XXH3_128 = "xxh3-128",
  SHA256 = "sha256",
}

/**
 * Supported checksum encodings for serialized results
 */
export enum ChecksumEncoding {
  HEX = "hex",
}

/**
 * Path constraint specification (mirrors Crucible schema)
 *
 * Encapsulates repository/workspace boundaries and enforcement behaviour.
 */
export interface PathConstraint {
  /** Root path for the constraint scope */
  root?: string;

  /** Constraint classification (repository/workspace/cloud) */
  type: ConstraintType;

  /** Enforcement behaviour for path violations */
  enforcementLevel: EnforcementLevel;
}

/**
 * Pathfinder configuration options (Crucible-aligned)
 *
 * Aligns with schemas/crucible-ts/pathfinder/v1.0.0/finder-config.schema.json.
 */
export interface PathfinderConfig {
  /** Maximum number of worker routines for traversal */
  maxWorkers?: number;

  /** Enable filesystem metadata/result caching */
  cacheEnabled?: boolean;

  /** Cache time-to-live (seconds) */
  cacheTTL?: number;

  /** Path constraint applied to traversal */
  constraint?: PathConstraint;

  /** Default loader used to resolve paths */
  loaderType?: LoaderType;

  /** Calculate file checksums */
  calculateChecksums?: boolean;

  /** Hash algorithm used for checksum calculation */
  checksumAlgorithm?: ChecksumAlgorithm;

  /** Encoding format for serialized checksums */
  checksumEncoding?: ChecksumEncoding;

  /** Honor .fulmenignore files during traversal */
  honorIgnoreFiles?: boolean;
}

/**
 * Pathfinder discovery query (Crucible-aligned)
 *
 * Matches schemas/crucible-ts/pathfinder/v1.0.0/find-query.schema.json.
 */
export interface PathfinderQuery {
  /** Root directory for traversal (required) */
  root: string;

  /** Glob include patterns (defaults to matching all files) */
  include?: string[];

  /** Glob exclude patterns */
  exclude?: string[];

  /** Maximum traversal depth (0 = unlimited) */
  maxDepth?: number;

  /** Follow symbolic links during traversal */
  followSymlinks?: boolean;

  /** Include hidden files and directories (dot-prefixed) */
  includeHidden?: boolean;

  /** Honor .fulmenignore files during traversal */
  honorIgnoreFiles?: boolean;
}

/**
 * File metadata returned by pathfinder
 *
 * Includes size, modification time, and optional checksum information.
 */
export interface FileMetadata {
  /** File size in bytes */
  size?: number;

  /** Last modification timestamp (ISO 8601) */
  modified?: string;

  /** File permissions (e.g., rwxr-xr-x or 0755) */
  permissions?: string;

  /** MIME type of the file */
  mimeType?: string;

  /** Character encoding if applicable */
  encoding?: string;

  /** FulHash output formatted as algorithm:hex */
  checksum?: string;

  /** Algorithm used for the checksum */
  checksumAlgorithm?: ChecksumAlgorithm;

  /** Error message when checksum calculation fails */
  checksumError?: string;

  /** User-defined tags associated with the result */
  tags?: string[];

  /** Custom metadata bag for provider-specific data */
  custom?: Record<string, unknown>;

  /** Whether result represents a symbolic link */
  isSymlink?: boolean;

  /** Target path for symbolic links */
  symlinkTarget?: string;

  /** Allow additional provider-specific properties */
  [key: string]: unknown;
}

/**
 * Path result returned by finder operations
 *
 * Represents a single discovered file with its metadata.
 */
export interface PathResult {
  /** Path relative to traversal root */
  relativePath: string;

  /** Absolute path to the discovered file */
  sourcePath: string;

  /** Logical path presented to downstream consumers */
  logicalPath?: string;

  /** Loader type that produced the result */
  loaderType: LoaderType;

  /** Provider metadata attached to the result */
  metadata?: FileMetadata;
}

/**
 * Progress callback for long-running operations
 *
 * Called for each discovered file during traversal.
 * Can be async to allow for processing or throttling.
 */
export type ProgressCallback = (result: PathResult) => void | Promise<void>;

/**
 * Error handler callback
 *
 * Called when non-fatal errors occur during traversal.
 * Allows custom error handling without stopping the entire operation.
 */
export type ErrorCallback = (error: Error, path: string) => void | Promise<void>;

/**
 * Result handler callback (fires for each result)
 *
 * Alternative to collecting all results in memory.
 * Process results as they're discovered.
 */
export type ResultCallback = (result: PathResult) => void | Promise<void>;

/**
 * Execution callbacks for finder operations
 *
 * Allows callers to subscribe to progress, per-result, and recoverable errors.
 */
export interface PathfinderExecuteOptions {
  /** Invoked for each discovered result */
  resultCallback?: ResultCallback;

  /** Invoked for each discovered result (alias for resultCallback) */
  progressCallback?: ProgressCallback;

  /** Invoked when recoverable errors occur during traversal */
  errorCallback?: ErrorCallback;
}

/**
 * Options for repository root discovery
 *
 * Controls behavior of findRepositoryRoot() operation including
 * boundaries, max depth, symlink handling, and path constraints.
 *
 * Aligned with Crucible v0.2.15 pathfinder extension spec.
 */
export interface FindRepoOptions {
  /**
   * Maximum depth to search upward
   *
   * Defaults to 10. Prevents excessive traversal up the directory tree.
   */
  maxDepth?: number;

  /**
   * Boundary ceiling for upward search
   *
   * Stops traversal when reaching this directory.
   * Defaults to user home directory if not specified.
   * Always stops at filesystem root/drive/UNC regardless.
   */
  boundary?: string;

  /**
   * Stop at first marker match
   *
   * If true, returns immediately upon finding any marker.
   * If false, continues to find deepest marker (closest to filesystem root).
   * Defaults to true.
   */
  stopAtFirst?: boolean;

  /**
   * Path constraint for upper boundary enforcement
   *
   * If provided, prevents discovery outside this constraint.
   * Returns REPOSITORY_NOT_FOUND if constraint prevents marker hit.
   */
  constraint?: PathConstraint;

  /**
   * Follow symbolic links during traversal
   *
   * Defaults to false (security). If enabled, tracks visited
   * real paths to detect loops.
   */
  followSymlinks?: boolean;
}

/**
 * Helper to create FindRepoOptions with maxDepth
 *
 * @param maxDepth - Maximum depth to search upward
 * @returns FindRepoOptions with maxDepth set
 */
export function withMaxDepth(maxDepth: number): FindRepoOptions {
  return { maxDepth };
}

/**
 * Helper to create FindRepoOptions with boundary
 *
 * @param boundary - Boundary ceiling directory
 * @returns FindRepoOptions with boundary set
 */
export function withBoundary(boundary: string): FindRepoOptions {
  return { boundary };
}

/**
 * Helper to create FindRepoOptions with stopAtFirst
 *
 * @param stopAtFirst - Whether to stop at first marker
 * @returns FindRepoOptions with stopAtFirst set
 */
export function withStopAtFirst(stopAtFirst: boolean): FindRepoOptions {
  return { stopAtFirst };
}

/**
 * Helper to create FindRepoOptions with constraint
 *
 * @param constraint - Path constraint for upper boundary
 * @returns FindRepoOptions with constraint set
 */
export function withConstraint(constraint: PathConstraint): FindRepoOptions {
  return { constraint };
}

/**
 * Helper to create FindRepoOptions with followSymlinks
 *
 * @param followSymlinks - Whether to follow symbolic links
 * @returns FindRepoOptions with followSymlinks set
 */
export function withFollowSymlinks(followSymlinks: boolean): FindRepoOptions {
  return { followSymlinks };
}
