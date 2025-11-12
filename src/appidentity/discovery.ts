/**
 * Application Identity Discovery
 *
 * Implements the Crucible discovery precedence algorithm:
 * 1. Explicit path parameter (highest priority)
 * 2. Environment variable override (FULMEN_APP_IDENTITY_PATH)
 * 3. Ancestor search from CWD upward
 */

import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  APP_IDENTITY_DIR,
  APP_IDENTITY_ENV_VAR,
  APP_IDENTITY_FILENAME,
  MAX_ANCESTOR_SEARCH_DEPTH,
} from "./constants.js";
import { AppIdentityError } from "./errors.js";

/**
 * Discovery result with path and source
 */
export interface DiscoveryResult {
  readonly path: string;
  readonly source: "explicit" | "env" | "ancestor" | "test";
}

/**
 * Options for identity discovery
 */
export interface DiscoveryOptions {
  /**
   * Explicit path override (highest priority)
   */
  readonly path?: string;

  /**
   * Starting directory for ancestor search
   * Defaults to process.cwd()
   */
  readonly startDir?: string;
}

/**
 * Discover application identity file using Crucible precedence algorithm
 *
 * Discovery order:
 * 1. Explicit path parameter (throws if not found)
 * 2. FULMEN_APP_IDENTITY_PATH env var (throws if set but not found)
 * 3. Ancestor search from startDir (throws if not found after max depth)
 *
 * @param options - Discovery options
 * @returns Discovery result with path and source
 * @throws {AppIdentityError} If identity file not found or inaccessible
 */
export async function discoverIdentityPath(
  options?: DiscoveryOptions,
): Promise<DiscoveryResult | null> {
  // 1. Explicit path parameter (highest priority)
  if (options?.path) {
    const exists = await fileExists(options.path);
    if (!exists) {
      throw AppIdentityError.notFound([options.path]);
    }
    return { path: options.path, source: "explicit" };
  }

  // 2. Environment variable override
  const envPath = process.env[APP_IDENTITY_ENV_VAR];
  if (envPath) {
    const exists = await fileExists(envPath);
    if (!exists) {
      throw AppIdentityError.envOverrideMissing(envPath);
    }
    return { path: envPath, source: "env" };
  }

  // 3. Ancestor search from startDir
  const startDir = options?.startDir || process.cwd();
  const result = await searchAncestors(startDir);
  if (result) {
    return { path: result, source: "ancestor" };
  }

  return null;
}

/**
 * Search ancestor directories for identity file
 *
 * Walks upward from startDir to filesystem root, looking for .fulmen/app.yaml
 * Stops at MAX_ANCESTOR_SEARCH_DEPTH or filesystem root
 *
 * @param startDir - Directory to start search from
 * @returns Path to identity file if found, null otherwise
 * @throws {AppIdentityError} If max depth reached or filesystem root reached without finding file
 */
async function searchAncestors(startDir: string): Promise<string | null> {
  let currentDir = startDir;
  const searchedPaths: string[] = [];

  for (let i = 0; i < MAX_ANCESTOR_SEARCH_DEPTH; i++) {
    const candidatePath = join(currentDir, APP_IDENTITY_DIR, APP_IDENTITY_FILENAME);
    searchedPaths.push(candidatePath);

    if (await fileExists(candidatePath)) {
      return candidatePath;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      throw AppIdentityError.notFound(searchedPaths);
    }
    currentDir = parentDir;
  }

  // Max depth reached
  throw AppIdentityError.notFound(searchedPaths);
}

/**
 * Check if a file exists and is accessible
 *
 * @param path - Path to check
 * @returns true if file exists and is readable, false otherwise
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
