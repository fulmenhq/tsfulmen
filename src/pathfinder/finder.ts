/**
 * Pathfinder Finder - Main traversal class (Phase 1)
 *
 * Implements secure filesystem traversal with glob-based discovery, include/exclude
 * pattern support, optional symlink following, and constraint enforcement.
 */

import type { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import fg, { type Options as FastGlobOptions } from 'fast-glob';

import { DEFAULT_CONFIG, DEFAULT_IGNORE_FILES } from './constants.js';
import { createPathfinderError, PathfinderErrorCode, wrapPathfinderError } from './errors.js';
import { IgnoreMatcher } from './ignore.js';
import {
  type ConstraintEvaluation,
  createConstraintViolationError,
  enforcePathConstraints,
  isPathWithinRoot,
  toPosixPath,
} from './safety.js';
import type {
  PathfinderConfig,
  PathfinderExecuteOptions,
  PathfinderQuery,
  PathResult,
} from './types.js';
import { ChecksumAlgorithm, ChecksumEncoding, EnforcementLevel, LoaderType } from './types.js';

/**
 * Resolved configuration with defaults applied.
 */
interface ResolvedPathfinderConfig {
  maxWorkers: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  loaderType: LoaderType;
  calculateChecksums: boolean;
  checksumAlgorithm: ChecksumAlgorithm;
  checksumEncoding: ChecksumEncoding;
  constraint?: PathfinderConfig['constraint'];
  honorIgnoreFiles: boolean;
}

/**
 * Normalized discovery query with absolute paths and defaults applied.
 */
interface NormalizedPathfinderQuery {
  /** Absolute root path retaining caller symlink semantics */
  root: string;
  /** Real path of the root (symlinks resolved) */
  realRoot: string;
  include: string[];
  exclude: string[];
  maxDepth: number;
  followSymlinks: boolean;
  includeHidden: boolean;
  honorIgnoreFiles: boolean;
}

/**
 * Pathfinder class - Filesystem traversal with pattern matching
 */
export class Pathfinder {
  private readonly config: ResolvedPathfinderConfig;

  constructor(config?: PathfinderConfig) {
    this.config = this.normalizeConfig(config);
  }

  /**
   * Discover files matching the specified query.
   *
   * Collects all results in memory before returning.
   */
  async find(
    query: PathfinderQuery,
    options: PathfinderExecuteOptions = {},
  ): Promise<PathResult[]> {
    const results: PathResult[] = [];

    for await (const result of this.findIterable(query, options)) {
      results.push(result);
    }

    return results;
  }

  /**
   * Discover files lazily via async iteration.
   */
  async *findIterable(
    query: PathfinderQuery,
    options: PathfinderExecuteOptions = {},
  ): AsyncIterable<PathResult> {
    const normalizedQuery = await this.normalizeQuery(query);
    this.validateConstraintCompatibility(normalizedQuery);

    const ignoreMatcher = normalizedQuery.honorIgnoreFiles
      ? new IgnoreMatcher(normalizedQuery.root)
      : undefined;

    const globOptions: FastGlobOptions = {
      cwd: normalizedQuery.root,
      absolute: true,
      dot: normalizedQuery.includeHidden,
      onlyFiles: true,
      followSymbolicLinks: normalizedQuery.followSymlinks,
      unique: true,
      ignore: normalizedQuery.exclude,
    };

    if (normalizedQuery.maxDepth > 0) {
      globOptions.deep = normalizedQuery.maxDepth;
    }

    let matches: string[];
    try {
      matches = await fg(normalizedQuery.include, globOptions);
    } catch (error) {
      throw wrapPathfinderError(error as Error, PathfinderErrorCode.TRAVERSAL_FAILED, {
        root: normalizedQuery.root,
      });
    }

    for (const candidatePath of matches) {
      const lstat = await this.safeLstat(candidatePath, options);
      if (!lstat) continue;

      if (lstat.isDirectory()) {
        // Should not happen with onlyFiles=true, but guard defensively
        continue;
      }

      if (lstat.isSymbolicLink() && !normalizedQuery.followSymlinks) {
        continue;
      }

      if (DEFAULT_IGNORE_FILES.includes(path.basename(candidatePath))) {
        continue;
      }

      let evaluationPath = candidatePath;
      if (lstat.isSymbolicLink()) {
        const resolved = await this.safeRealpath(candidatePath, options);
        if (!resolved) continue;
        evaluationPath = resolved;
      }

      // Ensure the resolved path remains within the real root.
      if (!isPathWithinRoot(evaluationPath, normalizedQuery.realRoot)) {
        const violationError = createConstraintViolationError(
          `Path ${evaluationPath} escapes discovery root ${normalizedQuery.realRoot}`,
          { path: evaluationPath, root: normalizedQuery.realRoot },
        );
        await this.dispatchError(violationError, candidatePath, options);
        continue;
      }

      const relativeFromRoot = path.relative(normalizedQuery.root, candidatePath);
      if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
        const violationError = createConstraintViolationError(
          `Path ${candidatePath} is outside discovery root ${normalizedQuery.root}`,
          { path: candidatePath, root: normalizedQuery.root },
        );
        await this.dispatchError(violationError, candidatePath, options);
        continue;
      }

      const relativePosix = toPosixPath(relativeFromRoot);
      if (ignoreMatcher && (await ignoreMatcher.shouldIgnore(candidatePath, relativePosix))) {
        continue;
      }

      const constraintResult = this.evaluateConstraint(evaluationPath, relativePosix);
      if (!constraintResult.allowed) {
        const enforcement = this.config.constraint?.enforcementLevel ?? EnforcementLevel.WARN;
        const violationError = createConstraintViolationError(
          constraintResult.reason ?? 'Path violates configured constraint',
          {
            path: evaluationPath,
            relativePath: relativePosix,
            constraintRoot: this.config.constraint?.root,
          },
        );

        if (enforcement === EnforcementLevel.STRICT) {
          throw violationError;
        }

        if (enforcement === EnforcementLevel.WARN) {
          if (options.errorCallback) {
            await this.dispatchError(violationError, candidatePath, options);
          }
          continue;
        }

        // Permissive mode allows the path through.
      }

      const result: PathResult = {
        relativePath: relativePosix,
        sourcePath: candidatePath,
        logicalPath: relativePosix,
        loaderType: this.config.loaderType,
      };

      await this.dispatchResult(result, options);
      yield result;
    }
  }

  /**
   * Normalize finder configuration by applying defaults.
   */
  private normalizeConfig(config?: PathfinderConfig): ResolvedPathfinderConfig {
    const merged: PathfinderConfig = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    return {
      maxWorkers: merged.maxWorkers ?? 4,
      cacheEnabled: merged.cacheEnabled ?? false,
      cacheTTL: merged.cacheTTL ?? 300,
      loaderType: merged.loaderType ?? LoaderType.LOCAL,
      calculateChecksums: merged.calculateChecksums ?? false,
      checksumAlgorithm: merged.checksumAlgorithm ?? ChecksumAlgorithm.XXH3_128,
      checksumEncoding: merged.checksumEncoding ?? ChecksumEncoding.HEX,
      constraint: merged.constraint,
      honorIgnoreFiles: merged.honorIgnoreFiles ?? true,
    };
  }

  /**
   * Normalize a discovery query and ensure the root exists.
   */
  private async normalizeQuery(query: PathfinderQuery): Promise<NormalizedPathfinderQuery> {
    if (!query || !query.root) {
      throw createPathfinderError(
        PathfinderErrorCode.INVALID_CONFIG,
        'Pathfinder query requires a root directory',
      );
    }

    const absoluteRoot = path.resolve(query.root);

    let stats: Stats;
    try {
      stats = await fs.stat(absoluteRoot);
    } catch (error) {
      throw wrapPathfinderError(error as Error, PathfinderErrorCode.INVALID_ROOT, {
        root: absoluteRoot,
      });
    }

    if (!stats.isDirectory()) {
      throw createPathfinderError(
        PathfinderErrorCode.INVALID_ROOT,
        `Pathfinder root must be a directory: ${absoluteRoot}`,
        { context: { root: absoluteRoot } },
      );
    }

    let realRoot: string;
    try {
      realRoot = await fs.realpath(absoluteRoot);
    } catch (error) {
      throw wrapPathfinderError(error as Error, PathfinderErrorCode.INVALID_ROOT, {
        root: absoluteRoot,
      });
    }

    const include = query.include && query.include.length > 0 ? [...query.include] : ['**/*'];
    const exclude = query.exclude ? [...query.exclude] : [];
    const maxDepth = query.maxDepth ?? 0;

    if (maxDepth < 0) {
      throw createPathfinderError(
        PathfinderErrorCode.INVALID_CONFIG,
        'Pathfinder maxDepth must be >= 0',
        { context: { maxDepth } },
      );
    }

    return {
      root: absoluteRoot,
      realRoot,
      include,
      exclude,
      maxDepth,
      followSymlinks: query.followSymlinks ?? false,
      includeHidden: query.includeHidden ?? false,
      honorIgnoreFiles: query.honorIgnoreFiles ?? this.config.honorIgnoreFiles,
    };
  }

  /**
   * Ensure constraint root encompasses the discovery root when provided.
   */
  private validateConstraintCompatibility(query: NormalizedPathfinderQuery): void {
    const constraint = this.config.constraint;
    if (!constraint) {
      return;
    }

    const constraintRoot = constraint.root ? path.resolve(constraint.root) : undefined;
    if (!constraintRoot) {
      return;
    }

    if (!isPathWithinRoot(query.realRoot, constraintRoot)) {
      throw createPathfinderError(
        PathfinderErrorCode.INVALID_CONFIG,
        `Discovery root ${query.realRoot} must be within constraint root ${constraintRoot}`,
        { severity: 'high', context: { root: query.realRoot, constraintRoot } },
      );
    }
  }

  /**
   * Evaluate constraint applicability for a discovered path.
   */
  private evaluateConstraint(evaluationPath: string, relativePath: string): ConstraintEvaluation {
    return enforcePathConstraints(evaluationPath, relativePath, this.config.constraint);
  }

  /**
   * Invoke result/progress callbacks prior to yielding.
   */
  private async dispatchResult(
    result: PathResult,
    options: PathfinderExecuteOptions,
  ): Promise<void> {
    if (options.resultCallback) {
      await options.resultCallback(result);
    }

    if (options.progressCallback && options.progressCallback !== options.resultCallback) {
      await options.progressCallback(result);
    }
  }

  /**
   * Invoke error callback or throw when unrecoverable.
   */
  private async dispatchError(
    error: Error,
    pathContext: string,
    options: PathfinderExecuteOptions,
  ): Promise<void> {
    if (options.errorCallback) {
      await options.errorCallback(error, pathContext);
      return;
    }

    throw error;
  }

  /**
   * lstat wrapper that routes recoverable errors through callbacks.
   */
  private async safeLstat(
    targetPath: string,
    options: PathfinderExecuteOptions,
  ): Promise<Stats | undefined> {
    try {
      return await fs.lstat(targetPath);
    } catch (error) {
      const wrapped = wrapPathfinderError(error as Error, PathfinderErrorCode.TRAVERSAL_FAILED, {
        path: targetPath,
        operation: 'lstat',
      });
      await this.dispatchError(wrapped, targetPath, options);
      return undefined;
    }
  }

  /**
   * realpath wrapper that routes recoverable errors through callbacks.
   */
  private async safeRealpath(
    targetPath: string,
    options: PathfinderExecuteOptions,
  ): Promise<string | undefined> {
    try {
      return await fs.realpath(targetPath);
    } catch (error) {
      const wrapped = wrapPathfinderError(error as Error, PathfinderErrorCode.TRAVERSAL_FAILED, {
        path: targetPath,
        operation: 'realpath',
      });
      await this.dispatchError(wrapped, targetPath, options);
      return undefined;
    }
  }
}
