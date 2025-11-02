import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FulmenError } from '../../errors/index.js';
import { Pathfinder } from '../finder.js';
import {
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
        'ignore.tmp',
        'ignored.txt',
        'keep.txt',
        'nested/ignored.log',
        'nested/keep.md',
      ]);
    });
  });
});
