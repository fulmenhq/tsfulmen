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
  // Tighten to the actually-shipped subtree (secrev): the package only ships the
  // `crucible-ts` subtree of each namespace (config/crucible-ts, schemas/crucible-ts,
  // docs/crucible-ts), so a path/pattern resolving elsewhere can never be a real asset.
  if (segments[1] !== "crucible-ts") {
    throw new AssetResolutionError(
      `Asset ${kind} must be under <namespace>/crucible-ts/ : ${value}`,
      value,
    );
  }
}

/**
 * Validate a logical asset path. Always rejects traversal/absolute/non-POSIX
 * inputs (the security guard). When `enforceNamespace` (the default — used by the
 * package's own asset resolver), also restricts to the SSOT namespaces. Resolvers
 * pointed at a consumer-supplied `baseDir` pass `enforceNamespace: false` since
 * the consumer owns and scopes that tree. Returns the (unchanged) safe path.
 */
export function assertSafeLogicalPath(logicalPath: string, enforceNamespace = true): string {
  const segments = rejectCommon(logicalPath, "path");
  if (enforceNamespace) {
    assertNamespace(logicalPath, segments, "path");
  }
  return logicalPath;
}

/**
 * Validate a glob pattern. Always rejects `..`/absolute/backslash patterns; glob
 * metacharacters (`*`, `{}`, etc.) are allowed within segments. Namespace
 * restriction is applied only when `enforceNamespace` (see
 * {@link assertSafeLogicalPath}).
 */
export function assertSafePattern(pattern: string, enforceNamespace = true): string {
  const segments = rejectCommon(pattern, "pattern");
  if (enforceNamespace) {
    assertNamespace(pattern, segments, "pattern");
  }
  return pattern;
}
