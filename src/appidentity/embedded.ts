/**
 * Embedded Identity Registration
 *
 * Provides a mechanism to register embedded identity at application startup
 * for standalone binary/package support. This allows applications to work
 * without requiring .fulmen/app.yaml to be discoverable on the filesystem.
 *
 * Discovery precedence (with embedded fallback):
 * 1. Explicit path parameter
 * 2. FULMEN_APP_IDENTITY_PATH environment variable
 * 3. Ancestor search from CWD
 * 4. Embedded identity fallback (this module)
 */

import { parse as parseYAML } from "yaml";
import { validateDataBySchemaId } from "../schema/index.js";
import { APP_IDENTITY_SCHEMA_ID } from "./constants.js";
import { AppIdentityError } from "./errors.js";
import type { Identity } from "./types.js";

/**
 * Process-level storage for embedded identity
 * Uses first-wins semantics - once registered, cannot be replaced
 */
let embeddedIdentity: Identity | null = null;
let isRegistered = false;

/**
 * Deep freeze an object and all its nested properties
 */
function deepFreeze<T>(obj: T): T {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    // biome-ignore lint/suspicious/noExplicitAny: Required for recursive property access
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
 * Register embedded identity YAML that serves as fallback when
 * runtime discovery cannot find an external app.yaml.
 *
 * Semantics:
 * - First registration wins (subsequent calls throw error)
 * - Validates against schema on registration
 * - Stores as immutable process-level fallback
 *
 * @param data - YAML string or pre-parsed Identity object
 * @throws {AppIdentityError} If already registered or validation fails
 *
 * @example
 * ```typescript
 * // From npm package entry point
 * import { registerEmbeddedIdentity } from "@fulmenhq/tsfulmen/appidentity";
 * import { readFileSync } from "node:fs";
 * import { fileURLToPath } from "node:url";
 * import { dirname, join } from "node:path";
 *
 * const __filename = fileURLToPath(import.meta.url);
 * const __dirname = dirname(__filename);
 * const embeddedPath = join(__dirname, "..", ".fulmen", "app.yaml");
 *
 * try {
 *   const yaml = readFileSync(embeddedPath, "utf-8");
 *   registerEmbeddedIdentity(yaml);
 * } catch {
 *   // Embedded identity not available - discovery will use filesystem
 * }
 * ```
 */
export async function registerEmbeddedIdentity(data: string | Identity): Promise<void> {
  // First-wins semantics
  if (isRegistered) {
    throw AppIdentityError.alreadyRegistered();
  }

  let identity: Identity;

  if (typeof data === "string") {
    // Parse YAML
    let parsed: unknown;
    try {
      parsed = parseYAML(data);
    } catch (error) {
      throw AppIdentityError.embeddedParseFailed(
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    // Validate against schema
    const result = await validateDataBySchemaId(parsed, APP_IDENTITY_SCHEMA_ID);
    if (!result.valid) {
      throw AppIdentityError.embeddedValidationFailed(result.diagnostics);
    }

    identity = parsed as Identity;
  } else {
    // Pre-parsed object - still validate
    const result = await validateDataBySchemaId(data, APP_IDENTITY_SCHEMA_ID);
    if (!result.valid) {
      throw AppIdentityError.embeddedValidationFailed(result.diagnostics);
    }
    identity = data;
  }

  // Deep freeze and store
  embeddedIdentity = deepFreeze(structuredClone(identity)) as Identity;
  isRegistered = true;
}

/**
 * Check if embedded identity has been registered
 *
 * @returns true if registerEmbeddedIdentity() has been called successfully
 */
export function hasEmbeddedIdentity(): boolean {
  return isRegistered;
}

/**
 * Get the registered embedded identity
 *
 * @returns Frozen identity object or null if not registered
 */
export function getEmbeddedIdentity(): Identity | null {
  return embeddedIdentity;
}

/**
 * Clear embedded identity registration
 *
 * WARNING: For testing only. In production, embedded identity should be
 * set once at startup and never cleared.
 */
export function clearEmbeddedIdentity(): void {
  embeddedIdentity = null;
  isRegistered = false;
}
