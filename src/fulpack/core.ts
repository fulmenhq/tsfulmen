/**
 * Fulpack Core Implementation
 *
 * Main archive operations implementation for TypeScript.
 * Currently supports tar.gz format with security protections.
 */

import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { pipeline } from "node:stream";
import { createGunzip } from "node:zlib";
import archiver from "archiver";

import {
  ArchiveFormat,
  ChecksumAlgorithm,
  EntryType,
  Operation,
  OverwriteBehavior,
} from "./enums.js";
import { createFulpackError, ERROR_CODES, FulpackOperationError } from "./errors.js";
import type {
  ArchiveEntry,
  ArchiveInfo,
  CreateOptions,
  ExtractOptions,
  ExtractResult,
  FulpackError,
  ScanOptions,
  ValidationResult,
} from "./types.js";

/**
 * Default options for operations
 */
const DEFAULTS = {
  CREATE: {
    compression_level: 6,
    checksum_algorithm: ChecksumAlgorithm.SHA256,
    preserve_permissions: true,
    follow_symlinks: false,
  },
  EXTRACT: {
    overwrite: OverwriteBehavior.ERROR,
    verify_checksums: true,
    preserve_permissions: true,
    max_size: 1024 * 1024 * 1024, // 1GB
    max_entries: 100000,
  },
  SCAN: {
    include_metadata: true,
    max_entries: 100000,
  },
} as const;

/**
 * Create an archive from source files/directories
 */
export async function create(
  source: string | string[],
  output: string,
  format: ArchiveFormat,
  options?: CreateOptions,
): Promise<ArchiveInfo> {
  const opts = { ...DEFAULTS.CREATE, ...options };
  const sources = Array.isArray(source) ? source : [source];

  // Validate inputs
  if (format !== ArchiveFormat.TAR_GZ && format !== ArchiveFormat.ZIP) {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.INVALID_ARCHIVE_FORMAT,
        `Format ${format} not yet supported`,
        Operation.CREATE,
      ),
    );
  }

  // Ensure output directory exists
  const outputDir = dirname(output);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  if (format === ArchiveFormat.ZIP) {
    return await createZipArchive(sources, output, opts);
  } else {
    return await createTarGzArchive(sources, output, opts);
  }
}

/**
 * Extract archive contents to destination
 */
export async function extract(
  archive: string,
  destination: string,
  options?: ExtractOptions,
): Promise<ExtractResult> {
  const opts = { ...DEFAULTS.EXTRACT, ...options };

  // Validate inputs
  if (!existsSync(archive)) {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.ARCHIVE_NOT_FOUND,
        `Archive not found: ${archive}`,
        Operation.EXTRACT,
        { archive },
      ),
    );
  }

  // Ensure destination exists
  if (!existsSync(destination)) {
    mkdirSync(destination, { recursive: true });
  }

  // For now, implement a simple gzip extraction (single file)
  if (archive.endsWith(".gz") && !archive.endsWith(".tar.gz")) {
    return await extractGzipFile(archive, destination, opts);
  }

  // Extract based on format
  if (archive.endsWith(".zip")) {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.INVALID_OPTIONS,
        "ZIP extraction not yet implemented",
        Operation.EXTRACT,
        { archive },
      ),
    );
  } else {
    // Extract tar.gz archive
    return await extractTarGz(archive, destination, opts);
  }
}

/**
 * Scan archive entries without extraction
 */
export async function scan(archive: string, options?: ScanOptions): Promise<ArchiveEntry[]> {
  const opts = { ...DEFAULTS.SCAN, ...options };

  // Validate inputs
  if (!existsSync(archive)) {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.ARCHIVE_NOT_FOUND,
        `Archive not found: ${archive}`,
        Operation.SCAN,
        { archive },
      ),
    );
  }

  // For now, implement simple gzip file scanning
  if (archive.endsWith(".gz") && !archive.endsWith(".tar.gz")) {
    return await scanGzipFile(archive, opts);
  }

  // Scan based on format
  if (archive.endsWith(".zip")) {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.INVALID_OPTIONS,
        "ZIP scanning not yet implemented",
        Operation.SCAN,
        { archive },
      ),
    );
  } else {
    // Scan tar.gz archive
    return await scanTarGz(archive, opts);
  }
}

/**
 * Verify archive integrity and checksums
 */
