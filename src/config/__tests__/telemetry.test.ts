/**
 * Config module telemetry integration tests
 * Validates telemetry metrics emission for config operations
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { metrics } from '../../telemetry/index.js';
import { ConfigPathError } from '../errors.js';
import { ensureDirExists, resolveConfigPath } from '../paths.js';

describe('Config Module - Telemetry Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `tsfulmen-telemetry-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    await metrics.flush();
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('config_load_ms histogram', () => {
    it('should emit histogram for successful directory creation', async () => {
      await metrics.flush();

      const configDir = join(tempDir, 'config');
      await ensureDirExists(configDir);

      const events = await metrics.export();
      const histogram = events.find((e) => e.name === 'config_load_ms');

      expect(histogram).toBeDefined();
      expect(typeof histogram?.value).toBe('object');
      expect(histogram?.value).toHaveProperty('count');
      expect(histogram?.value).toHaveProperty('sum');
    });

    it('should emit histogram for successful config resolution', async () => {
      await metrics.flush();

      const configFile = join(tempDir, 'test.conf');
      await writeFile(configFile, 'test config');

      const result = await resolveConfigPath('test.conf', [tempDir]);
      expect(result).toBe(configFile);

      const events = await metrics.export();
      const histogram = events.find((e) => e.name === 'config_load_ms');

      expect(histogram).toBeDefined();
      expect(typeof histogram?.value).toBe('object');
    });

    it('should emit histogram even when file not found', async () => {
      await metrics.flush();

      const result = await resolveConfigPath('nonexistent.conf', [tempDir]);
      expect(result).toBeNull();

      const events = await metrics.export();
      const histogram = events.find((e) => e.name === 'config_load_ms');

      expect(histogram).toBeDefined();
    });
  });

  describe('config_load_errors counter', () => {
    it('should emit counter for directory creation failure', async () => {
      await metrics.flush();

      const readonlyDir = join(tempDir, 'readonly');
      await mkdir(readonlyDir, { mode: 0o444 });
      const targetDir = join(readonlyDir, 'subdir');

      try {
        await ensureDirExists(targetDir);
        throw new Error('Expected ensureDirExists to throw');
      } catch (err) {
        if (err instanceof Error && err.message.includes('Expected')) {
          throw err;
        }
        expect(err).toBeInstanceOf(ConfigPathError);
      }

      const events = await metrics.export();
      const counter = events.find((e) => e.name === 'config_load_errors');

      expect(counter).toBeDefined();
      expect(typeof counter?.value).toBe('number');
      expect(counter?.value).toBeGreaterThanOrEqual(1);
    });
  });

  describe('backward compatibility', () => {
    it('should still throw ConfigPathError on errors', async () => {
      const readonlyDir = join(tempDir, 'readonly');
      await mkdir(readonlyDir, { mode: 0o444 });
      const targetDir = join(readonlyDir, 'subdir');

      await expect(ensureDirExists(targetDir)).rejects.toThrow(ConfigPathError);
    });

    it('should return null for non-existent files', async () => {
      const result = await resolveConfigPath('nonexistent.conf', [tempDir]);
      expect(result).toBeNull();
    });
  });

  describe('telemetry timing', () => {
    it('should record histogram values in milliseconds', async () => {
      await metrics.flush();

      const configDir = join(tempDir, 'config');
      await ensureDirExists(configDir);

      const events = await metrics.export();
      const histogram = events.find((e) => e.name === 'config_load_ms');

      expect(histogram).toBeDefined();
      if (histogram && typeof histogram.value === 'object') {
        expect(histogram.value.sum).toBeGreaterThan(0);
        expect(histogram.value.count).toBeGreaterThan(0);
      }
    });
  });
});
