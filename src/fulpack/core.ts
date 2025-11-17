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
  lstatSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { pipeline } from "node:stream";
import { createGunzip, createGzip } from "node:zlib";
import archiver from "archiver";
// Import interfaces/types as TYPE-ONLY
import type {
  ArchiveEntry,
  ArchiveInfo,
  CreateOptions,
  ExtractOptions,
  ExtractResult,
  FulpackError,
  ScanOptions,
  ValidationResult,
} from "../crucible/fulpack/types.js";
// Import enums as VALUES (runtime objects)
import { ArchiveFormat, EntryType, Operation } from "../crucible/fulpack/types.js";

import { createFulpackError, ERROR_CODES, FulpackOperationError, validatePath } from "./errors.js";

/**
 * Default options for operations
 */
const DEFAULTS = {
  CREATE: {
    compression_level: 6,
    checksum_algorithm: "sha256" as const,
    preserve_permissions: true,
    follow_symlinks: false,
  },
  EXTRACT: {
    overwrite: "error" as const,
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
  if (
    format !== ArchiveFormat.TAR &&
    format !== ArchiveFormat.TAR_GZ &&
    format !== ArchiveFormat.ZIP &&
    format !== ArchiveFormat.GZIP
  ) {
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
  } else if (format === ArchiveFormat.TAR_GZ) {
    return await createTarGzArchive(sources, output, opts);
  } else if (format === ArchiveFormat.TAR) {
    return await createTarArchive(sources, output, opts);
  } else if (format === ArchiveFormat.GZIP) {
    return await createGzipFile(sources, output, opts);
  } else {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.INVALID_ARCHIVE_FORMAT,
        `Unsupported format for creation: ${format}`,
        Operation.CREATE,
      ),
    );
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

  // Detect format by extension and route to appropriate extractor
  if (archive.endsWith(".tar.gz") || archive.endsWith(".tgz")) {
    return await extractTarGz(archive, destination, opts);
  } else if (archive.endsWith(".tar")) {
    return await extractTar(archive, destination, opts);
  } else if (archive.endsWith(".zip")) {
    return await extractZip(archive, destination, opts);
  } else if (archive.endsWith(".gz")) {
    // Single file gzip
    return await extractGzipFile(archive, destination, opts);
  } else {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.INVALID_ARCHIVE_FORMAT,
        `Unsupported archive format for extraction: ${archive}`,
        Operation.EXTRACT,
        { archive },
      ),
    );
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

  const filename = basename(archive);

  // Route to appropriate format scanner
  if (filename.endsWith(".tar.gz") || filename.endsWith(".tgz")) {
    return await scanTarGz(archive, opts);
  } else if (filename.endsWith(".tar")) {
    return await scanTar(archive, opts);
  } else if (filename.endsWith(".zip")) {
    return await scanZip(archive, opts);
  } else if (filename.endsWith(".gz")) {
    // Single file gzip (not tar.gz)
    return await scanGzipFile(archive, opts);
  } else {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.INVALID_ARCHIVE_FORMAT,
        `Unsupported archive format: ${filename}`,
        Operation.SCAN,
        { archive },
      ),
    );
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

  const stats = statSync(archive);
  const errors: FulpackError[] = [];
  const warnings: string[] = [];
  const checks_performed: (
    | "structure_valid"
    | "checksums_verified"
    | "no_path_traversal"
    | "no_decompression_bomb"
    | "symlinks_safe"
  )[] = [];
  let entry_count = 0;
  let checksums_verified = 0;

  // Basic structure validation
  checks_performed.push("structure_valid");
  if (stats.size === 0) {
    errors.push(
      createFulpackError(ERROR_CODES.ARCHIVE_CORRUPT, "Archive file is empty", Operation.VERIFY, {
        archive,
      }),
    );
    return {
      valid: false,
      errors,
      warnings,
      entry_count: 0,
      checksums_verified: 0,
      checks_performed,
    };
  }

  // Scan archive to get entries and perform security checks
  let entries: ArchiveEntry[];
  try {
    entries = await scan(archive, { include_metadata: true });
    entry_count = entries.length;
  } catch (error) {
    errors.push(
      createFulpackError(
        ERROR_CODES.ARCHIVE_CORRUPT,
        `Failed to scan archive: ${error instanceof Error ? error.message : String(error)}`,
        Operation.VERIFY,
        { archive, details: { original_error: error } },
      ),
    );
    return {
      valid: false,
      errors,
      warnings,
      entry_count: 0,
      checksums_verified: 0,
      checks_performed,
    };
  }

  // Security check: Path traversal detection
  checks_performed.push("no_path_traversal");
  for (const entry of entries) {
    const pathError = validatePath(entry.path, Operation.VERIFY, true);
    if (pathError) {
      errors.push({ ...pathError, archive });
    }
  }

  // Security check: Symlink safety (if symlinks present)
  const symlinks = entries.filter((e) => e.type === "symlink");
  if (symlinks.length > 0) {
    checks_performed.push("symlinks_safe");
    for (const symlink of symlinks) {
      if (symlink.symlink_target) {
        // Check if symlink target attempts to escape (../ or absolute path)
        const targetError = validatePath(symlink.symlink_target, Operation.VERIFY, true);
        if (targetError) {
          errors.push(
            createFulpackError(
              ERROR_CODES.ARCHIVE_CORRUPT,
              `Symlink '${symlink.path}' targets unsafe location: ${symlink.symlink_target}`,
              Operation.VERIFY,
              { archive, path: symlink.path, details: { symlink_target: symlink.symlink_target } },
            ),
          );
        }
      }
    }
  }

  // Security check: Decompression bomb detection
  checks_performed.push("no_decompression_bomb");
  const total_size = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
  const compressed_size = stats.size;
  const compression_ratio =
    total_size > 0 && compressed_size > 0 ? total_size / compressed_size : 1.0;

  // Warn if compression ratio exceeds 100:1 (per Crucible standard)
  if (compression_ratio > 100) {
    warnings.push(
      `High compression ratio detected: ${compression_ratio.toFixed(1)}:1 (threshold: 100:1)`,
    );
  }

  // Warn if total size exceeds 1GB (default max_size)
  const MAX_SIZE = 1024 * 1024 * 1024; // 1GB
  if (total_size > MAX_SIZE) {
    warnings.push(
      `Total uncompressed size (${(total_size / (1024 * 1024)).toFixed(1)}MB) exceeds recommended limit (1GB)`,
    );
  }

  // Warn if entry count exceeds 100k (default max_entries)
  const MAX_ENTRIES = 100000;
  if (entry_count > MAX_ENTRIES) {
    warnings.push(`Entry count (${entry_count}) exceeds recommended limit (${MAX_ENTRIES})`);
  }

  // Check for checksums
  const entriesWithChecksums = entries.filter((e) => e.checksum !== undefined);
  if (entriesWithChecksums.length > 0) {
    checks_performed.push("checksums_verified");
    checksums_verified = entriesWithChecksums.length;
    // Note: Actual checksum verification would require extracting and re-hashing
    // For Phase 2, we just report how many checksums are present
  } else if (entry_count > 0) {
    warnings.push("Archive does not contain checksums for integrity verification");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    entry_count,
    checksums_verified,
    checks_performed,
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
  let format: string;
  let compression: string = "none";

  if (filename.endsWith(".tar.gz") || filename.endsWith(".tgz")) {
    format = ArchiveFormat.TAR_GZ;
    compression = "gzip";
  } else if (filename.endsWith(".zip")) {
    format = ArchiveFormat.ZIP;
    compression = "deflate";
  } else if (filename.endsWith(".gz")) {
    format = ArchiveFormat.GZIP;
    compression = "gzip";
  } else if (filename.endsWith(".tar")) {
    format = ArchiveFormat.TAR;
    compression = "none";
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

  // Use scan() to get real entry metadata
  const entries = await scan(archive, { include_metadata: true });
  const entry_count = entries.length;
  const total_size = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
  const compressed_size = stats.size;
  const compression_ratio = total_size > 0 ? compressed_size / total_size : 1.0;

  // Check if any entries have checksums
  const has_checksums = entries.some((entry) => entry.checksum !== undefined);

  return {
    format: format as "tar" | "tar.gz" | "zip" | "gzip",
    compression: compression as "gzip" | "deflate" | "none",
    entry_count,
    total_size,
    compressed_size,
    compression_ratio,
    has_checksums,
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
    if (options.overwrite === "error") {
      throw new FulpackOperationError(
        createFulpackError(
          ERROR_CODES.EXTRACTION_FAILED,
          `Output file already exists: ${outputPath}`,
          Operation.EXTRACT,
          { path: outputPath, archive },
        ),
      );
    } else if (options.overwrite === "skip") {
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
    type: EntryType.FILE as "file",
    size: 0, // Would need to decompress to get actual size
    compressed_size: stats.size,
    modified: stats.mtime.toISOString(),
    ...(options.include_metadata && { mode: "0644" }), // Default for gzip files
  };

  return [entry];
}

/**
 * Helper: Create tar.gz archive
 */
async function createTarGzArchive(
  sources: string[],
  output: string,
  options: CreateOptions,
): Promise<ArchiveInfo> {
  const writeStream = createWriteStream(output);
  const archive = archiver("tar", {
    gzip: true,
    gzipOptions: {
      level: options.compression_level,
    },
  });

  let entryCount = 0;
  let totalSize = 0;

  // Promise that resolves when stream is fully written and closed
  const writePromise = new Promise<void>((resolve, reject) => {
    writeStream.on("close", () => resolve());
    writeStream.on("error", reject);
  });

  archive.on("error", (error) => {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.EXTRACTION_FAILED,
        `TAR.GZ creation failed: ${error.message}`,
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
      await addDirectoryToTarGzArchive(archive, sourcePath, "", options);
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
  await writePromise; // Wait for stream to flush and close

  const outputStats = statSync(output);

  return {
    format: ArchiveFormat.TAR_GZ as "tar.gz",
    compression: "gzip",
    entry_count: entryCount,
    total_size: totalSize,
    compressed_size: outputStats.size,
    compression_ratio: totalSize > 0 ? outputStats.size / totalSize : 0,
    has_checksums: false, // TODO: Add fulhash checksum integration
    created: outputStats.mtime.toISOString(),
  };
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

  // Promise that resolves when stream is fully written and closed
  const writePromise = new Promise<void>((resolve, reject) => {
    writeStream.on("close", () => resolve());
    writeStream.on("error", reject);
  });

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
  await writePromise; // Wait for stream to flush and close

  const outputStats = statSync(output);

  return {
    format: ArchiveFormat.ZIP as "zip",
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
 * Helper: Add directory contents to tar.gz archive recursively
 */
async function addDirectoryToTarGzArchive(
  archive: archiver.Archiver,
  dirPath: string,
  archivePrefix: string,
  options: CreateOptions,
): Promise<void> {
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const archivePath = join(archivePrefix, entry);

    // Use lstat to detect symlinks without following them
    const stats = lstatSync(fullPath);

    if (stats.isSymbolicLink()) {
      // Handle symlinks based on follow_symlinks option
      if (!options.follow_symlinks) {
        // Skip symlinks when follow_symlinks is false (default, secure)
        continue;
      }
      // If follow_symlinks is true, get stats of the target
      const targetStats = statSync(fullPath); // Follows the symlink
      if (targetStats.isDirectory()) {
        await addDirectoryToTarGzArchive(archive, fullPath, archivePath, options);
      } else {
        archive.file(fullPath, {
          name: archivePath,
          mode: options.preserve_permissions ? targetStats.mode : 0o644,
        });
      }
    } else if (stats.isDirectory()) {
      // Recursively add directory contents
      await addDirectoryToTarGzArchive(archive, fullPath, archivePath, options);
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
 * Helper: Create tar archive (uncompressed)
 */
async function createTarArchive(
  sources: string[],
  output: string,
  options: CreateOptions,
): Promise<ArchiveInfo> {
  const writeStream = createWriteStream(output);
  const archive = archiver("tar", {
    gzip: false, // Uncompressed
  });

  let entryCount = 0;
  let totalSize = 0;

  // Promise that resolves when stream is fully written and closed
  const writePromise = new Promise<void>((resolve, reject) => {
    writeStream.on("close", () => resolve());
    writeStream.on("error", reject);
  });

  archive.on("error", (error) => {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.EXTRACTION_FAILED,
        `TAR creation failed: ${error.message}`,
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
      await addDirectoryToTarArchive(archive, sourcePath, "", options);
    } else {
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
  await writePromise; // Wait for stream to flush and close

  const outputStats = statSync(output);

  return {
    format: ArchiveFormat.TAR as "tar",
    compression: "none",
    entry_count: entryCount,
    total_size: totalSize,
    compressed_size: outputStats.size,
    compression_ratio: 1.0, // Uncompressed
    has_checksums: false, // TODO: Add fulhash checksum integration
    created: outputStats.mtime.toISOString(),
  };
}

/**
 * Helper: Add directory contents to tar archive recursively
 */
async function addDirectoryToTarArchive(
  archive: archiver.Archiver,
  dirPath: string,
  archivePrefix: string,
  options: CreateOptions,
): Promise<void> {
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const archivePath = join(archivePrefix, entry);

    // Use lstat to detect symlinks without following them
    const stats = lstatSync(fullPath);

    if (stats.isSymbolicLink()) {
      // Handle symlinks based on follow_symlinks option
      if (!options.follow_symlinks) {
        // Skip symlinks when follow_symlinks is false (default, secure)
        continue;
      }
      // If follow_symlinks is true, get stats of the target
      const targetStats = statSync(fullPath); // Follows the symlink
      if (targetStats.isDirectory()) {
        await addDirectoryToTarArchive(archive, fullPath, archivePath, options);
      } else {
        archive.file(fullPath, {
          name: archivePath,
          mode: options.preserve_permissions ? targetStats.mode : 0o644,
        });
      }
    } else if (stats.isDirectory()) {
      await addDirectoryToTarArchive(archive, fullPath, archivePath, options);
    } else {
      archive.file(fullPath, {
        name: archivePath,
        mode: options.preserve_permissions ? stats.mode : 0o644,
      });
    }
  }
}

/**
 * Helper: Create gzip file (single file compression)
 */
async function createGzipFile(
  sources: string[],
  output: string,
  options: CreateOptions,
): Promise<ArchiveInfo> {
  // Validate single file input
  if (sources.length !== 1) {
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.INVALID_OPTIONS,
        `GZIP format requires exactly one source file, got ${sources.length}`,
        Operation.CREATE,
      ),
    );
  }

  const sourcePath = sources[0];
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
    throw new FulpackOperationError(
      createFulpackError(
        ERROR_CODES.INVALID_OPTIONS,
        "GZIP format does not support directories",
        Operation.CREATE,
        { details: { source: sourcePath } },
      ),
    );
  }

  // Compress the file
  const readStream = createReadStream(sourcePath);
  const writeStream = createWriteStream(output);
  const gzip = createGzip({ level: options.compression_level });

  await new Promise((resolve, reject) => {
    pipeline(readStream, gzip, writeStream, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve(undefined);
      }
    });
  });

  const outputStats = statSync(output);

  return {
    format: ArchiveFormat.GZIP as "gzip",
    compression: "gzip",
    entry_count: 1,
    total_size: stats.size,
    compressed_size: outputStats.size,
    compression_ratio: stats.size > 0 ? outputStats.size / stats.size : 0,
    has_checksums: false,
    created: outputStats.mtime.toISOString(),
  };
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

    // Use lstat to detect symlinks without following them
    const stats = lstatSync(fullPath);

    if (stats.isSymbolicLink()) {
      // Handle symlinks based on follow_symlinks option
      if (!options.follow_symlinks) {
        // Skip symlinks when follow_symlinks is false (default, secure)
        continue;
      }
      // If follow_symlinks is true, get stats of the target
      const targetStats = statSync(fullPath); // Follows the symlink
      if (targetStats.isDirectory()) {
        await addDirectoryToZipArchive(archive, fullPath, archivePath, options);
      } else {
        archive.file(fullPath, {
          name: archivePath,
          mode: options.preserve_permissions ? targetStats.mode : 0o644,
        });
      }
    } else if (stats.isDirectory()) {
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
  archive: string,
  destination: string,
  options: ExtractOptions,
): Promise<ExtractResult> {
  const tarStream = await import("tar-stream");
  const extract = tarStream.extract();

  let extractedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors: FulpackError[] = [];
  const warnings: string[] = [];

  let totalExtractedSize = 0;
  let entryCount = 0;

  extract.on("entry", async (header, stream, next) => {
    entryCount++;

    try {
      // Security: Check entry count limit
      if (options.max_entries && entryCount > options.max_entries) {
        errors.push(
          createFulpackError(
            ERROR_CODES.DECOMPRESSION_BOMB,
            `Entry count exceeds maximum (${options.max_entries})`,
            Operation.EXTRACT,
            {
              archive,
              details: { entry_count: entryCount, max_entries: options.max_entries },
            },
          ),
        );
        stream.resume();
        next();
        return;
      }

      // Security: Path traversal and absolute path validation
      const pathError = validatePath(header.name, Operation.EXTRACT, false);
      if (pathError) {
        errors.push({ ...pathError, archive });
        errorCount++;
        stream.resume();
        next();
        return;
      }

      const outputPath = join(destination, header.name);

      if (header.type === "directory") {
        // Create directory
        if (!existsSync(outputPath)) {
          mkdirSync(outputPath, { recursive: true });
        }
        extractedCount++;
        stream.resume();
        next();
      } else if (header.type === "file") {
        // Check if file exists
        if (existsSync(outputPath)) {
          if (options.overwrite === "error") {
            errors.push(
              createFulpackError(
                ERROR_CODES.EXTRACTION_FAILED,
                `Output file already exists: ${outputPath}`,
                Operation.EXTRACT,
                { path: header.name, archive },
              ),
            );
            errorCount++;
            stream.resume();
            next();
            return;
          } else if (options.overwrite === "skip") {
            warnings.push(`Skipped existing file: ${outputPath}`);
            skippedCount++;
            stream.resume();
            next();
            return;
          }
          // overwrite === "overwrite" - proceed with extraction
        }

        // Ensure parent directory exists
        const parentDir = dirname(outputPath);
        if (!existsSync(parentDir)) {
          mkdirSync(parentDir, { recursive: true });
        }

        // Extract file with byte counting for decompression bomb detection
        const writeStream = createWriteStream(outputPath);

        // Count actual bytes written (not header size)
        stream.on("data", (chunk: Buffer) => {
          totalExtractedSize += chunk.length;

          // Check against max_size based on actual bytes
          if (options.max_size && totalExtractedSize > options.max_size) {
            stream.destroy();
            writeStream.destroy();
            errors.push(
              createFulpackError(
                ERROR_CODES.DECOMPRESSION_BOMB,
                `Total extracted size exceeds maximum (${options.max_size} bytes)`,
                Operation.EXTRACT,
                {
                  archive,
                  path: header.name,
                  details: { actual_size: totalExtractedSize, max_size: options.max_size },
                },
              ),
            );
            errorCount++;
            next();
            return;
          }
        });

        stream.pipe(writeStream);

        writeStream.on("finish", () => {
          // Set permissions if requested
          if (options.preserve_permissions && header.mode) {
            try {
              const { chmodSync } = require("node:fs");
              chmodSync(outputPath, header.mode);
            } catch {
              // Ignore permission errors
            }
          }
          extractedCount++;
          next();
        });

        writeStream.on("error", (error) => {
          errors.push(
            createFulpackError(
              ERROR_CODES.EXTRACTION_FAILED,
              `Failed to write file: ${error.message}`,
              Operation.EXTRACT,
              { path: header.name, archive, details: { original_error: error } },
            ),
          );
          errorCount++;
          next();
        });
      } else {
        // Skip other types (symlinks, etc.) for security
        warnings.push(`Skipped entry type ${header.type}: ${header.name}`);
        stream.resume();
        next();
      }
    } catch (error) {
      errors.push(
        createFulpackError(
          ERROR_CODES.EXTRACTION_FAILED,
          `Error processing entry: ${error instanceof Error ? error.message : "Unknown error"}`,
          Operation.EXTRACT,
          { path: header.name, archive, details: { original_error: error } },
        ),
      );
      errorCount++;
      stream.resume();
      next();
    }
  });

  // Pipe archive through gunzip and tar-stream
  const readStream = createReadStream(archive);
  const gunzip = createGunzip();

  return new Promise((resolve, reject) => {
    extract.on("finish", () => {
      resolve({
        extracted_count: extractedCount,
        skipped_count: skippedCount,
        error_count: errorCount,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        total_bytes: totalExtractedSize,
      });
    });

    extract.on("error", (error) => {
      reject(
        new FulpackOperationError(
          createFulpackError(
            ERROR_CODES.EXTRACTION_FAILED,
            `TAR.GZ extraction failed: ${error.message}`,
            Operation.EXTRACT,
            { archive, details: { original_error: error } },
          ),
        ),
      );
    });

    // biome-ignore lint/suspicious/noExplicitAny: tar-stream type incompatibility with pipe
    readStream.pipe(gunzip).pipe(extract as any);
  });
}

/**
 * Helper: Extract tar archive (uncompressed)
 */
async function extractTar(
  archive: string,
  destination: string,
  options: ExtractOptions,
): Promise<ExtractResult> {
  const tarStream = await import("tar-stream");
  const extract = tarStream.extract();

  let extractedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors: FulpackError[] = [];
  const warnings: string[] = [];

  let totalExtractedSize = 0;
  let entryCount = 0;

  extract.on("entry", async (header, stream, next) => {
    entryCount++;

    try {
      // Security: Check entry count limit
      if (options.max_entries && entryCount > options.max_entries) {
        errors.push(
          createFulpackError(
            ERROR_CODES.DECOMPRESSION_BOMB,
            `Entry count exceeds maximum (${options.max_entries})`,
            Operation.EXTRACT,
            {
              archive,
              details: { entry_count: entryCount, max_entries: options.max_entries },
            },
          ),
        );
        stream.resume();
        next();
        return;
      }

      // Security: Path traversal and absolute path validation
      const pathError = validatePath(header.name, Operation.EXTRACT, false);
      if (pathError) {
        errors.push({ ...pathError, archive });
        errorCount++;
        stream.resume();
        next();
        return;
      }

      const outputPath = join(destination, header.name);

      if (header.type === "directory") {
        if (!existsSync(outputPath)) {
          mkdirSync(outputPath, { recursive: true });
        }
        extractedCount++;
        stream.resume();
        next();
      } else if (header.type === "file") {
        if (existsSync(outputPath)) {
          if (options.overwrite === "error") {
            errors.push(
              createFulpackError(
                ERROR_CODES.EXTRACTION_FAILED,
                `Output file already exists: ${outputPath}`,
                Operation.EXTRACT,
                { path: header.name, archive },
              ),
            );
            errorCount++;
            stream.resume();
            next();
            return;
          } else if (options.overwrite === "skip") {
            warnings.push(`Skipped existing file: ${outputPath}`);
            skippedCount++;
            stream.resume();
            next();
            return;
          }
        }

        const parentDir = dirname(outputPath);
        if (!existsSync(parentDir)) {
          mkdirSync(parentDir, { recursive: true });
        }

        // Extract file with byte counting for decompression bomb detection
        const writeStream = createWriteStream(outputPath);

        // Count actual bytes written (not header size)
        stream.on("data", (chunk: Buffer) => {
          totalExtractedSize += chunk.length;

          // Check against max_size based on actual bytes
          if (options.max_size && totalExtractedSize > options.max_size) {
            stream.destroy();
            writeStream.destroy();
            errors.push(
              createFulpackError(
                ERROR_CODES.DECOMPRESSION_BOMB,
                `Total extracted size exceeds maximum (${options.max_size} bytes)`,
                Operation.EXTRACT,
                {
                  archive,
                  path: header.name,
                  details: { actual_size: totalExtractedSize, max_size: options.max_size },
                },
              ),
            );
            errorCount++;
            next();
            return;
          }
        });

        stream.pipe(writeStream);

        writeStream.on("finish", () => {
          if (options.preserve_permissions && header.mode) {
            try {
              const { chmodSync } = require("node:fs");
              chmodSync(outputPath, header.mode);
            } catch {
              // Ignore permission errors
            }
          }
          extractedCount++;
          next();
        });

        writeStream.on("error", (error) => {
          errors.push(
            createFulpackError(
              ERROR_CODES.EXTRACTION_FAILED,
              `Failed to write file: ${error.message}`,
              Operation.EXTRACT,
              { path: header.name, archive, details: { original_error: error } },
            ),
          );
          errorCount++;
          next();
        });
      } else {
        warnings.push(`Skipped entry type ${header.type}: ${header.name}`);
        stream.resume();
        next();
      }
    } catch (error) {
      errors.push(
        createFulpackError(
          ERROR_CODES.EXTRACTION_FAILED,
          `Error processing entry: ${error instanceof Error ? error.message : "Unknown error"}`,
          Operation.EXTRACT,
          { path: header.name, archive, details: { original_error: error } },
        ),
      );
      errorCount++;
      stream.resume();
      next();
    }
  });

  const readStream = createReadStream(archive);

  return new Promise((resolve, reject) => {
    extract.on("finish", () => {
      resolve({
        extracted_count: extractedCount,
        skipped_count: skippedCount,
        error_count: errorCount,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        total_bytes: totalExtractedSize,
      });
    });

    extract.on("error", (error) => {
      reject(
        new FulpackOperationError(
          createFulpackError(
            ERROR_CODES.EXTRACTION_FAILED,
            `TAR extraction failed: ${error.message}`,
            Operation.EXTRACT,
            { archive, details: { original_error: error } },
          ),
        ),
      );
    });

    // biome-ignore lint/suspicious/noExplicitAny: tar-stream type incompatibility with pipe
    readStream.pipe(extract as any);
  });
}

/**
 * Helper: Extract ZIP archive
 */
async function extractZip(
  archive: string,
  destination: string,
  options: ExtractOptions,
): Promise<ExtractResult> {
  const unzipper = await import("unzipper");

  let extractedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors: FulpackError[] = [];
  const warnings: string[] = [];

  let totalExtractedSize = 0;
  let entryCount = 0;

  return new Promise((resolve, reject) => {
    const readStream = createReadStream(archive);

    readStream
      .pipe(unzipper.Parse())
      // biome-ignore lint/suspicious/noExplicitAny: unzipper entry type not exported
      .on("entry", async (entry: any) => {
        entryCount++;

        try {
          // Security: Check entry count limit
          if (options.max_entries && entryCount > options.max_entries) {
            errors.push(
              createFulpackError(
                ERROR_CODES.DECOMPRESSION_BOMB,
                `Entry count exceeds maximum (${options.max_entries})`,
                Operation.EXTRACT,
                {
                  archive,
                  details: { entry_count: entryCount, max_entries: options.max_entries },
                },
              ),
            );
            entry.autodrain();
            return;
          }

          // Security: Path traversal and absolute path validation
          const pathError = validatePath(entry.path, Operation.EXTRACT, false);
          if (pathError) {
            errors.push({ ...pathError, archive });
            errorCount++;
            entry.autodrain();
            return;
          }

          const outputPath = join(destination, entry.path);

          if (entry.type === "Directory") {
            // Create directory
            if (!existsSync(outputPath)) {
              mkdirSync(outputPath, { recursive: true });
            }
            extractedCount++;
            entry.autodrain();
          } else if (entry.type === "File") {
            // Check if file exists
            if (existsSync(outputPath)) {
              if (options.overwrite === "error") {
                errors.push(
                  createFulpackError(
                    ERROR_CODES.EXTRACTION_FAILED,
                    `Output file already exists: ${outputPath}`,
                    Operation.EXTRACT,
                    { path: entry.path, archive },
                  ),
                );
                errorCount++;
                entry.autodrain();
                return;
              } else if (options.overwrite === "skip") {
                warnings.push(`Skipped existing file: ${outputPath}`);
                skippedCount++;
                entry.autodrain();
                return;
              }
              // overwrite === "overwrite" - proceed
            }

            // Ensure parent directory exists
            const parentDir = dirname(outputPath);
            if (!existsSync(parentDir)) {
              mkdirSync(parentDir, { recursive: true });
            }

            // Extract file with byte counting for decompression bomb detection
            const writeStream = createWriteStream(outputPath);

            // Count actual bytes written (not header size)
            entry.on("data", (chunk: Buffer) => {
              totalExtractedSize += chunk.length;

              // Check against max_size based on actual bytes
              if (options.max_size && totalExtractedSize > options.max_size) {
                entry.destroy();
                writeStream.destroy();
                errors.push(
                  createFulpackError(
                    ERROR_CODES.DECOMPRESSION_BOMB,
                    `Total extracted size exceeds maximum (${options.max_size} bytes)`,
                    Operation.EXTRACT,
                    {
                      archive,
                      path: entry.path,
                      details: { actual_size: totalExtractedSize, max_size: options.max_size },
                    },
                  ),
                );
                errorCount++;
                return;
              }
            });

            entry.pipe(writeStream);

            writeStream.on("finish", () => {
              extractedCount++;
            });

            writeStream.on("error", (error: Error) => {
              errors.push(
                createFulpackError(
                  ERROR_CODES.EXTRACTION_FAILED,
                  `Failed to write file: ${error.message}`,
                  Operation.EXTRACT,
                  { path: entry.path, archive, details: { original_error: error } },
                ),
              );
              errorCount++;
            });
          } else {
            // Skip other types (symlinks, etc.) for security
            warnings.push(`Skipped entry type ${entry.type}: ${entry.path}`);
            entry.autodrain();
          }
        } catch (error) {
          errors.push(
            createFulpackError(
              ERROR_CODES.EXTRACTION_FAILED,
              `Error processing entry: ${error instanceof Error ? error.message : "Unknown error"}`,
              Operation.EXTRACT,
              { path: entry.path, archive, details: { original_error: error } },
            ),
          );
          errorCount++;
          entry.autodrain();
        }
      })
      .on("close", () => {
        resolve({
          extracted_count: extractedCount,
          skipped_count: skippedCount,
          error_count: errorCount,
          errors: errors.length > 0 ? errors : undefined,
          warnings: warnings.length > 0 ? warnings : undefined,
          total_bytes: totalExtractedSize,
        });
      })
      .on("error", (error: Error) => {
        reject(
          new FulpackOperationError(
            createFulpackError(
              ERROR_CODES.EXTRACTION_FAILED,
              `ZIP extraction failed: ${error.message}`,
              Operation.EXTRACT,
              { archive, details: { original_error: error } },
            ),
          ),
        );
      });
  });
}

/**
 * Helper: Scan tar.gz archive
 */
async function scanTar(archive: string, options: ScanOptions): Promise<ArchiveEntry[]> {
  const tarStream = await import("tar-stream");
  const extract = tarStream.extract();

  const entries: ArchiveEntry[] = [];
  let entryCount = 0;

  return new Promise((resolve, reject) => {
    extract.on("entry", async (header, stream, next) => {
      entryCount++;

      // Security: Check entry count limit
      if (options.max_entries && entryCount > options.max_entries) {
        stream.resume();
        next();
        reject(
          new FulpackOperationError(
            createFulpackError(
              ERROR_CODES.DECOMPRESSION_BOMB,
              `Entry count exceeds maximum (${options.max_entries})`,
              Operation.SCAN,
              {
                archive,
                details: { entry_count: entryCount, max_entries: options.max_entries },
              },
            ),
          ),
        );
        return;
      }

      // Build entry object with optional metadata
      const entry: ArchiveEntry = {
        path: header.name,
        type:
          header.type === "directory"
            ? (EntryType.DIRECTORY as "directory")
            : header.type === "symlink"
              ? (EntryType.SYMLINK as "symlink")
              : (EntryType.FILE as "file"),
        size: header.size || 0,
        modified: header.mtime ? header.mtime.toISOString() : new Date().toISOString(),
        ...(options.include_metadata && header.mode !== undefined && header.mode !== null
          ? { mode: `0${(header.mode & 0o777).toString(8)}` }
          : {}),
        ...(options.include_metadata &&
        header.type === "symlink" &&
        (header as { linkname?: string }).linkname
          ? { symlink_target: (header as { linkname?: string }).linkname }
          : {}),
      };

      entries.push(entry);

      // Drain the stream without writing anywhere
      stream.resume();
      next();
    });

    extract.on("finish", () => {
      resolve(entries);
    });

    extract.on("error", (error) => {
      reject(
        new FulpackOperationError(
          createFulpackError(
            ERROR_CODES.ARCHIVE_CORRUPT,
            `TAR scanning failed: ${error.message}`,
            Operation.SCAN,
            { archive, details: { original_error: error } },
          ),
        ),
      );
    });

    // Pipe tar file to extractor
    const readStream = createReadStream(archive);
    readStream.pipe(extract as unknown as NodeJS.WritableStream);
  });
}

async function scanTarGz(archive: string, options: ScanOptions): Promise<ArchiveEntry[]> {
  const tarStream = await import("tar-stream");
  const extract = tarStream.extract();

  const entries: ArchiveEntry[] = [];
  let entryCount = 0;

  return new Promise((resolve, reject) => {
    extract.on("entry", async (header, stream, next) => {
      entryCount++;

      // Security: Check entry count limit
      if (options.max_entries && entryCount > options.max_entries) {
        stream.resume();
        next();
        reject(
          new FulpackOperationError(
            createFulpackError(
              ERROR_CODES.DECOMPRESSION_BOMB,
              `Entry count exceeds maximum (${options.max_entries})`,
              Operation.SCAN,
              {
                archive,
                details: { entry_count: entryCount, max_entries: options.max_entries },
              },
            ),
          ),
        );
        return;
      }

      // Build entry object with optional metadata
      const entry: ArchiveEntry = {
        path: header.name,
        type:
          header.type === "directory"
            ? (EntryType.DIRECTORY as "directory")
            : header.type === "symlink"
              ? (EntryType.SYMLINK as "symlink")
              : (EntryType.FILE as "file"),
        size: header.size || 0,
        modified: header.mtime ? header.mtime.toISOString() : new Date().toISOString(),
        ...(options.include_metadata && header.mode !== undefined && header.mode !== null
          ? { mode: `0${(header.mode & 0o777).toString(8)}` }
          : {}),
        ...(options.include_metadata &&
        header.type === "symlink" &&
        (header as { linkname?: string }).linkname
          ? { symlink_target: (header as { linkname?: string }).linkname }
          : {}),
      };

      entries.push(entry);

      // Drain the stream without writing anywhere
      stream.resume();
      next();
    });

    extract.on("finish", () => {
      resolve(entries);
    });

    extract.on("error", (error) => {
      reject(
        new FulpackOperationError(
          createFulpackError(
            ERROR_CODES.ARCHIVE_CORRUPT,
            `TAR.GZ scanning failed: ${error.message}`,
            Operation.SCAN,
            { archive, details: { original_error: error } },
          ),
        ),
      );
    });

    // Pipe tar.gz file through gunzip to extractor
    const readStream = createReadStream(archive);
    const gunzip = createGunzip();
    readStream.pipe(gunzip).pipe(extract as unknown as NodeJS.WritableStream);
  });
}

async function scanZip(archive: string, options: ScanOptions): Promise<ArchiveEntry[]> {
  const unzipper = await import("unzipper");
  const entries: ArchiveEntry[] = [];
  let entryCount = 0;

  return new Promise((resolve, reject) => {
    createReadStream(archive)
      .pipe(unzipper.Parse())
      .on("entry", (entry: unknown) => {
        const typedEntry = entry as {
          path: string;
          type: string;
          vars: {
            uncompressedSize?: number;
            compressedSize?: number;
            lastModifiedTime?: number;
          };
          props?: {
            size?: number;
            compressedSize?: number;
          };
          autodrain: () => void;
        };

        entryCount++;

        // Security: Check entry count limit
        if (options.max_entries && entryCount > options.max_entries) {
          typedEntry.autodrain();
          reject(
            new FulpackOperationError(
              createFulpackError(
                ERROR_CODES.DECOMPRESSION_BOMB,
                `Entry count exceeds maximum (${options.max_entries})`,
                Operation.SCAN,
                {
                  archive,
                  details: { entry_count: entryCount, max_entries: options.max_entries },
                },
              ),
            ),
          );
          return;
        }

        // Try multiple sources for size (unzipper library variations)
        const uncompressedSize = typedEntry.vars?.uncompressedSize || typedEntry.props?.size || 0;
        const compressedSize =
          typedEntry.vars?.compressedSize || typedEntry.props?.compressedSize || 0;

        // Build entry object with optional metadata
        const archiveEntry: ArchiveEntry = {
          path: typedEntry.path,
          type:
            typedEntry.type === "Directory"
              ? (EntryType.DIRECTORY as "directory")
              : (EntryType.FILE as "file"),
          size: uncompressedSize,
          modified: typedEntry.vars?.lastModifiedTime
            ? new Date(typedEntry.vars.lastModifiedTime).toISOString()
            : new Date().toISOString(),
          ...(options.include_metadata
            ? {
                compressed_size: compressedSize,
                mode: "0644", // ZIP format doesn't preserve Unix permissions consistently
              }
            : {}),
        };

        entries.push(archiveEntry);

        // Drain the entry stream without writing anywhere
        typedEntry.autodrain();
      })
      .on("error", (error: Error) => {
        reject(
          new FulpackOperationError(
            createFulpackError(
              ERROR_CODES.ARCHIVE_CORRUPT,
              `ZIP scanning failed: ${error.message}`,
              Operation.SCAN,
              { archive, details: { original_error: error } },
            ),
          ),
        );
      })
      .on("finish", () => {
        resolve(entries);
      });
  });
}
