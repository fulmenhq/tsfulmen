import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { FulmenError } from '../../errors/index.js';
import { hashString } from '../../fulhash/hash.js';
import { Algorithm } from '../../fulhash/types.js';
import type { Logger } from '../../logging/logger.js';
import { type HistogramSummary, MetricsRegistry } from '../../telemetry/index.js';
import { PathfinderErrorCode } from '../errors.js';
import { Pathfinder } from '../finder.js';
import {
  ChecksumAlgorithm,
  ConstraintType,
  EnforcementLevel,
  LoaderType,
  type PathfinderExecuteOptions,
  type PathResult,
} from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_ROOT = path.join(__dirname, 'fixtures');
const BASIC_FIXTURE = path.join(FIXTURES_ROOT, 'basic');
const IGNORE_FIXTURE = path.join(FIXTURES_ROOT, 'ignore');
const CHECKSUM_FIXTURE = path.join(FIXTURES_ROOT, 'checksum');

const supportsSymlink = process.platform !== 'win32';
let externalTempDir: string | undefined;
let externalFile: string | undefined;
let symlinkPath: string | undefined;

const itSymlink = supportsSymlink ? it : it.skip;

beforeAll(async () => {
  if (!supportsSymlink) return;

  externalTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsfulmen-pathfinder-'));
  externalFile = path.join(externalTempDir, 'external.txt');
  symlinkPath = path.join(BASIC_FIXTURE, 'symlink-external.txt');

  await fs.writeFile(externalFile, 'external');

  try {
    await fs.symlink(externalFile, symlinkPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
});

afterAll(async () => {
  if (symlinkPath) {
    await fs.unlink(symlinkPath).catch(() => {});
  }

  if (externalFile) {
    await fs.unlink(externalFile).catch(() => {});
  }

  if (externalTempDir) {
    await fs.rm(externalTempDir, { recursive: true, force: true }).catch(() => {});
  }
});

function collectRelativePaths(results: PathResult[]): string[] {
  return results.map((result) => result.relativePath).sort();
}

describe('Pathfinder Finder', () => {
  it('should discover files with default query', async () => {
    const finder = new Pathfinder();
    const results = await finder.find({ root: BASIC_FIXTURE });

    const paths = collectRelativePaths(results);
    expect(paths).toEqual([
      'alpha.txt',
      'beta.ts',
      'nested/deep/epsilon.ts',
      'nested/delta.ts',
      'nested/gamma.md',
      'skip/skipped.log',
    ]);
  });

  it('should respect include patterns', async () => {
    const finder = new Pathfinder();
    const results = await finder.find({
      root: BASIC_FIXTURE,
      include: ['**/*.ts'],
    });

    const paths = collectRelativePaths(results);
    expect(paths).toEqual(['beta.ts', 'nested/deep/epsilon.ts', 'nested/delta.ts']);
  });

  it('should invoke callbacks for discovered results', async () => {
    const finder = new Pathfinder();
    const seenByResult: string[] = [];
    const seenByProgress: string[] = [];

    await finder.find(
      {
        root: BASIC_FIXTURE,
        include: ['**/*.ts'],
      },
      {
        resultCallback: async (result) => {
          seenByResult.push(result.relativePath);
        },
        progressCallback: async (result) => {
          seenByProgress.push(result.relativePath);
        },
      },
    );

    const sortedResult = [...seenByResult].sort();
    const sortedProgress = [...seenByProgress].sort();

    expect(sortedResult).toEqual(['beta.ts', 'nested/deep/epsilon.ts', 'nested/delta.ts']);
    expect(sortedProgress).toEqual(sortedResult);
  });

  it('should respect exclude patterns', async () => {
    const finder = new Pathfinder();
    const results = await finder.find({
      root: BASIC_FIXTURE,
      include: ['**/*'],
      exclude: ['skip/**'],
    });

    const paths = collectRelativePaths(results);
    expect(paths).not.toContain('skip/skipped.log');
  });

  it('should enforce maxDepth limits', async () => {
    const finder = new Pathfinder();
    const results = await finder.find({
      root: BASIC_FIXTURE,
      include: ['**/*'],
      maxDepth: 1,
    });

    const paths = collectRelativePaths(results);
    expect(paths).toEqual(['alpha.txt', 'beta.ts']);
  });

  it('should include hidden files when requested', async () => {
    const finder = new Pathfinder();
    const results = await finder.find({
      root: BASIC_FIXTURE,
      include: ['**/*'],
      includeHidden: true,
    });

    const paths = collectRelativePaths(results);
    expect(paths).toContain('.secrets.ts');
    expect(paths).toContain('.hidden/secret.txt');
    expect(paths).toContain('nested/.hidden-file.ts');
  });

  itSymlink('should enforce constraint violations in STRICT mode', async () => {
    const finder = new Pathfinder({
      loaderType: LoaderType.LOCAL,
      constraint: {
        root: BASIC_FIXTURE,
        type: ConstraintType.WORKSPACE,
        enforcementLevel: EnforcementLevel.STRICT,
      },
    });

    await expect(
      finder.find({
        root: BASIC_FIXTURE,
        include: ['**/*'],
        followSymlinks: true,
      }),
    ).rejects.toBeInstanceOf(FulmenError);
  });

  itSymlink('should emit warnings for constraint violations in WARN mode', async () => {
    const errors: Error[] = [];
    const errorCallback: PathfinderExecuteOptions['errorCallback'] = async (error) => {
      errors.push(error);
    };

    const finder = new Pathfinder({
      constraint: {
        root: BASIC_FIXTURE,
        type: ConstraintType.WORKSPACE,
        enforcementLevel: EnforcementLevel.WARN,
      },
    });

    const results = await finder.find(
      {
        root: BASIC_FIXTURE,
        include: ['**/*'],
        followSymlinks: true,
      },
      { errorCallback },
    );

    const paths = collectRelativePaths(results);
    expect(paths).not.toContain('symlink-external.txt');
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]).toBeInstanceOf(FulmenError);
  });

  itSymlink('should reject symlinks escaping the root', async () => {
    const finder = new Pathfinder();

    await expect(
      finder.find({
        root: BASIC_FIXTURE,
        include: ['**/symlink-external.txt'],
        followSymlinks: true,
      }),
    ).rejects.toBeInstanceOf(FulmenError);
  });

  describe('.fulmenignore support', () => {
    it('should honor ignore patterns by default', async () => {
      const finder = new Pathfinder();
      const results = await finder.find({
        root: IGNORE_FIXTURE,
        include: ['**/*'],
        includeHidden: true,
        followSymlinks: true,
      });

      const paths = collectRelativePaths(results);
      expect(paths).toEqual(['keep.txt', 'nested/keep.md']);
    });

    it('should allow disabling ignore file support per query', async () => {
      const finder = new Pathfinder();
      const results = await finder.find({
        root: IGNORE_FIXTURE,
        include: ['**/*'],
        includeHidden: true,
        followSymlinks: true,
        honorIgnoreFiles: false,
      });

      const paths = collectRelativePaths(results);
      expect(paths).toEqual([
        '.fulmenignore',
        'ignore.tmp',
        'ignored.txt',
        'keep.txt',
        'nested/.fulmenignore',
        'nested/ignored.log',
        'nested/keep.md',
      ]);
    });
  });

  describe('Checksum integration', () => {
    it('should populate base metadata without checksums when disabled', async () => {
      const finder = new Pathfinder();
      const results = await finder.find({
        root: CHECKSUM_FIXTURE,
        include: ['**/*.txt'],
      });

      results.forEach((result) => {
        expect(result.metadata).toBeDefined();
        expect(result.metadata?.size).toBeGreaterThan(0);
        expect(result.metadata?.checksum).toBeUndefined();
      });
    });

    it('should attach xxh3-128 checksums when enabled', async () => {
      const finder = new Pathfinder({
        calculateChecksums: true,
        checksumAlgorithm: ChecksumAlgorithm.XXH3_128,
      });
      const results = await finder.find({
        root: CHECKSUM_FIXTURE,
        include: ['**/*.txt'],
      });

      const alphaContents = await fs.readFile(path.join(CHECKSUM_FIXTURE, 'alpha.txt'), 'utf-8');
      const expectedAlpha = await hashString(alphaContents, { algorithm: Algorithm.XXH3_128 });

      const metadata = results.reduce<Record<string, PathResult['metadata']>>((acc, result) => {
        acc[result.relativePath] = result.metadata;
        return acc;
      }, {});

      expect(metadata['alpha.txt']?.checksum).toBe(
        `${ChecksumAlgorithm.XXH3_128}:${expectedAlpha.hex}`,
      );
      expect(metadata['alpha.txt']?.checksumAlgorithm).toBe(ChecksumAlgorithm.XXH3_128);
    });

    it('should attach sha256 checksums when configured', async () => {
      const finder = new Pathfinder({
        calculateChecksums: true,
        checksumAlgorithm: ChecksumAlgorithm.SHA256,
      });
      const results = await finder.find({
        root: CHECKSUM_FIXTURE,
        include: ['**/*.txt'],
      });

      const betaContents = await fs.readFile(path.join(CHECKSUM_FIXTURE, 'beta.txt'), 'utf-8');
      const expectedBeta = await hashString(betaContents, { algorithm: Algorithm.SHA256 });

      const betaMetadata = results.find((result) => result.relativePath === 'beta.txt')?.metadata;
      expect(betaMetadata?.checksum).toBe(`${ChecksumAlgorithm.SHA256}:${expectedBeta.hex}`);
      expect(betaMetadata?.checksumAlgorithm).toBe(ChecksumAlgorithm.SHA256);
    });
  });
});

