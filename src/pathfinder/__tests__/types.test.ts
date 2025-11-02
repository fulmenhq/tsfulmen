/**
 * Pathfinder types tests
 */

import { describe, expect, it } from 'vitest';
import { FulmenError } from '../../errors/index.js';
import { DEFAULT_CONFIG } from '../constants.js';
import { createPathfinderError, PathfinderErrorCode, wrapPathfinderError } from '../errors.js';
import {
  ChecksumAlgorithm,
  ChecksumEncoding,
  ConstraintType,
  EnforcementLevel,
  LoaderType,
  type PathfinderConfig,
  type PathfinderQuery,
  type PathResult,
} from '../types.js';
import { validateConfig, validatePathResult } from '../validators.js';

describe('Pathfinder Types', () => {
  describe('PathfinderConfig', () => {
    it('should accept full schema-aligned config', () => {
      const config: PathfinderConfig = {
        maxWorkers: 8,
        cacheEnabled: true,
        cacheTTL: 600,
        constraint: {
          type: ConstraintType.WORKSPACE,
          enforcementLevel: EnforcementLevel.STRICT,
          root: '/workspace/project',
        },
        loaderType: LoaderType.LOCAL,
        calculateChecksums: true,
        checksumAlgorithm: ChecksumAlgorithm.SHA256,
        checksumEncoding: ChecksumEncoding.HEX,
        honorIgnoreFiles: false,
      };
      expect(config).toBeDefined();
      expect(config.constraint?.type).toBe(ConstraintType.WORKSPACE);
      expect(config.checksumAlgorithm).toBe(ChecksumAlgorithm.SHA256);
      expect(config.honorIgnoreFiles).toBe(false);
    });

    it('should accept sha256 checksum algorithm', () => {
      const config: PathfinderConfig = {
        calculateChecksums: true,
        checksumAlgorithm: ChecksumAlgorithm.SHA256,
      };
      expect(config.checksumAlgorithm).toBe(ChecksumAlgorithm.SHA256);
    });
  });

  describe('EnforcementLevel', () => {
    it('should expose all enforcement levels', () => {
      expect(EnforcementLevel.WARN).toBe('warn');
      expect(EnforcementLevel.STRICT).toBe('strict');
      expect(EnforcementLevel.PERMISSIVE).toBe('permissive');
    });

    it('should omit constraint by default', () => {
      expect(DEFAULT_CONFIG.constraint).toBeUndefined();
    });

    it('should honor ignore files by default', () => {
      expect(DEFAULT_CONFIG.honorIgnoreFiles).toBe(true);
    });

    it('should default checksum encoding to hex', () => {
      expect(DEFAULT_CONFIG.checksumEncoding).toBe(ChecksumEncoding.HEX);
    });
  });

  describe('PathfinderQuery', () => {
    it('should align with find-query schema', () => {
      const query: PathfinderQuery = {
        root: '/workspace/project',
        include: ['**/*.ts'],
        exclude: ['**/node_modules/**'],
        maxDepth: 3,
        followSymlinks: false,
        includeHidden: true,
        honorIgnoreFiles: false,
      };

      expect(query.root).toBe('/workspace/project');
      expect(query.include).toContain('**/*.ts');
      expect(query.exclude).toContain('**/node_modules/**');
      expect(query.honorIgnoreFiles).toBe(false);
    });
  });

  describe('Error Helpers', () => {
    it('should create pathfinder errors with correct structure', () => {
      const error = createPathfinderError(
        PathfinderErrorCode.INVALID_ROOT,
        'Root directory not found',
      );

      expect(error).toBeInstanceOf(FulmenError);
      expect(error.data.code).toBe('pathfinder.invalid_root');
      expect(error.data.message).toBe('Root directory not found');
      expect(error.data.severity).toBe('medium');
      expect(error.data.context?.domain).toBe('pathfinder');
      expect(error.data.context?.category).toBe('filesystem');
    });

    it('should allow custom severity', () => {
      const error = createPathfinderError(
        PathfinderErrorCode.CONSTRAINT_VIOLATION,
        'Path escapes root',
        { severity: 'critical' },
      );

      expect(error.data.severity).toBe('critical');
    });

    it('should wrap existing errors', () => {
      const originalError = new Error('ENOENT: no such file or directory');
      const wrapped = wrapPathfinderError(originalError, PathfinderErrorCode.TRAVERSAL_FAILED, {
        directory: '/tmp/test',
      });

      expect(wrapped).toBeInstanceOf(FulmenError);
      expect(wrapped.data.code).toBe('pathfinder.traversal_failed');
      expect(wrapped.data.context?.domain).toBe('pathfinder');
      expect(wrapped.data.context?.directory).toBe('/tmp/test');
    });

    it('should include all error codes', () => {
      const codes = Object.values(PathfinderErrorCode);
      expect(codes).toContain('pathfinder.invalid_config');
      expect(codes).toContain('pathfinder.invalid_root');
      expect(codes).toContain('pathfinder.traversal_failed');
      expect(codes).toContain('pathfinder.constraint_violation');
      expect(codes).toContain('pathfinder.checksum_failed');
      expect(codes).toContain('pathfinder.validation_failed');
    });
  });

  describe('PathResult', () => {
    it('should accept valid path result with metadata', () => {
      const result: PathResult = {
        relativePath: 'src/index.ts',
        sourcePath: '/tmp/src/index.ts',
        loaderType: LoaderType.LOCAL,
        metadata: {
          size: 1234,
          modified: '2025-11-01T12:00:00Z',
        },
      };

      expect(result.relativePath).toBe('src/index.ts');
      expect(result.metadata.size).toBe(1234);
    });

    it('should accept path result with checksums', () => {
      const result: PathResult = {
        relativePath: 'src/index.ts',
        sourcePath: '/tmp/src/index.ts',
        loaderType: LoaderType.LOCAL,
        metadata: {
          size: 1234,
          modified: '2025-11-01T12:00:00Z',
          checksum: 'xxh3-128:abc123',
          checksumAlgorithm: ChecksumAlgorithm.XXH3_128,
        },
      };

      expect(result.metadata?.checksum).toMatch(/^xxh3-128:/);
      expect(result.metadata?.checksumAlgorithm).toBe(ChecksumAlgorithm.XXH3_128);
    });

    it('should accept path result with checksum error', () => {
      const result: PathResult = {
        relativePath: 'src/index.ts',
        sourcePath: '/tmp/src/index.ts',
        loaderType: LoaderType.LOCAL,
        metadata: {
          size: 1234,
          modified: '2025-11-01T12:00:00Z',
          checksumError: 'Permission denied',
        },
      };

      expect(result.metadata.checksumError).toBe('Permission denied');
    });
  });

  describe('Constants', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_CONFIG.maxWorkers).toBe(4);
      expect(DEFAULT_CONFIG.cacheEnabled).toBe(false);
      expect(DEFAULT_CONFIG.cacheTTL).toBe(300);
      expect(DEFAULT_CONFIG.loaderType).toBe(LoaderType.LOCAL);
      expect(DEFAULT_CONFIG.calculateChecksums).toBe(false);
      expect(DEFAULT_CONFIG.checksumAlgorithm).toBe(ChecksumAlgorithm.XXH3_128);
      expect(DEFAULT_CONFIG.checksumEncoding).toBe(ChecksumEncoding.HEX);
    });
  });

  describe('Schema validators', () => {
    it('should validate schema-compliant config', async () => {
      const result = await validateConfig({
        maxWorkers: 2,
        loaderType: LoaderType.LOCAL,
        constraint: {
          enforcementLevel: EnforcementLevel.WARN,
        },
      });

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('should surface diagnostics for invalid config', async () => {
      const result = await validateConfig({
        maxWorkers: 0,
        loaderType: 'invalid',
      });

      expect(result.valid).toBe(false);
      expect(
        result.diagnostics.some(
          (d) => d.pointer === '/maxWorkers' || /maxWorkers/i.test(d.message),
        ),
      ).toBe(true);
      expect(
        result.diagnostics.some(
          (d) => d.pointer === '/loaderType' || /loaderType/i.test(d.message),
        ),
      ).toBe(true);
    });

    it('should validate schema-compliant path result', async () => {
      const result = await validatePathResult({
        relativePath: 'src/index.ts',
        sourcePath: '/tmp/src/index.ts',
        loaderType: LoaderType.LOCAL,
        metadata: {
          checksum: 'xxh3-128:deadbeef',
          checksumAlgorithm: ChecksumAlgorithm.XXH3_128,
        },
      });

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('should report errors for invalid path result', async () => {
      const result = await validatePathResult({
        path: 'src/index.ts',
        absolutePath: '/tmp/src/index.ts',
        loaderType: 'invalid',
      });

      expect(result.valid).toBe(false);
      expect(
        result.diagnostics.some((d) => d.pointer === '' && /relativePath/i.test(d.message)),
      ).toBe(true);
      expect(
        result.diagnostics.some((d) => d.pointer === '' && /sourcePath/i.test(d.message)),
      ).toBe(true);
      expect(
        result.diagnostics.some(
          (d) => d.pointer === '/loaderType' || /loaderType/i.test(d.message),
        ),
      ).toBe(true);
    });
  });
});
