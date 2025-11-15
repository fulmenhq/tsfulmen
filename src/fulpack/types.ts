/**
 * Fulpack Types
 *
 * TypeScript interfaces generated from JSON schemas for type safety.
 * Based on schemas/library/fulpack/v1.0.0/ definitions.
 */

import type {
  ArchiveFormat,
  ChecksumAlgorithm,
  EntryType,
  Operation,
  OverwriteBehavior,
} from "./enums.js";

/**
 * Metadata for a single archive entry (returned by scan operation)
 * Schema: schemas/library/fulpack/v1.0.0/archive-entry.schema.json
 */
export interface ArchiveEntry {
  /** Normalized entry path within archive */
  path: string;
  /** Entry type from entry-types taxonomy */
  type: EntryType;
  /** Uncompressed size in bytes */
  size: number;
  /** Compressed size in bytes (if available) */
  compressed_size?: number;
  /** Modification timestamp (ISO 8601 format) */
  modified?: string;
  /** SHA-256 checksum (64 hex characters) */
  checksum?: string;
  /** Unix file permissions (octal string, e.g., '0644') */
  mode?: string;
  /** Target path if type is symlink, null otherwise */
  symlink_target?: string | null;
}

/**
 * Options for archive creation operation
 * Schema: schemas/library/fulpack/v1.0.0/create-options.schema.json
 */
export interface CreateOptions {
  /** Compression level (1=fastest, 9=best compression, format-dependent) */
  compression_level?: number;
  /** Glob patterns for files to include */
  include_patterns?: string[];
  /** Glob patterns for files to exclude */
  exclude_patterns?: string[];
  /** Checksum algorithm for entry verification */
  checksum_algorithm?: ChecksumAlgorithm;
  /** Preserve Unix file permissions in archive */
  preserve_permissions?: boolean;
  /** Follow symbolic links and archive their targets */
  follow_symlinks?: boolean;
}

/**
 * Options for archive extraction operation
 * Schema: schemas/library/fulpack/v1.0.0/extract-options.schema.json
 */
export interface ExtractOptions {
  /** Overwrite behavior for existing files */
  overwrite?: OverwriteBehavior;
  /** Verify checksums if present */
  verify_checksums?: boolean;
  /** Preserve Unix file permissions */
  preserve_permissions?: boolean;
  /** Glob patterns for files to include */
  include_patterns?: string[];
  /** Maximum entry size for bomb protection (bytes) */
  max_size?: number;
  /** Maximum number of entries for bomb protection */
  max_entries?: number;
}

/**
 * Options for archive scan operation
 * Schema: schemas/library/fulpack/v1.0.0/scan-options.schema.json
 */
export interface ScanOptions {
  /** Include entry metadata in results */
  include_metadata?: boolean;
  /** Filter by entry types */
  entry_types?: EntryType[];
  /** Maximum scan depth (null = unlimited) */
  max_depth?: number | null;
  /** Maximum number of entries to scan */
  max_entries?: number;
}

/**
 * Result from archive extraction operation
 * Schema: schemas/library/fulpack/v1.0.0/extract-result.schema.json
 */
export interface ExtractResult {
  /** Number of entries successfully extracted */
  extracted_count: number;
  /** Number of entries skipped */
  skipped_count: number;
  /** Number of entries that failed to extract */
  error_count: number;
  /** Array of extraction errors */
  errors: FulpackError[];
  /** Array of extraction warnings */
  warnings: string[];
}

/**
 * Archive metadata information
 * Schema: schemas/library/fulpack/v1.0.0/archive-info.schema.json
 */
export interface ArchiveInfo {
  /** Detected archive format */
  format: ArchiveFormat;
  /** Compression algorithm used */
  compression: string;
  /** Total number of entries */
  entry_count: number;
  /** Total uncompressed size */
  total_size: number;
  /** Archive file size (compressed) */
  compressed_size: number;
  /** Compression ratio (total_size / compressed_size) */
  compression_ratio: number;
  /** Whether archive contains checksums */
  has_checksums: boolean;
  /** Checksum algorithm used (if has_checksums) */
  checksum_algorithm?: ChecksumAlgorithm;
  /** Archive creation timestamp (if available) */
  created?: string;
}

/**
 * Archive validation result
 * Schema: schemas/library/fulpack/v1.0.0/validation-result.schema.json
 */
export interface ValidationResult {
  /** Whether archive passed all validation checks */
  valid: boolean;
  /** Array of validation errors */
  errors: FulpackError[];
  /** Array of validation warnings */
  warnings: string[];
  /** Number of entries validated */
  entry_count: number;
  /** Number of checksums verified */
  checksums_verified: number;
  /** List of checks performed */
  checks_performed: string[];
}

/**
 * Canonical fulpack error envelope
 * Compatible with Foundry error schemas
 */
export interface FulpackError {
  /** Canonical error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Entry path that caused error (if applicable) */
  path?: string;
  /** Archive file path */
  archive?: string;
  /** Source file path (for create operations) */
  source?: string;
  /** Operation name */
  operation: Operation;
  /** Optional error context */
  details?: {
    entry_index?: number;
    compression_ratio?: number;
    actual_size?: number;
    max_size?: number;
    [key: string]: unknown;
  };
}

/**
 * Archive manifest for tracking multiple archives
 * Schema: schemas/library/fulpack/v1.0.0/archive-manifest.schema.json
 */
export interface ArchiveManifest {
  /** Manifest version */
  version: string;
  /** Archive entries in manifest */
  archives: {
    /** Archive file path */
    path: string;
    /** Archive format */
    format: ArchiveFormat;
    /** Archive checksum */
    checksum: string;
    /** Archive size */
    size: number;
    /** Creation timestamp */
    created: string;
  }[];
  /** Manifest metadata */
  metadata?: {
    [key: string]: unknown;
  };
}
