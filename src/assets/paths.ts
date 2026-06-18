/**
 * Asset resolution - Logical path & pattern validation
 *
 * `./assets` is a public export, so logical paths and glob patterns are
 * caller-controlled. These guards prevent path traversal (reading outside the
 * package root via `..`, absolute paths, or non-POSIX separators) and restrict
 * resolution to the SSOT asset namespaces tsfulmen actually ships.
 */

import { AssetResolutionError } from "./errors.js";

/** Top-level directories that make up the SSOT asset namespace. */
export const ASSET_NAMESPACES = ["schemas", "config", "docs"] as const;

function rejectCommon(value: string, kind: "path" | "pattern"): string[] {
  if (!value || value.trim() === "") {
    throw new AssetResolutionError(`Asset ${kind} must be a non-empty string`);
  }
  if (value.includes("\\")) {
    throw new AssetResolutionError(`Asset ${kind} must be POSIX (no backslashes): ${value}`, value);
  }
  if (value.startsWith("/") || /^[A-Za-z]:/.test(value)) {
    throw new AssetResolutionError(`Asset ${kind} must be relative, got absolute: ${value}`, value);
  }
  const segments = value.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") {
      throw new AssetResolutionError(
        `Asset ${kind} must not contain empty, '.' or '..' segments: ${value}`,
        value,
      );
    }
  }
  return segments;
}

function assertNamespace(value: string, segments: string[], kind: "path" | "pattern"): void {
  const top = segments[0];
  if (!ASSET_NAMESPACES.includes(top as (typeof ASSET_NAMESPACES)[number])) {
    throw new AssetResolutionError(
      `Asset ${kind} must start with one of ${ASSET_NAMESPACES.join("/")}/ : ${value}`,
      value,
    );
  }
}

/**
 * Validate a logical asset path. Rejects traversal/absolute/non-POSIX inputs and
 * paths outside the SSOT namespaces. Returns the (unchanged) safe path.
 */
export function assertSafeLogicalPath(logicalPath: string): string {
  const segments = rejectCommon(logicalPath, "path");
  assertNamespace(logicalPath, segments, "path");
  return logicalPath;
}

/**
 * Validate a glob pattern. Same traversal/namespace guards as logical paths; glob
 * metacharacters (`*`, `{}`, etc.) are allowed within segments but `..` segments
 * and absolute/backslash patterns are not.
 */
export function assertSafePattern(pattern: string): string {
  const segments = rejectCommon(pattern, "pattern");
  assertNamespace(pattern, segments, "pattern");
  return pattern;
}
