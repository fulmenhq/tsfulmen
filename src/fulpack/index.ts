/**
 * Fulpack Module
 *
 * Canonical archive operations with Pathfinder integration.
 * Provides create, extract, scan, verify, and info operations for
 * tar, tar.gz, zip, and gzip formats with security protections.
 */

// Export Crucible-generated types (canonical source)
export * from "../crucible/fulpack/types.js";

// Export core operations (tsfulmen implementation)
export { create, extract, info, scan, verify } from "./core.js";

// Export error handling
export * from "./errors.js";

// Version information
export const FULPACK_VERSION = "1.0.0";
