/**
 * Repository root discovery - Find repository markers in ancestor directories
 *
 * Implements Crucible v0.2.15 pathfinder extension for secure upward traversal.
 * Prevents data leakage with boundaries, max-depth, and path constraint enforcement.
 */

import { access, lstat, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DEFAULT_MAX_DEPTH } from "./constants.js";
import { createPathfinderError, PathfinderErrorCode } from "./errors.js";
import type { FindRepoOptions } from "./types.js";

/**
 * Find repository root by walking up directory tree
 *
 * Searches for marker files (e.g., .git, package.json) by traversing
 * upward from startPath, respecting boundaries and security constraints.
 *
 * **Security**: Enforces boundaries (home/explicit), max-depth, root/drive/UNC
 * ceilings, and optional path constraints. Default followSymlinks=false.
 *
 * @param startPath - Directory to start search from
 * @param markers - Array of marker files/directories to search for (e.g., [".git", "package.json"])
 * @param options - Optional configuration for boundaries, depth, and symlink handling
 * @returns Absolute path to repository root containing marker
 * @throws {FulmenError} REPOSITORY_NOT_FOUND if no marker found within constraints
 * @throws {FulmenError} INVALID_START_PATH if startPath doesn't exist or isn't accessible
 * @throws {FulmenError} INVALID_BOUNDARY if boundary is outside startPath ancestry
 * @throws {FulmenError} TRAVERSAL_LOOP if cyclic symlink detected (when followSymlinks=true)
 * @throws {FulmenError} SECURITY_VIOLATION if constraint prevents marker discovery
 *
 * @example
 * ```typescript
 * import { findRepositoryRoot, GitMarkers } from "@fulmenhq/tsfulmen/pathfinder";
 *
 * // Find Git repository root
 * const gitRoot = await findRepositoryRoot(process.cwd(), GitMarkers);
 *
 * // Find with custom boundary
 * const root = await findRepositoryRoot("./src/components", [".git"], {
 *   boundary: "/home/user/projects",
 *   maxDepth: 5
 * });
 * ```
 */
export async function findRepositoryRoot(
  startPath: string,
  markers: string[] = [".git"],
  options?: FindRepoOptions,
): Promise<string> {
  // Normalize and validate start path
  const normalizedStart = resolve(startPath);
  await validateStartPath(normalizedStart);

  // Apply defaults
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const stopAtFirst = options?.stopAtFirst ?? true;
  const followSymlinks = options?.followSymlinks ?? false;
  const constraint = options?.constraint;

  // Determine boundary: explicit or default (home), but only if start is under it
  let boundary: string;
  if (options?.boundary) {
    boundary = resolve(options.boundary);
    // Validate explicit boundary is ancestor of start
    validateBoundary(normalizedStart, boundary);
  } else {
    // Default boundary: use home if start is under it, otherwise filesystem root
    const home = getDefaultBoundary();
    boundary = normalizedStart.startsWith(home) ? home : "/";
  }

  // Validate constraint if provided
  if (constraint?.root) {
    const constraintRoot = resolve(constraint.root);
    if (!normalizedStart.startsWith(constraintRoot)) {
      throw createPathfinderError(
        PathfinderErrorCode.SECURITY_VIOLATION,
        `Start path ${normalizedStart} is outside constraint root ${constraintRoot}`,
        { severity: "high", context: { startPath: normalizedStart, constraint: constraintRoot } },
      );
    }
  }

  // Track visited paths for loop detection (when followSymlinks=true)
  const visitedRealPaths = new Set<string>();

  // Track all found markers (for stopAtFirst=false)
  let deepestMarkerPath: string | null = null;

  let currentDir = normalizedStart;
  let depth = 0;

  // Walk upward until we hit a boundary
  while (depth < maxDepth) {
    // Check for cyclic symlinks (if following symlinks)
    if (followSymlinks) {
      const realPath = await getRealPath(currentDir);
      if (visitedRealPaths.has(realPath)) {
        throw createPathfinderError(
          PathfinderErrorCode.TRAVERSAL_LOOP,
          `Cyclic symlink detected at ${currentDir}`,
          { severity: "high", context: { currentDir, realPath, depth } },
        );
      }
      visitedRealPaths.add(realPath);
    }

    // Check if we're outside constraint (if provided)
    if (constraint?.root) {
      const constraintRoot = resolve(constraint.root);
      if (!currentDir.startsWith(constraintRoot)) {
        // We've walked above the constraint - stop here
        break;
      }
    }

    // Check for markers in current directory
    for (const marker of markers) {
      if (await markerExists(currentDir, marker)) {
        if (stopAtFirst) {
          // Return immediately on first match
          return currentDir;
        }
        // Track deepest marker (closest to root)
        deepestMarkerPath = currentDir;
      }
    }

    // Check if we've reached the boundary
    if (currentDir === boundary || isFilesystemRoot(currentDir)) {
      break;
    }

    // Move up one directory
    const parentDir = dirname(currentDir);

    // Safety check: prevent infinite loop
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }

    currentDir = parentDir;
    depth++;
  }

  // If stopAtFirst=false and we found a marker, return deepest one
  if (!stopAtFirst && deepestMarkerPath) {
    return deepestMarkerPath;
  }

  // No marker found
  throw createPathfinderError(
    PathfinderErrorCode.REPOSITORY_NOT_FOUND,
    `No repository root found with markers [${markers.join(", ")}] from ${startPath}`,
    {
      severity: "medium",
      context: {
        startPath: normalizedStart,
        markers,
        maxDepth,
        boundary,
        depthReached: depth,
      },
    },
  );
}