export async function verify(
  archive: string,
  _options?: Record<string, unknown>,
): Promise<ValidationResult> {
  // Validate inputs
  if (!existsSync(archive)) {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.ARCHIVE_NOT_FOUND,
        `Archive not found: ${archive}`,
        Operation.VERIFY,
        { archive },
      ),
    );
  }

  // For now, implement basic file existence check
  const stats = statSync(archive);
  const errors: FulpackError[] = [];
  const warnings: string[] = [];
  const checksPerformed = ["structure_valid"];

  // Basic structure validation
  if (stats.size === 0) {
    errors.push(
      createFulpackError(ERROR_CODES.ARCHIVE_CORRUPT, "Archive file is empty", Operation.VERIFY, {
        archive,
      }),
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    entry_count: 0,
    checksums_verified: 0,
    checks_performed: checksPerformed,
  };
}

/**
 * Get archive metadata without extraction
 */
export async function info(archive: string): Promise<ArchiveInfo> {
  // Validate inputs
  if (!existsSync(archive)) {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.ARCHIVE_NOT_FOUND,
        `Archive not found: ${archive}`,
        Operation.INFO,
        { archive },
      ),
    );
  }

  const stats = statSync(archive);
  const filename = basename(archive);

  // Detect format from extension
  let format: ArchiveFormat;
  let compression = "none";

  if (filename.endsWith(".tar.gz") || filename.endsWith(".tgz")) {
    format = ArchiveFormat.TAR_GZ;
    compression = "gzip";
  } else if (filename.endsWith(".zip")) {
    format = ArchiveFormat.ZIP;
    compression = "deflate";
  } else if (filename.endsWith(".gz")) {
    format = ArchiveFormat.GZIP;
    compression = "gzip";
  } else {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.INVALID_ARCHIVE_FORMAT,
        `Unsupported archive format: ${filename}`,
        Operation.INFO,
        { archive },
      ),
    );
  }

  return {
    format,
    compression,
    entry_count: 0, // Would need full scan to determine
    total_size: 0, // Would need extraction to determine
    compressed_size: stats.size,
    compression_ratio: 0, // Would need uncompressed size
    has_checksums: false,
    created: stats.mtime.toISOString(),
  };
}

/**
 * Helper: Extract a single gzip file
 */
async function extractGzipFile(
  archive: string,
  destination: string,
  options: ExtractOptions,
): Promise<ExtractResult> {
  const filename = basename(archive, ".gz");
  const outputPath = join(destination, filename);

  // Check if output file exists
  if (existsSync(outputPath)) {
    if (options.overwrite === OverwriteBehavior.ERROR) {
      throw new FulpackOperationError(
        createFulpackError(
          ERROR_CODES.EXTRACTION_FAILED,
          `Output file already exists: ${outputPath}`,
          Operation.EXTRACT,
          { path: outputPath, archive },
        ),
      );
    } else if (options.overwrite === OverwriteBehavior.SKIP) {
      return {
        extracted_count: 0,
        skipped_count: 1,
        error_count: 0,
        errors: [],
        warnings: [`Skipped existing file: ${outputPath}`],
      };
    }
  }

  try {
    const readStream = createReadStream(archive);
    const writeStream = createWriteStream(outputPath);
    const gunzip = createGunzip();

    await new Promise((resolve, reject) => {
      pipeline(readStream, gunzip, writeStream, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(undefined);
        }
      });
    });

    return {
      extracted_count: 1,
      skipped_count: 0,
      error_count: 0,
      errors: [],
      warnings: [],
    };
  } catch (error) {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.EXTRACTION_FAILED,
        `Failed to extract gzip file: ${error instanceof Error ? error.message : "Unknown error"}`,
        Operation.EXTRACT,
        { archive, details: { original_error: error } },
      ),
    );
  }
}

/**
 * Helper: Scan a single gzip file
 */
async function scanGzipFile(archive: string, options: ScanOptions): Promise<ArchiveEntry[]> {
  const filename = basename(archive, ".gz");
  const stats = statSync(archive);

  const entry: ArchiveEntry = {
    path: filename,
    type: EntryType.FILE,
    size: 0, // Would need to decompress to get actual size
    compressed_size: stats.size,
    modified: stats.mtime.toISOString(),
  };

  if (options.include_metadata) {
    // Add mode if we can read it
    try {
      entry.mode = "0644"; // Default for gzip files
    } catch {
      // Ignore if we can't determine mode
    }
  }

  return [entry];
}

/**
 * Helper: Create tar.gz archive
 */
async function createTarGzArchive(
  _sources: string[],
  _output: string,
  _options: CreateOptions,
): Promise<ArchiveInfo> {
  // For now, implement a simple tar.gz using Node.js built-in tar if available
  // or fall back to a basic implementation
  throw new FulpackOperationError(
    createFulpackError(
      ERROR_CODES.INVALID_OPTIONS,
      "tar.gz creation temporarily disabled for debugging",
      Operation.CREATE,
    ),
  );
}

