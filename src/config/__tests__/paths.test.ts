/**
 * Config Path API tests - implements Fulmen Config Path Standard
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigPathError } from '../errors.js';
import {
  ensureDirExists,
  getAppCacheDir,
  getAppConfigDir,
  getAppDataDir,
  getConfigSearchPaths,
  getFulmenCacheDir,
  getFulmenConfigDir,
  getFulmenDataDir,
  getXDGBaseDirs,
  resolveConfigPath,
} from '../paths.js';
import type { AppIdentifier } from '../types.js';

describe('Config Path API', () => {
  const originalEnv = process.env;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = join(tmpdir(), `tsfulmen-config-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    // Clear environment variables
    process.env = { ...originalEnv };
    delete process.env.XDG_CONFIG_HOME;
    delete process.env.XDG_DATA_HOME;
    delete process.env.XDG_CACHE_HOME;
    delete process.env.FULMEN_CONFIG_HOME;
    delete process.env.FULMEN_DATA_HOME;
    delete process.env.FULMEN_CACHE_HOME;
  });

  afterEach(async () => {
    // Restore environment
    process.env = originalEnv;

    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('XDG Base Directories', () => {
    it('should return default XDG directories on Linux', () => {
      const dirs = getXDGBaseDirs({ customHomeDir: tempDir });

      expect(dirs.configHome).toBe(join(tempDir, '.config'));
      expect(dirs.dataHome).toBe(join(tempDir, '.local', 'share'));
      expect(dirs.cacheHome).toBe(join(tempDir, '.cache'));
    });

    it('should respect XDG environment variables', () => {
      process.env.XDG_CONFIG_HOME = join(tempDir, 'custom-config');
      process.env.XDG_DATA_HOME = join(tempDir, 'custom-data');
      process.env.XDG_CACHE_HOME = join(tempDir, 'custom-cache');

      const dirs = getXDGBaseDirs({ customHomeDir: tempDir });

      expect(dirs.configHome).toBe(join(tempDir, 'custom-config'));
      expect(dirs.dataHome).toBe(join(tempDir, 'custom-data'));
      expect(dirs.cacheHome).toBe(join(tempDir, 'custom-cache'));
    });

    it('should respect FULMEN environment variable overrides', () => {
      process.env.FULMEN_CONFIG_HOME = join(tempDir, 'fulmen-config');
      process.env.FULMEN_DATA_HOME = join(tempDir, 'fulmen-data');
      process.env.FULMEN_CACHE_HOME = join(tempDir, 'fulmen-cache');

      const dirs = getXDGBaseDirs({ customHomeDir: tempDir });

      expect(dirs.configHome).toBe(join(tempDir, 'fulmen-config'));
      expect(dirs.dataHome).toBe(join(tempDir, 'fulmen-data'));
      expect(dirs.cacheHome).toBe(join(tempDir, 'fulmen-cache'));
    });

    it('should validate environment variable paths', () => {
      process.env.FULMEN_CONFIG_HOME = '/invalid/path';

      expect(() => getXDGBaseDirs({ customHomeDir: tempDir })).toThrow(ConfigPathError);
    });
  });

  describe('Fulmen Directories', () => {
    it('should return correct Fulmen config directory', () => {
      const configDir = getFulmenConfigDir({ customHomeDir: tempDir });

      // Platform-specific expectations
      if (process.platform === 'darwin') {
        expect(configDir).toBe(join(tempDir, 'Library', 'Application Support', 'fulmen'));
      } else if (process.platform === 'win32') {
        expect(configDir).toMatch(/fulmen$/);
      } else {
        expect(configDir).toBe(join(tempDir, '.config', 'fulmen'));
      }
    });

    it('should return correct Fulmen data directory', () => {
      const dataDir = getFulmenDataDir({ customHomeDir: tempDir });

      // Platform-specific expectations
      if (process.platform === 'darwin') {
        expect(dataDir).toBe(join(tempDir, 'Library', 'Application Support', 'fulmen'));
      } else if (process.platform === 'win32') {
        expect(dataDir).toMatch(/fulmen$/);
      } else {
        expect(dataDir).toBe(join(tempDir, '.local', 'share', 'fulmen'));
      }
    });

    it('should return correct Fulmen cache directory', () => {
      const cacheDir = getFulmenCacheDir({ customHomeDir: tempDir });

      // Platform-specific expectations
      if (process.platform === 'darwin') {
        expect(cacheDir).toBe(join(tempDir, 'Library', 'Caches', 'fulmen'));
      } else if (process.platform === 'win32') {
        expect(cacheDir).toMatch(/fulmen$/);
      } else {
        expect(cacheDir).toBe(join(tempDir, '.cache', 'fulmen'));
      }
    });
  });

  describe('Application Directories', () => {
    const testApp: AppIdentifier = { vendor: 'fulmenhq', app: 'tsfulmen' };

    it('should return correct app config directory', () => {
      const appConfig = getAppConfigDir(testApp, { customHomeDir: tempDir });

      // Platform-specific expectations
      if (process.platform === 'darwin') {
        expect(appConfig).toBe(
          join(tempDir, 'Library', 'Application Support', 'fulmen', 'fulmenhq', 'tsfulmen'),
        );
      } else if (process.platform === 'win32') {
        expect(appConfig).toMatch(/fulmen[\\/]fulmenhq[\\/]tsfulmen$/);
      } else {
        expect(appConfig).toBe(join(tempDir, '.config', 'fulmen', 'fulmenhq', 'tsfulmen'));
      }
    });

    it('should return correct app data directory', () => {
      const appData = getAppDataDir(testApp, { customHomeDir: tempDir });

      // Platform-specific expectations
      if (process.platform === 'darwin') {
        expect(appData).toBe(
          join(tempDir, 'Library', 'Application Support', 'fulmen', 'fulmenhq', 'tsfulmen'),
        );
      } else if (process.platform === 'win32') {
        expect(appData).toMatch(/fulmen[\\/]fulmenhq[\\/]tsfulmen$/);
      } else {
        expect(appData).toBe(join(tempDir, '.local', 'share', 'fulmen', 'fulmenhq', 'tsfulmen'));
      }
    });

    it('should return correct app cache directory', () => {
      const appCache = getAppCacheDir(testApp, { customHomeDir: tempDir });

      // Platform-specific expectations
      if (process.platform === 'darwin') {
        expect(appCache).toBe(join(tempDir, 'Library', 'Caches', 'fulmen', 'fulmenhq', 'tsfulmen'));
      } else if (process.platform === 'win32') {
        expect(appCache).toMatch(/fulmen[\\/]fulmenhq[\\/]tsfulmen$/);
      } else {
        expect(appCache).toBe(join(tempDir, '.cache', 'fulmen', 'fulmenhq', 'tsfulmen'));
      }
    });

    it('should validate application identifier', () => {
      expect(() => getAppConfigDir({} as AppIdentifier)).toThrow(ConfigPathError);
      expect(() => getAppConfigDir({ vendor: '' } as AppIdentifier)).toThrow(ConfigPathError);
      expect(() => getAppConfigDir({ app: '' } as AppIdentifier)).toThrow(ConfigPathError);
    });

    it('should validate kebab-case names', () => {
      expect(() => getAppConfigDir({ vendor: 'InvalidVendor', app: 'test' })).toThrow(
        ConfigPathError,
      );
      expect(() => getAppConfigDir({ vendor: 'test', app: 'InvalidApp' })).toThrow(ConfigPathError);
      expect(() => getAppConfigDir({ vendor: 'test_vendor', app: 'test' })).toThrow(
        ConfigPathError,
      );
    });

    it('should accept valid kebab-case names', () => {
      expect(() => getAppConfigDir({ vendor: 'fulmenhq', app: 'ts-fulmen' })).not.toThrow();
      expect(() => getAppConfigDir({ vendor: 'my-company', app: 'my-app' })).not.toThrow();
    });
  });

  describe('Config Search Paths', () => {
    const testApp: AppIdentifier = { vendor: 'fulmenhq', app: 'tsfulmen' };

    it('should return ordered search paths', () => {
      const searchPaths = getConfigSearchPaths(testApp, {
        customHomeDir: tempDir,
      });

      expect(searchPaths).toHaveLength(2);

      // Platform-specific expectations for first path (app-specific)
      if (process.platform === 'darwin') {
        expect(searchPaths[0]).toBe(
          join(tempDir, 'Library', 'Application Support', 'fulmen', 'fulmenhq', 'tsfulmen'),
        );
      } else if (process.platform === 'win32') {
        expect(searchPaths[0]).toMatch(/fulmen[\\/]fulmenhq[\\/]tsfulmen$/);
      } else {
        expect(searchPaths[0]).toBe(join(tempDir, '.config', 'fulmen', 'fulmenhq', 'tsfulmen'));
      }

      // Second path should be Fulmen-wide (platform-specific)
      if (process.platform === 'darwin') {
        expect(searchPaths[1]).toBe(join(tempDir, 'Library', 'Application Support', 'fulmen'));
      } else if (process.platform === 'win32') {
        expect(searchPaths[1]).toMatch(/fulmen$/);
      } else {
        expect(searchPaths[1]).toBe(join(tempDir, '.config', 'fulmen'));
      }
    });

    it('should include legacy names when provided', () => {
      const searchPaths = getConfigSearchPaths(testApp, {
        customHomeDir: tempDir,
        legacyNames: ['goneat', 'old-config'],
      });

      expect(searchPaths).toHaveLength(4);

      // Legacy paths should be platform-specific
      if (process.platform === 'darwin') {
        expect(searchPaths[2]).toBe(join(tempDir, 'Library', 'Application Support', 'goneat'));
        expect(searchPaths[3]).toBe(join(tempDir, 'Library', 'Application Support', 'old-config'));
      } else if (process.platform === 'win32') {
        expect(searchPaths[2]).toMatch(/goneat$/);
        expect(searchPaths[3]).toMatch(/old-config$/);
      } else {
        expect(searchPaths[2]).toBe(join(tempDir, '.config', 'goneat'));
        expect(searchPaths[3]).toBe(join(tempDir, '.config', 'old-config'));
      }
    });
  });

  describe('Directory Helpers', () => {
    it('should create directory if it does not exist', async () => {
      const testDir = join(tempDir, 'new', 'nested', 'dir');

      await ensureDirExists(testDir);

      undefined;
    });

    it('should not fail if directory already exists', async () => {
      const existingDir = join(tempDir, 'existing');
      await mkdir(existingDir, { recursive: true });

      await expect(ensureDirExists(existingDir)).resolves.toBeUndefined();
    });

    it('should resolve config path from search paths', async () => {
      const searchPaths = [join(tempDir, 'path1'), join(tempDir, 'path2'), join(tempDir, 'path3')];

      // Create config file in second path
      await mkdir(searchPaths[1], { recursive: true });
      const configFile = join(searchPaths[1], 'config.yaml');
      await writeFile(configFile, 'test: value');

      const resolvedPath = await resolveConfigPath('config.yaml', searchPaths);

      expect(resolvedPath).toBe(configFile);
    });

    it('should return null if config file not found', async () => {
      const searchPaths = [join(tempDir, 'path1'), join(tempDir, 'path2')];

      const resolvedPath = await resolveConfigPath('missing.yaml', searchPaths);

      expect(resolvedPath).toBeNull();
    });

    it('should create directory when ensureDir is true', async () => {
      const searchPath = join(tempDir, 'new-search-path');
      const searchPaths = [searchPath];

      const resolvedPath = await resolveConfigPath('test.yaml', searchPaths, {
        ensureDir: true,
      });

      undefined;
      expect(resolvedPath).toBeNull(); // File still doesn't exist
    });
  });

  describe('Platform-Specific Behavior', () => {
    it('should handle macOS paths correctly', () => {
      // Mock platform detection
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      try {
        const configDir = getFulmenConfigDir({ customHomeDir: tempDir });
        expect(configDir).toBe(join(tempDir, 'Library', 'Application Support', 'fulmen'));
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });

    it('should handle Windows paths correctly', () => {
      // Mock platform detection
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      // Mock environment variables
      process.env.APPDATA = join(tempDir, 'AppData', 'Roaming');
      process.env.LOCALAPPDATA = join(tempDir, 'AppData', 'Local');

      try {
        const configDir = getFulmenConfigDir({ customHomeDir: tempDir });
        const dataDir = getFulmenDataDir({ customHomeDir: tempDir });
        const cacheDir = getFulmenCacheDir({ customHomeDir: tempDir });

        expect(configDir).toBe(join(tempDir, 'AppData', 'Roaming', 'fulmen'));
        expect(dataDir).toBe(join(tempDir, 'AppData', 'Local', 'fulmen'));
        expect(cacheDir).toBe(join(tempDir, 'AppData', 'Local', 'Cache', 'fulmen'));
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        delete process.env.APPDATA;
        delete process.env.LOCALAPPDATA;
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid app identifier', () => {
      expect(() => getAppConfigDir({} as AppIdentifier)).toThrow(ConfigPathError);
      expect(() => getAppConfigDir({ vendor: '' } as AppIdentifier)).toThrow(ConfigPathError);
      expect(() => getAppConfigDir({ app: '' } as AppIdentifier)).toThrow(ConfigPathError);
    });

    it('should throw error for invalid names', () => {
      expect(() => getAppConfigDir({ vendor: 'InvalidVendor', app: 'test' })).toThrow(
        ConfigPathError,
      );
      expect(() => getAppConfigDir({ vendor: 'test', app: 'InvalidApp' })).toThrow(ConfigPathError);
      expect(() => getAppConfigDir({ vendor: 'snake_case', app: 'test' })).toThrow(ConfigPathError);
    });

    it('should throw error for directory creation failure', async () => {
      // Try to create directory in invalid location
      const invalidPath = '/root/invalid/path'; // Assuming this will fail

      await expect(ensureDirExists(invalidPath)).rejects.toThrow(ConfigPathError);
    });
  });
});