/**
 * Validate start path exists and is accessible
 *
 * @param startPath - Path to validate
 * @throws {FulmenError} INVALID_START_PATH if path doesn't exist or isn't accessible
 */
async function validateStartPath(startPath: string): Promise<void> {
  try {
    await access(startPath);
    const stats = await lstat(startPath);
    if (!stats.isDirectory()) {
      throw createPathfinderError(
        PathfinderErrorCode.INVALID_START_PATH,
        `Start path is not a directory: ${startPath}`,
        { severity: "high", context: { startPath } },
      );
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw createPathfinderError(
        PathfinderErrorCode.INVALID_START_PATH,
        `Start path does not exist: ${startPath}`,
        { severity: "high", context: { startPath } },
      );
    }
    throw error;
  }
}

/**
 * Validate boundary is ancestor of start path
 *
 * @param startPath - Start path for search
 * @param boundary - Boundary ceiling
 * @throws {FulmenError} INVALID_BOUNDARY if boundary is not ancestor of startPath
 */
function validateBoundary(startPath: string, boundary: string): void {
  const normalizedStart = resolve(startPath);
  const normalizedBoundary = resolve(boundary);

  if (!normalizedStart.startsWith(normalizedBoundary)) {
    throw createPathfinderError(
      PathfinderErrorCode.INVALID_BOUNDARY,
      `Boundary ${boundary} is not an ancestor of start path ${startPath}`,
      { severity: "high", context: { startPath, boundary } },
    );
  }
}

/**
 * Check if directory is filesystem root
 *
 * Detects POSIX root (/), Windows drive roots (C:\), and UNC roots (\\server\share).
 *
 * @param dir - Directory to check
 * @returns true if dir is filesystem root
 */
function isFilesystemRoot(dir: string): boolean {
  const parentDir = dirname(dir);
  return parentDir === dir;
}

/**
 * Get default boundary (user home directory)
 *
 * @returns Absolute path to user home directory
 */
function getDefaultBoundary(): string {
  return homedir();
}

/**
 * Check if marker exists in directory
 *
 * @param dir - Directory to check
 * @param marker - Marker file/directory name
 * @returns true if marker exists in dir
 */
async function markerExists(dir: string, marker: string): Promise<boolean> {
  try {
    await access(join(dir, marker));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get real path resolving symlinks
 *
 * @param path - Path to resolve
 * @returns Real path with symlinks resolved
 */
async function getRealPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (_error) {
    // If realpath fails, return original path
    return path;
  }
}