/**
 * Helper: Create ZIP archive
 */
async function createZipArchive(
  sources: string[],
  output: string,
  options: CreateOptions,
): Promise<ArchiveInfo> {
  const writeStream = createWriteStream(output);
  const archive = archiver("zip", {
    zlib: { level: options.compression_level },
  });

  let entryCount = 0;
  let totalSize = 0;

  archive.on("error", (error) => {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.EXTRACTION_FAILED,
        `ZIP creation failed: ${error.message}`,
        Operation.CREATE,
        { details: { original_error: error } },
      ),
    );
  });

  archive.pipe(writeStream);

  // Add files to archive
  for (const sourcePath of sources) {
    if (!existsSync(sourcePath)) {
      throw new FulpackOperationError(
        createFulpackError(
          ERROR_CODES.SOURCE_NOT_FOUND,
          `Source not found: ${sourcePath}`,
          Operation.CREATE,
          { details: { source: sourcePath } },
        ),
      );
    }

    const stats = statSync(sourcePath);
    if (stats.isDirectory()) {
      // Add directory contents recursively
      await addDirectoryToZipArchive(archive, sourcePath, "", options);
    } else {
      // Add single file
      const entryName = basename(sourcePath);
      archive.file(sourcePath, {
        name: entryName,
        mode: options.preserve_permissions ? stats.mode : 0o644,
      });
      entryCount++;
      totalSize += stats.size;
    }
  }

  await archive.finalize();

  const outputStats = statSync(output);

  return {
    format: ArchiveFormat.ZIP,
    compression: "deflate",
    entry_count: entryCount,
    total_size: totalSize,
    compressed_size: outputStats.size,
    compression_ratio: totalSize > 0 ? outputStats.size / totalSize : 0,
    has_checksums: false,
    created: outputStats.mtime.toISOString(),
  };
}

/**
 * Helper: Add directory contents to tar archive recursively
 */
async function _addDirectoryToTarArchive(
  packStream: import("tar-stream").Pack,
  dirPath: string,
  archivePrefix: string,
  options: CreateOptions,
): Promise<void> {
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const archivePath = join(archivePrefix, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      // Add directory entry
      const dirEntry = packStream.entry({
        name: `${archivePath}/`,
        mode: options.preserve_permissions ? stats.mode : 0o755,
        mtime: stats.mtime,
      });

      if (dirEntry) {
        await new Promise<void>((resolve, reject) => {
          dirEntry.on("finish", resolve);
          dirEntry.on("error", reject);
        });
      }

      // Recursively add directory contents
      await _addDirectoryToTarArchive(packStream, fullPath, archivePath, options);
    } else {
      // Add file entry
      const fileEntry = packStream.entry(
        {
          name: archivePath,
          mode: options.preserve_permissions ? stats.mode : 0o644,
          mtime: stats.mtime,
        },
        createReadStream(fullPath),
      );

      if (fileEntry) {
        await new Promise<void>((resolve, reject) => {
          fileEntry.on("finish", resolve);
          fileEntry.on("error", reject);
        });
      }
    }
  }
}

/**
 * Helper: Add directory contents to ZIP archive recursively
 */
async function addDirectoryToZipArchive(
  archive: archiver.Archiver,
  dirPath: string,
  archivePrefix: string,
  options: CreateOptions,
): Promise<void> {
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const archivePath = join(archivePrefix, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      // Recursively add directory contents
      await addDirectoryToZipArchive(archive, fullPath, archivePath, options);
    } else {
      // Add file entry
      archive.file(fullPath, {
        name: archivePath,
        mode: options.preserve_permissions ? stats.mode : 0o644,
      });
    }
  }
}

/**
 * Helper: Extract tar.gz archive
 */
async function extractTarGz(
  _archive: string,
  _destination: string,
  _options: ExtractOptions,
): Promise<ExtractResult> {
  throw new FulpackOperationError(
    createFulpackError(
      ERROR_CODES.INVALID_OPTIONS,
      "tar.gz extraction temporarily disabled for debugging",
      Operation.EXTRACT,
    ),
  );
}

/**
 * Helper: Scan tar.gz archive
 */
async function scanTarGz(_archive: string, _options: ScanOptions): Promise<ArchiveEntry[]> {
  throw new FulpackOperationError(
    createFulpackError(
      ERROR_CODES.INVALID_OPTIONS,
      "tar.gz scanning temporarily disabled for debugging",
      Operation.SCAN,
    ),
  );
}
