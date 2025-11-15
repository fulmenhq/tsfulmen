/**
 * Fulpack Enums
 *
 * Generated from taxonomy YAML files for cross-language consistency.
 * Do not edit manually - regenerate from taxonomy when updated.
 */

/**
 * Archive formats supported by fulpack
 * Generated from: schemas/taxonomy/library/fulpack/archive-formats/v1.0.0/formats.yaml
 */
export enum ArchiveFormat {
  /** POSIX tar archive with gzip compression */
  TAR_GZ = "tar.gz",
  /** ZIP archive with deflate compression */
  ZIP = "zip",
  /** GZIP compressed single file */
  GZIP = "gzip",
}

/**
 * Archive entry types
 * Generated from: schemas/taxonomy/library/fulpack/entry-types/v1.0.0/types.yaml
 */
export enum EntryType {
  /** Regular file with data */
  FILE = "file",
  /** Directory/folder entry */
  DIRECTORY = "directory",
  /** Symbolic link (requires security validation) */
  SYMLINK = "symlink",
}

/**
 * Archive operations
 * Generated from: schemas/taxonomy/library/fulpack/operations/v1.0.0/operations.yaml
 */
export enum Operation {
  /** Create archive from source files/directories */
  CREATE = "create",
  /** Extract archive contents to destination */
  EXTRACT = "extract",
  /** List archive entries (for Pathfinder integration) */
  SCAN = "scan",
  /** Validate archive integrity and checksums */
  VERIFY = "verify",
  /** Get archive metadata without extraction */
  INFO = "info",
}

/**
 * Checksum algorithms supported for archive verification
 */
export enum ChecksumAlgorithm {
  SHA256 = "sha256",
  SHA512 = "sha512",
  SHA1 = "sha1",
  MD5 = "md5",
}

/**
 * File overwrite behavior during extraction
 */
export enum OverwriteBehavior {
  /** Error on overwrite conflicts (default) */
  ERROR = "error",
  /** Skip existing files */
  SKIP = "skip",
  /** Overwrite existing files */
  OVERWRITE = "overwrite",
}
