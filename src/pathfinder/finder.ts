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

import { FulmenError, generateCorrelationId } from '../errors/index.js';
import type { SeverityName } from '../errors/severity.js';
import type { Logger } from '../logging/logger.js';
import { metrics as defaultMetrics } from '../telemetry/index.js';
import type { MetricsRegistry } from '../telemetry/registry.js';
import { calculateChecksum } from './checksum.js';
import { DEFAULT_CONFIG, DEFAULT_IGNORE_FILES } from './constants.js';
import { createPathfinderError, PathfinderErrorCode } from './errors.js';
import { IgnoreMatcher } from './ignore.js';
import {
  type ConstraintEvaluation,
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
import {
  ChecksumAlgorithm,
  ChecksumEncoding,
  EnforcementLevel,
  type FileMetadata,
  LoaderType,
} from './types.js';

export interface PathfinderOptions {
  logger?: Logger;
  correlationId?: string;
  metrics?: MetricsRegistry;
}

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
  private readonly logger?: Logger;
  private readonly correlationId: string;
  private readonly metrics: MetricsRegistry;

  constructor(config?: PathfinderConfig, options: PathfinderOptions = {}) {
    this.config = this.normalizeConfig(config);
    this.logger = options.logger;
    this.correlationId = options.correlationId ?? generateCorrelationId();
    this.metrics = options.metrics ?? defaultMetrics;
  }

  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
  ): void {
    if (!this.logger) return;

    const logContext = {
      correlation_id: this.correlationId,
      domain: 'pathfinder',
      ...context,
    };

    switch (level) {
      case 'debug':
        this.logger.debug(message, logContext);
        break;
      case 'info':
        this.logger.info(message, logContext);
        break;
      case 'warn':
        this.logger.warn(message, logContext);
        break;
      case 'error':
        this.logger.error(message, error, logContext);
        break;
    }
  }

  private createError(
    code: PathfinderErrorCode,
    message: string,
    severity: SeverityName = 'medium',
    context?: Record<string, unknown>,
  ): FulmenError {
    return createPathfinderError(code, message, {
      severity,
      correlation_id: this.correlationId,
      context,
    });
  }

  private throwError(
    code: PathfinderErrorCode,
    message: string,
    severity: SeverityName = 'medium',
    context?: Record<string, unknown>,
  ): never {
    const error = this.createError(code, message, severity, context);
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    this.log(level, message, { code, ...context }, error);
    throw error;
  }

  private wrapError(
    error: unknown,
    code: PathfinderErrorCode,
    severity: SeverityName = 'medium',
    context: Record<string, unknown> = {},
  ): FulmenError {
    const baseError =
      error instanceof Error ? error : new Error(typeof error === 'string' ? error : String(error));

    if (error instanceof FulmenError) {
      return FulmenError.wrap(error, {
        severity,
        correlation_id: this.correlationId,
        context: {
          domain: 'pathfinder',
          category: 'filesystem',
          ...context,
        },
      });
    }

    return FulmenError.wrap(baseError, {
      code,
      severity,
      correlation_id: this.correlationId,
      context: {
        domain: 'pathfinder',
        category: 'filesystem',
        ...context,
      },
    });
  }

  private wrapAndLogError(
    error: unknown,
    code: PathfinderErrorCode,
    severity: SeverityName = 'medium',
    context: Record<string, unknown> = {},
    message?: string,
  ): FulmenError {
    const wrapped = this.wrapError(error, code, severity, context);
    const logMessage = message ?? wrapped.message;
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    this.log(level, logMessage, { code, ...context }, wrapped);
    return wrapped;
  }

  private recordSecurityWarning(details: Record<string, unknown>, reason?: string): void {
    this.metrics.counter('pathfinder_security_warnings').inc();
    this.log('warn', reason ?? 'Pathfinder security warning', details);
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
    const histogram = this.metrics.histogram('pathfinder_find_ms');
    const start = performance.now();

    try {
      const results: PathResult[] = [];

      for await (const result of this.iterate(query, options)) {
        results.push(result);
      }

      histogram.observe(performance.now() - start);
      return results;
    } catch (error) {
      histogram.observe(performance.now() - start);
      throw this.wrapAndLogError(error, PathfinderErrorCode.TRAVERSAL_FAILED, 'medium', {
        operation: 'find',
      });
    }
  }

  async *findIterable(
    query: PathfinderQuery,
    options: PathfinderExecuteOptions = {},
  ): AsyncIterable<PathResult> {
    const histogram = this.metrics.histogram('pathfinder_find_ms');
    const start = performance.now();

    try {
      for await (const result of this.iterate(query, options)) {
        yield result;
      }
      histogram.observe(performance.now() - start);
    } catch (error) {
      histogram.observe(performance.now() - start);
      throw this.wrapAndLogError(error, PathfinderErrorCode.TRAVERSAL_FAILED, 'medium', {
        operation: 'findIterable',
      });
    }
  }

  /**
   * Discover files lazily via async iteration.
   */
  private async *iterate(
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
      throw this.wrapAndLogError(error, PathfinderErrorCode.TRAVERSAL_FAILED, 'medium', {
        root: normalizedQuery.root,
        operation: 'glob',
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

      const isDefaultIgnoreFile = DEFAULT_IGNORE_FILES.includes(path.basename(candidatePath));
      if (isDefaultIgnoreFile) {
        if (normalizedQuery.honorIgnoreFiles) {
          this.log('debug', 'Skipping default ignore file', { path: candidatePath });
          continue;
        }

        this.log('debug', 'Including default ignore file because honorIgnoreFiles is disabled', {
          path: candidatePath,
        });
      }

      let evaluationPath = candidatePath;
      if (lstat.isSymbolicLink()) {
        const resolved = await this.safeRealpath(candidatePath, options);
        if (!resolved) continue;
        evaluationPath = resolved;
      }

      // Ensure the resolved path remains within the real root.
      if (!isPathWithinRoot(evaluationPath, normalizedQuery.realRoot)) {
        const violationContext = {
          path: evaluationPath,
          root: normalizedQuery.realRoot,
          operation: 'validatePathWithinRoot',
        };
        this.recordSecurityWarning(
          violationContext,
          `Path ${evaluationPath} escapes discovery root ${normalizedQuery.realRoot}`,
        );
        const violationError = this.createError(
          PathfinderErrorCode.CONSTRAINT_VIOLATION,
          `Path ${evaluationPath} escapes discovery root ${normalizedQuery.realRoot}`,
          'high',
          violationContext,
        );
        await this.dispatchError(violationError, candidatePath, options);
        continue;
      }

      const relativeFromRoot = path.relative(normalizedQuery.root, candidatePath);
      if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
        const violationContext = {
          path: candidatePath,
          root: normalizedQuery.root,
          operation: 'validateRelativePath',
        };
        this.recordSecurityWarning(
          violationContext,
          `Path ${candidatePath} is outside discovery root ${normalizedQuery.root}`,
        );
        const violationError = this.createError(
          PathfinderErrorCode.CONSTRAINT_VIOLATION,
          `Path ${candidatePath} is outside discovery root ${normalizedQuery.root}`,
          'high',
          violationContext,
        );
        await this.dispatchError(violationError, candidatePath, options);
        continue;
      }

      const relativePosix = toPosixPath(relativeFromRoot);
      if (ignoreMatcher && (await ignoreMatcher.shouldIgnore(candidatePath, relativePosix))) {
        this.log('debug', 'Excluded by ignore matcher', {
          path: candidatePath,
          relativePath: relativePosix,
        });
        continue;
      }

      const constraintResult = this.evaluateConstraint(evaluationPath, relativePosix);
      if (!constraintResult.allowed) {
        const enforcement = this.config.constraint?.enforcementLevel ?? EnforcementLevel.WARN;
        const message = constraintResult.reason ?? 'Path violates configured constraint';
        const violationContext = {
          path: evaluationPath,
          relativePath: relativePosix,
          constraintRoot: this.config.constraint?.root,
          enforcement,
        };

        this.recordSecurityWarning(violationContext, message);

        const violationError = this.createError(
          PathfinderErrorCode.CONSTRAINT_VIOLATION,
          message,
          enforcement === EnforcementLevel.STRICT ? 'high' : 'medium',
          violationContext,
        );

        if (enforcement === EnforcementLevel.STRICT) {
          this.log('error', message, violationContext, violationError);
          throw violationError;
        }

        if (enforcement === EnforcementLevel.WARN) {
          this.log('warn', message, violationContext, violationError);
          if (options.errorCallback) {
            await options.errorCallback(violationError, candidatePath);
          }
          continue;
        }

        // Permissive mode allows the path through.
      }

      let statsForMetadata = lstat;
      if (evaluationPath !== candidatePath) {
        const resolvedStats = await this.safeStat(evaluationPath, options);
        statsForMetadata = resolvedStats ?? lstat;
      }

      const metadata = await this.buildMetadata(
        candidatePath,
        evaluationPath,
        statsForMetadata,
        lstat.isSymbolicLink(),
      );

      const result: PathResult = {
        relativePath: relativePosix,
        sourcePath: candidatePath,
        logicalPath: relativePosix,
        loaderType: this.config.loaderType,
        metadata,
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
      this.throwError(
        PathfinderErrorCode.INVALID_CONFIG,
        'Pathfinder query requires a root directory',
        'high',
        { operation: 'normalizeQuery' },
      );
    }

    const absoluteRoot = path.resolve(query.root);

    let stats: Stats;
    try {
      stats = await fs.stat(absoluteRoot);
    } catch (error) {
      throw this.wrapAndLogError(error, PathfinderErrorCode.INVALID_ROOT, 'high', {
        root: absoluteRoot,
        operation: 'stat',
      });
    }

    if (!stats.isDirectory()) {
      this.throwError(
        PathfinderErrorCode.INVALID_ROOT,
        `Pathfinder root must be a directory: ${absoluteRoot}`,
        'high',
        { root: absoluteRoot },
      );
    }

    let realRoot: string;
    try {
      realRoot = await fs.realpath(absoluteRoot);
    } catch (error) {
      throw this.wrapAndLogError(error, PathfinderErrorCode.INVALID_ROOT, 'high', {
        root: absoluteRoot,
        operation: 'realpath',
      });
    }

    const include = query.include && query.include.length > 0 ? [...query.include] : ['**/*'];
    const exclude = query.exclude ? [...query.exclude] : [];
    const maxDepth = query.maxDepth ?? 0;

    if (maxDepth < 0) {
      this.throwError(
        PathfinderErrorCode.INVALID_CONFIG,
        'Pathfinder maxDepth must be >= 0',
        'high',
        { maxDepth },
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
      this.throwError(
        PathfinderErrorCode.INVALID_CONFIG,
        `Discovery root ${query.realRoot} must be within constraint root ${constraintRoot}`,
        'high',
        { root: query.realRoot, constraintRoot },
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

  private async buildMetadata(
    originalPath: string,
    resolvedPath: string,
    stats: Stats,
    isSymlink: boolean,
  ): Promise<FileMetadata> {
    const metadata: FileMetadata = {};

    if (Number.isFinite(stats.size)) {
      metadata.size = stats.size;
    }

    if (stats.mtime instanceof Date && Number.isFinite(stats.mtime.valueOf())) {
      metadata.modified = stats.mtime.toISOString();
    }

    metadata.permissions = this.formatPermissions(stats.mode);

    if (isSymlink) {
      metadata.isSymlink = true;
      try {
        metadata.symlinkTarget = await fs.readlink(originalPath);
      } catch {
        // Ignore readlink errors; metadata remains without target
      }
    }

    if (this.config.calculateChecksums) {
      const algorithm = this.config.checksumAlgorithm ?? ChecksumAlgorithm.XXH3_128;
      const checksumMetadata = await calculateChecksum(resolvedPath, algorithm);

      if (checksumMetadata.checksumError) {
        this.log('warn', 'Checksum calculation failed', {
          path: originalPath,
          resolvedPath,
          algorithm,
          error: checksumMetadata.checksumError,
        });
      }

      Object.assign(metadata, checksumMetadata);
    }

    return metadata;
  }

  private formatPermissions(mode: number): string {
    const normalized = mode & 0o777;
    return normalized.toString(8).padStart(4, '0');
  }

  private async safeStat(
    targetPath: string,
    options: PathfinderExecuteOptions,
  ): Promise<Stats | undefined> {
    try {
      return await fs.stat(targetPath);
    } catch (error) {
      const wrapped = this.wrapError(error, PathfinderErrorCode.TRAVERSAL_FAILED, 'medium', {
        path: targetPath,
        operation: 'stat',
      });
      await this.dispatchError(wrapped, targetPath, options);
      return undefined;
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
    const normalized =
      error instanceof FulmenError
        ? error
        : this.wrapError(error, PathfinderErrorCode.TRAVERSAL_FAILED, 'medium', {
            path: pathContext,
            operation: 'dispatchError',
          });

    const severity = normalized.data.severity ?? 'medium';
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';

    this.log(
      level,
      'Pathfinder recoverable error',
      {
        path: pathContext,
        code: normalized.data.code,
        severity,
      },
      normalized,
    );

    if (options.errorCallback) {
      await options.errorCallback(normalized, pathContext);
      return;
    }

    throw normalized;
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
      const wrapped = this.wrapError(error, PathfinderErrorCode.TRAVERSAL_FAILED, 'medium', {
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
      const wrapped = this.wrapError(error, PathfinderErrorCode.TRAVERSAL_FAILED, 'medium', {
        path: targetPath,
        operation: 'realpath',
      });
      await this.dispatchError(wrapped, targetPath, options);
      return undefined;
    }
  }
}
