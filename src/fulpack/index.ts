/**
 * Fulpack Module
 *
 * Canonical archive operations with Pathfinder integration.
 * Provides create, extract, scan, verify, and info operations for
 * tar.gz, zip, and gzip formats with security protections.
 */

// Export core operations
export {
  create,
  extract,
  info,
  scan,
  verify,
} from "./core.js";
export * from "./enums.js";
export * from "./errors.js";
// Export all types and enums
export * from "./types.js";

// Version information
export const FULPACK_VERSION = "1.0.0";
