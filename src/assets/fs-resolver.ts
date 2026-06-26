/**
 * Asset resolution - Filesystem backend
 *
 * Reads SSOT assets from the on-disk `schemas/crucible-ts` / `config/crucible-ts`
 * trees shipped in the npm package. This is the current (pre-v0.4.0) behavior,
 * now centralized behind the {@link AssetResolver} contract.
 */

import { readFile, realpath } from "node:fs/promises";
import { join, sep } from "node:path";
import glob from "fast-glob";
import { AssetResolutionError } from "./errors.js";
import { assertSafeLogicalPath, assertSafePattern } from "./paths.js";
import type { AssetProvenance, AssetResolver } from "./types.js";

/** Normalize a logical path to POSIX separators (logical paths are always POSIX). */
function toPosix(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}

export class FsAssetResolver implements AssetResolver {
  readonly mode = "fs" as const;

  /**
   * @param baseDir Directory logical paths resolve against.
   * @param enforceNamespace Restrict to the SSOT namespaces (schemas/config/docs).
   *   Default `true` for the package's own asset tree; pass `false` when `baseDir`
   *   is a consumer-supplied tree they scope themselves (traversal guards still apply).
   */
  constructor(
    private readonly baseDir: string,
    private readonly enforceNamespace = true,
  ) {}

  private resolve(logicalPath: string): string {
    // Validate before joining — prevents `..`/absolute/non-POSIX traversal out of
    // baseDir via the public `./assets` surface.
    return join(this.baseDir, assertSafeLogicalPath(logicalPath, this.enforceNamespace));
  }

  async read(logicalPath: string): Promise<string> {
    const absolute = this.resolve(logicalPath);
    try {
      // Resolve symlinks and confirm the target stays within baseDir — a symlink
      // in the shipped tree must not let a read escape the asset root (secrev).
      const real = await realpath(absolute);
      if (!(await this.isWithinBase(real))) {
        throw AssetResolutionError.notFound(logicalPath, "fs");
      }
      return await readFile(real, "utf-8");
    } catch (error) {
      if (error instanceof AssetResolutionError) {
        throw error;
      }
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        throw AssetResolutionError.notFound(logicalPath, "fs");
      }
      // Reference the logical path + error code only — avoid leaking the absolute
      // host path that a raw FS error message (e.g. EACCES) would carry (secrev).
      throw AssetResolutionError.readFailed(logicalPath, err.code ?? "unknown");
    }
  }

  /** Cached realpath of baseDir (resolves symlinks once). */
  private baseRealCache?: Promise<string>;
  private baseReal(): Promise<string> {
    if (!this.baseRealCache) {
      this.baseRealCache = realpath(this.baseDir);
    }
    return this.baseRealCache;
  }

  /** Whether a resolved (realpath) target stays within the resolver's baseDir. */
  private async isWithinBase(realPath: string): Promise<boolean> {
    const base = await this.baseReal();
    return realPath === base || realPath.startsWith(base + sep);
  }

  async list(patterns: string[]): Promise<string[]> {
    if (patterns.length === 0) {
      return [];
    }
    for (const pattern of patterns) {
      assertSafePattern(pattern, this.enforceNamespace);
    }
    // Patterns are package-root-relative; glob with `cwd: baseDir` and return
    // logical (relative, POSIX) paths so callers never see absolute paths.
    const matches = await glob(patterns, {
      cwd: this.baseDir,
      absolute: false,
      onlyFiles: true,
      followSymbolicLinks: false,
      suppressErrors: true,
      dot: false,
    });
    return matches.map(toPosix).sort();
  }

  async has(logicalPath: string): Promise<boolean> {
    let absolute: string;
    try {
      absolute = this.resolve(logicalPath);
    } catch {
      return false; // invalid/traversing path → not present
    }
    try {
      const real = await realpath(absolute);
      return await this.isWithinBase(real);
    } catch {
      return false;
    }
  }

  provenance(): AssetProvenance {
    return { mode: "fs", baseDir: this.baseDir };
  }

  /** The on-disk base directory this resolver reads from. */
  getBaseDir(): string {
    return this.baseDir;
  }
}
