/**
 * Application Identity Helpers
 *
 * Convenience functions for accessing identity fields
 * All helpers use loadIdentity() under the hood for caching benefits
 */

import { loadIdentity } from "./loader.js";
import type { LoadIdentityOptions } from "./types.js";

/**
 * Config identifiers for path construction
 */
export interface ConfigIdentifiers {
  readonly vendor: string;
  readonly configName: string;
}

/**
 * Get the binary name from app identity
 *
 * @param options - Load options (optional)
 * @returns Binary name (e.g., 'myapp')
 */
export async function getBinaryName(options?: LoadIdentityOptions): Promise<string> {
  const identity = await loadIdentity(options);
  return identity.app.binary_name;
}

/**
 * Get the vendor namespace from app identity
 *
 * @param options - Load options (optional)
 * @returns Vendor namespace (e.g., 'acmecorp')
 */
export async function getVendor(options?: LoadIdentityOptions): Promise<string> {
  const identity = await loadIdentity(options);
  return identity.app.vendor;
}

/**
 * Get the environment variable prefix from app identity
 *
 * @param options - Load options (optional)
 * @returns Env prefix (e.g., 'MYAPP_')
 */
export async function getEnvPrefix(options?: LoadIdentityOptions): Promise<string> {
  const identity = await loadIdentity(options);
  return identity.app.env_prefix;
}

/**
 * Get the config directory name from app identity
 *
 * @param options - Load options (optional)
 * @returns Config name (e.g., 'myapp')
 */
export async function getConfigName(options?: LoadIdentityOptions): Promise<string> {
  const identity = await loadIdentity(options);
  return identity.app.config_name;
}

/**
 * Get the telemetry namespace from app identity
 *
 * Falls back to binary_name if telemetry_namespace is not specified
 *
 * @param options - Load options (optional)
 * @returns Telemetry namespace (e.g., 'acmecorp_myapp' or 'myapp')
 */
export async function getTelemetryNamespace(options?: LoadIdentityOptions): Promise<string> {
  const identity = await loadIdentity(options);
  return identity.metadata?.telemetry_namespace ?? identity.app.binary_name;
}

/**
 * Get config identifiers for path construction
 *
 * Returns vendor and configName for building config paths like:
 * ~/.config/{vendor}/{configName}/config.yaml
 *
 * @param options - Load options (optional)
 * @returns Frozen config identifiers { vendor, configName }
 */
export async function getConfigIdentifiers(
  options?: LoadIdentityOptions,
): Promise<ConfigIdentifiers> {
  const identity = await loadIdentity(options);
  return Object.freeze({
    vendor: identity.app.vendor,
    configName: identity.app.config_name,
  });
}

/**
 * Build environment variable name with app prefix
 *
 * Constructs env var names like: MYAPP_DATABASE_URL
 * Normalizes invalid characters (anything outside [A-Z0-9_]) to underscores
 * for conventional env var naming.
 *
 * Examples:
 * - 'database-url' → 'MYAPP_DATABASE_URL'
 * - 'my.config' → 'MYAPP_MY_CONFIG'
 * - 'log_level' → 'MYAPP_LOG_LEVEL'
 *
 * @param key - Environment variable key (will be uppercased and normalized)
 * @param options - Load options (optional)
 * @returns Full environment variable name (e.g., 'MYAPP_DATABASE_URL')
 */
export async function buildEnvVar(key: string, options?: LoadIdentityOptions): Promise<string> {
  const envPrefix = await getEnvPrefix(options);
  // Uppercase and replace any non-alphanumeric/underscore characters with underscores
  const normalizedKey = key.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  return `${envPrefix}${normalizedKey}`;
}

/**
 * Get environment variable value using app prefix
 *
 * Convenience wrapper around process.env using buildEnvVar
 *
 * @param key - Environment variable key (will be uppercased)
 * @param options - Load options (optional)
 * @returns Environment variable value or undefined
 */
export async function getEnvVar(
  key: string,
  options?: LoadIdentityOptions,
): Promise<string | undefined> {
  const envVarName = await buildEnvVar(key, options);
  return process.env[envVarName];
}
