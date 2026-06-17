/**
 * Asset resolution - Filesystem backend
 *
 * Reads SSOT assets from the on-disk `schemas/crucible-ts` / `config/crucible-ts`
 * trees shipped in the npm package. This is the current (pre-v0.4.0) behavior,
 * now centralized behind the {@link AssetResolver} contract.
 */

import { access, readFile } from "node:fs/promises";
import { isAbsolute, join, sep } from "node:path";
import glob from "fast-glob";
import { AssetResolutionError } from "./errors.js";
import type { AssetProvenance, AssetResolver } from "./types.js";

/** Normalize a logical path to POSIX separators (logical paths are always POSIX). */
function toPosix(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}

export class FsAssetResolver implements AssetResolver {
  readonly mode = "fs" as const;

  constructor(private readonly baseDir: string) {}

  private resolve(logicalPath: string): string {
    return join(this.baseDir, logicalPath);
  }

  async read(logicalPath: string): Promise<string> {
    const absolute = this.resolve(logicalPath);
    try {
      return await readFile(absolute, "utf-8");
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        throw AssetResolutionError.notFound(logicalPath, "fs");
      }
      throw AssetResolutionError.readFailed(
        logicalPath,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  async list(patterns: string[]): Promise<string[]> {
    if (patterns.length === 0) {
      return [];
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
    try {
      await access(this.resolve(logicalPath));
      return true;
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

  /** Guard: logical paths must be relative (callers pass package-root-relative paths). */
  static assertRelative(logicalPath: string): void {
    if (isAbsolute(logicalPath)) {
      throw new AssetResolutionError(
        `Asset logical paths must be package-root-relative, got absolute: ${logicalPath}`,
        logicalPath,
      );
    }
  }
}