describe('Pathfinder observability', () => {
  it('should record find duration telemetry', async () => {
    const registry = new MetricsRegistry();
    const finder = new Pathfinder(undefined, { metrics: registry });

    await finder.find({
      root: BASIC_FIXTURE,
      include: ['**/*.txt'],
    });

    const events = await registry.export();
    const histogram = events.find((event) => event.name === 'pathfinder_find_ms');

    expect(histogram).toBeDefined();
    const summary = histogram?.value as HistogramSummary;
    expect(summary.count).toBeGreaterThan(0);
    expect(summary.sum).toBeGreaterThan(0);
  });

  it('should include correlation id on thrown errors', async () => {
    const registry = new MetricsRegistry();
    const correlationId = 'test-correlation-id';
    const finder = new Pathfinder(undefined, { metrics: registry, correlationId });

    let capturedError: FulmenError | undefined;
    await finder
      .find({
        root: path.join(BASIC_FIXTURE, 'missing-directory'),
      })
      .catch((err) => {
        capturedError = err as FulmenError;
      });

    expect(capturedError).toBeDefined();
    expect(capturedError).toBeInstanceOf(FulmenError);
    expect(capturedError?.data.correlation_id).toBe(correlationId);
    expect(capturedError?.data.code).toBe(PathfinderErrorCode.INVALID_ROOT);
  });

  itSymlink('should log and count security warnings with correlation metadata', async () => {
    const registry = new MetricsRegistry();
    const correlationId = 'warn-correlation-id';
    const warn = vi.fn();
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn,
      error: vi.fn(),
    };

    const errors: FulmenError[] = [];
    const finder = new Pathfinder(
      {
        constraint: {
          root: BASIC_FIXTURE,
          type: ConstraintType.WORKSPACE,
          enforcementLevel: EnforcementLevel.WARN,
        },
      },
      {
        logger: logger as unknown as Logger,
        metrics: registry,
        correlationId,
      },
    );

    const results = await finder.find(
      {
        root: BASIC_FIXTURE,
        include: ['**/*'],
        followSymlinks: true,
      },
      {
        errorCallback: async (error) => {
          errors.push(error as FulmenError);
        },
      },
    );

    expect(results.length).toBeGreaterThan(0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].data.correlation_id).toBe(correlationId);

    const events = await registry.export();
    const securityCounter = events.find((event) => event.name === 'pathfinder_security_warnings');
    expect(securityCounter?.value).toBeGreaterThan(0);

    const contexts = warn.mock.calls.map(([, ctx]) => ctx);
    expect(contexts.some((ctx) => ctx?.correlation_id === correlationId)).toBe(true);
    expect(contexts.some((ctx) => ctx?.domain === 'pathfinder')).toBe(true);
  });

  it('should log checksum failures with algorithm context', async () => {
    const warn = vi.fn();
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn,
      error: vi.fn(),
    };

    const finder = new Pathfinder(
      {
        calculateChecksums: true,
      },
      {
        logger: logger as unknown as Logger,
      },
    );

    const checksumModule = await import('../checksum.js');
    const checksumSpy = vi.spyOn(checksumModule, 'calculateChecksum').mockResolvedValue({
      checksum: `${ChecksumAlgorithm.XXH3_128}:error`,
      checksumAlgorithm: ChecksumAlgorithm.XXH3_128,
      checksumError: 'simulated failure',
    });

    try {
      await finder.find({
        root: CHECKSUM_FIXTURE,
        include: ['**/*.txt'],
      });
    } finally {
      checksumSpy.mockRestore();
    }

    const checksumCalls = warn.mock.calls.filter(
      ([message]) => message === 'Checksum calculation failed',
    );

    expect(checksumCalls.length).toBeGreaterThan(0);
    const [, context] = checksumCalls[0];
    expect(context.algorithm).toBe(ChecksumAlgorithm.XXH3_128);
    expect(context.error).toBe('simulated failure');
  });
});
