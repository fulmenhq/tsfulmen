/**
 * Application Identity Loader
 *
 * Main loading logic with YAML parsing, schema validation, and caching
 */

import { readFile } from "node:fs/promises";
import { parse as parseYAML } from "yaml";
import { validateDataBySchemaId } from "../schema/index.js";
import { clearIdentityCache, getCachedIdentity, setCachedIdentity } from "./cache.js";
import { APP_IDENTITY_ENV_VAR, APP_IDENTITY_SCHEMA_ID } from "./constants.js";
import { discoverIdentityPath } from "./discovery.js";
import { getEmbeddedIdentity } from "./embedded.js";
import { AppIdentityError } from "./errors.js";
import type { Identity, LoadIdentityOptions } from "./types.js";

/**
 * Deep freeze an object and all its nested properties
 *
 * Recursively freezes an object and all nested objects/functions to ensure
 * complete immutability. This prevents accidental mutations of identity data.
 *
 * Note: Uses `any` type assertion (line 28) to access arbitrary properties
 * during recursive traversal. This is necessary because TypeScript's generic
 * constraint system cannot express "any object with indexable properties"
 * without losing the return type safety. The `any` is scoped to a single
 * line and protected by runtime guards.
 *
 * @param obj - Object to freeze
 * @returns Frozen object (same type as input)
 */
function deepFreeze<T>(obj: T): T {
  // Freeze the object itself
  Object.freeze(obj);

  // Recursively freeze all properties
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    // biome-ignore lint/suspicious/noExplicitAny: Required for recursive property access - see function docs
    const value = (obj as any)[prop];
    if (
      value !== null &&
      (typeof value === "object" || typeof value === "function") &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value);
    }
  });

  return obj;
}

/**
 * Load application identity from .fulmen/app.yaml
 *
 * Discovery order:
 * 1. Test injection (options.identity) - bypasses all discovery and caching
 * 2. Explicit path (options.path)
 * 3. Environment variable (FULMEN_APP_IDENTITY_PATH)
 * 4. Ancestor search from startDir or CWD
 * 5. Embedded identity fallback (if registered via registerEmbeddedIdentity)
 *
 * Results are cached after first successful load unless skipCache is true.
 * Test injections are never cached.
 *
 * @param options - Load options
 * @returns Frozen, immutable identity object
 * @throws {AppIdentityError} If identity not found, invalid, or unreadable
 */
export async function loadIdentity(options?: LoadIdentityOptions): Promise<Identity> {
  // Test injection (never caches)
  if (options?.identity) {
    return deepFreeze(structuredClone(options.identity)) as Identity;
  }

  // Check cache unless skipCache
  if (!options?.skipCache) {
    const cached = getCachedIdentity();
    if (cached) {
      return cached;
    }
  }

  // Discover file - may throw AppIdentityError.notFound or return null
  let discovery: Awaited<ReturnType<typeof discoverIdentityPath>>;
  try {
    discovery = await discoverIdentityPath({
      path: options?.path,
      startDir: options?.startDir,
    });
  } catch (error) {
    // Discovery failed (e.g., reached filesystem root without finding identity)
    // Embedded fallback MUST NOT override explicit path or env override semantics.
    const hasExplicitPath = Boolean(options?.path);
    const hasEnvOverride = Boolean(process.env[APP_IDENTITY_ENV_VAR]);

    if (!hasExplicitPath && !hasEnvOverride && error instanceof AppIdentityError) {
      const embedded = getEmbeddedIdentity();
      if (embedded) {
        // Cache the embedded identity for subsequent calls
        setCachedIdentity(embedded);
        return embedded;
      }
    }

    throw error;
  }

  // If discovery returned null (no env var, no explicit path, and ancestor search returned null)
  if (!discovery) {
    const embedded = getEmbeddedIdentity();
    if (embedded) {
      // Cache the embedded identity for subsequent calls
      setCachedIdentity(embedded);
      return embedded;
    }
    throw AppIdentityError.notFound([]);
  }

  // Read file
  let content: string;
  try {
    content = await readFile(discovery.path, "utf-8");
  } catch (error) {
    throw AppIdentityError.readFailed(
      discovery.path,
      error instanceof Error ? error : new Error(String(error)),
    );
  }

  // Parse YAML
  let parsed: unknown;
  try {
    parsed = parseYAML(content);
  } catch (error) {
    throw AppIdentityError.parseFailed(
      discovery.path,
      error instanceof Error ? error : new Error(String(error)),
    );
  }

  // Validate against schema (unless skipValidation)
  if (!options?.skipValidation) {
    const result = await validateDataBySchemaId(parsed, APP_IDENTITY_SCHEMA_ID);

    if (!result.valid) {
      throw AppIdentityError.validationFailed(discovery.path, result.diagnostics);
    }
  }

  // Deep freeze for immutability
  const identity = deepFreeze(structuredClone(parsed)) as Identity;

  // Cache result
  setCachedIdentity(identity);

  return identity;
}

/**
 * Get cached identity without triggering load
 *
 * @returns Cached identity or null if not cached
 */
export { getCachedIdentity };

/**
 * Clear the identity cache
 *
 * Useful for testing or when identity needs to be reloaded
 */
export { clearIdentityCache };
