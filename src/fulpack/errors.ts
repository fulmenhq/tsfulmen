/**
 * Fulpack Error Handling
 *
 * Canonical error creation and management for fulpack operations.
 * Follows Foundry error schema patterns.
 */

import { Operation } from "./enums.js";
import type { FulpackError } from "./types.js";

/**
 * Create a canonical fulpack error
 */
export function createFulpackError(
  code: string,
  message: string,
  operation: Operation,
  context?: {
    path?: string;
    archive?: string;
    details?: Record<string, unknown>;
  },
): FulpackError {
  return {
    code,
    message,
    operation,
    ...(context?.path && { path: context.path }),
    ...(context?.archive && { archive: context.archive }),
    ...(context?.details && { details: context.details }),
  };
}

/**
 * Canonical error codes for fulpack operations
 */
export const ERROR_CODES = {
  // Validation Errors
  INVALID_ARCHIVE_FORMAT: "INVALID_ARCHIVE_FORMAT",
  INVALID_PATH: "INVALID_PATH",
  INVALID_OPTIONS: "INVALID_OPTIONS",

  // Security Errors
  PATH_TRAVERSAL: "PATH_TRAVERSAL",
  ABSOLUTE_PATH: "ABSOLUTE_PATH",
  SYMLINK_ESCAPE: "SYMLINK_ESCAPE",
  DECOMPRESSION_BOMB: "DECOMPRESSION_BOMB",
  CHECKSUM_MISMATCH: "CHECKSUM_MISMATCH",

  // Runtime Errors
  ARCHIVE_NOT_FOUND: "ARCHIVE_NOT_FOUND",
  ARCHIVE_CORRUPT: "ARCHIVE_CORRUPT",
  EXTRACTION_FAILED: "EXTRACTION_FAILED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  DISK_FULL: "DISK_FULL",
  SOURCE_NOT_FOUND: "SOURCE_NOT_FOUND",
} as const;

/**
 * Error class for fulpack operations
 */
export class FulpackOperationError extends Error {
  public readonly code: string;
  public readonly operation: Operation;
  public readonly path?: string;
  public readonly archive?: string;
  public readonly details?: Record<string, unknown>;

  constructor(error: FulpackError) {
    super(error.message);
    this.name = "FulpackOperationError";
    this.code = error.code;
    this.operation = error.operation;
    this.path = error.path;
    this.archive = error.archive;
    this.details = error.details;
  }

  /**
   * Convert back to canonical error format
   */
  toCanonical(): FulpackError {
    return {
      code: this.code,
      message: this.message,
      operation: this.operation,
      ...(this.path && { path: this.path }),
      ...(this.archive && { archive: this.archive }),
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Security validation utilities
 */

/**
 * Check for path traversal attempts
 */
export function hasPathTraversal(path: string): boolean {
  return path.includes("..") || path.includes("\\..");
}

/**
 * Check for absolute paths
 */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[a-zA-Z]:/.test(path);
}

/**
 * Normalize path and check for security issues
 */
export function validatePath(
  path: string,
  operation: Operation,
  allowAbsolute = false,
): FulpackError | null {
  if (!allowAbsolute && isAbsolutePath(path)) {
    return createFulpackError(
      ERROR_CODES.ABSOLUTE_PATH,
      `Absolute path not allowed: ${path}`,
      operation,
      { path },
    );
  }

  if (hasPathTraversal(path)) {
    return createFulpackError(
      ERROR_CODES.PATH_TRAVERSAL,
      `Path traversal detected: ${path}`,
      operation,
      { path },
    );
  }

  return null;
}

/**
 * Check for decompression bomb characteristics
 */
export function checkDecompressionBomb(
  uncompressedSize: number,
  compressedSize: number,
  maxSize: number,
  maxEntries: number,
  currentEntries: number,
): FulpackError | null {
  if (uncompressedSize > maxSize) {
    return createFulpackError(
      ERROR_CODES.DECOMPRESSION_BOMB,
      `Archive exceeds maximum size limit`,
      Operation.EXTRACT,
      {
        details: {
          actual_size: uncompressedSize,
          max_size: maxSize,
        },
      },
    );
  }

  if (currentEntries > maxEntries) {
    return createFulpackError(
      ERROR_CODES.DECOMPRESSION_BOMB,
      `Archive exceeds maximum entry limit`,
      Operation.EXTRACT,
      {
        details: {
          actual_size: currentEntries,
          max_size: maxEntries,
        },
      },
    );
  }

  // Check compression ratio (warn if >100:1)
  if (compressedSize > 0 && uncompressedSize / compressedSize > 100) {
    return createFulpackError(
      ERROR_CODES.DECOMPRESSION_BOMB,
      `Suspicious compression ratio detected`,
      Operation.EXTRACT,
      {
        details: {
          compression_ratio: uncompressedSize / compressedSize,
        },
      },
    );
  }

  return null;
}
