/**
 * Pathfinder constants - Default configuration and standard values
 */

import type { PathfinderConfig } from './types.js';
import { ChecksumAlgorithm, ChecksumEncoding, LoaderType } from './types.js';

/**
 * Default Pathfinder configuration
 *
 * Provides schema-aligned defaults for optional configuration parameters.
 * Callers should override constraint.root and other deployment-specific values.
 */
export const DEFAULT_CONFIG: Partial<PathfinderConfig> = {
  maxWorkers: 4,
  cacheEnabled: false,
  cacheTTL: 300,
  loaderType: LoaderType.LOCAL,
  calculateChecksums: false,
  checksumAlgorithm: ChecksumAlgorithm.XXH3_128,
  checksumEncoding: ChecksumEncoding.HEX,
  honorIgnoreFiles: true,
};

/**
 * Default ignore file names (checked in order)
 *
 * Pathfinder will look for these files in each directory during traversal.
 * First match wins. .fulmenignore takes precedence over .gitignore.
 */
export const DEFAULT_IGNORE_FILES = ['.fulmenignore', '.gitignore'];

/**
 * Platform-specific path separator
 *
 * Used for normalizing paths across Windows and Unix-like systems.
 */
export const PATH_SEPARATOR = process.platform === 'win32' ? '\\' : '/';

/**
 * Maximum reasonable path length
 *
 * Used for validation to prevent excessively long paths.
 * Windows MAX_PATH is 260, Unix typically 4096. Use conservative limit.
 */
export const MAX_PATH_LENGTH = 4096;

/**
 * Default buffer size for file operations (bytes)
 *
 * Used when reading files for checksum calculation.
 */
export const DEFAULT_BUFFER_SIZE = 65536; // 64KB
