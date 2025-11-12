/**
 * Application Identity Module
 *
 * Provides typed access to .fulmen/app.yaml identity metadata
 * Layer 0 module: zero Fulmen module dependencies
 */

// Constants
export {
  APP_IDENTITY_DIR,
  APP_IDENTITY_ENV_VAR,
  APP_IDENTITY_FILENAME,
  APP_IDENTITY_SCHEMA_ID,
  MAX_ANCESTOR_SEARCH_DEPTH,
} from "./constants.js";

// Errors
export { AppIdentityError } from "./errors.js";
export type { ConfigIdentifiers } from "./helpers.js";
// Helpers
export {
  buildEnvVar,
  getBinaryName,
  getConfigIdentifiers,
  getConfigName,
  getEnvPrefix,
  getEnvVar,
  getTelemetryNamespace,
  getVendor,
} from "./helpers.js";
// Functions
export { clearIdentityCache, getCachedIdentity, loadIdentity } from "./loader.js";
// Types
export type {
  AppIdentity,
  Identity,
  IdentityMetadata,
  LoadIdentityOptions,
  PythonMetadata,
  RepositoryCategory,
} from "./types.js";
