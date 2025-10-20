/**
 * Config Path API - implements Fulmen Config Path Standard
 *
 * Provides cross-platform directory resolution for Fulmen configuration, data, and cache directories
 * with XDG Base Directory specification compliance.
 */

import { homedir } from 'node:os';
import { join, resolve, isAbsolute } from 'node:path';
import { mkdir, access } from 'node:fs/promises';
import type { AppIdentifier, XDGBaseDirs, PlatformDirs, ConfigPathOptions } from './types.js';
import { ConfigPathError } from './errors.js';

/**
 * Get platform information and environment variables
 */
function getPlatformInfo(): PlatformDirs {
  const osPlatform = process.platform;
  const homeDir = homedir();

  if (!homeDir) {
    throw ConfigPathError.homeDirNotFound();
  }

  const platformInfo: PlatformDirs = {
    platform:
      osPlatform === 'linux'
        ? 'linux'
        : osPlatform === 'darwin'
          ? 'darwin'
          : osPlatform === 'win32'
            ? 'win32'
            : 'unknown',
    homeDir,
  };

  // XDG environment variables (Linux/Unix)
  if (osPlatform === 'linux') {
    platformInfo.xdgEnv = {
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
      XDG_DATA_HOME: process.env.XDG_DATA_HOME,
      XDG_CACHE_HOME: process.env.XDG_CACHE_HOME,
    };
  }

  // Windows environment variables
  if (osPlatform === 'win32') {
    platformInfo.winEnv = {
      APPDATA: process.env.APPDATA,
      LOCALAPPDATA: process.env.LOCALAPPDATA,
    };
  }

  return platformInfo;
}

/**
 * Validate vendor and app names according to kebab-case convention
 */
function validateKebabCase(name: string, type: 'vendor' | 'app'): void {
  if (!name || typeof name !== 'string') {
    throw ConfigPathError.invalidName(name, type);
  }

  // Must be lowercase and contain only letters, numbers, and hyphens
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw ConfigPathError.invalidName(name, type);
  }
}

/**
 * Validate application identifier
 */
function validateAppIdentifier(app: AppIdentifier): void {
  if (!app || typeof app !== 'object') {
    throw ConfigPathError.invalidAppIdentifier(app);
  }

  if (!app.vendor || !app.app) {
    throw ConfigPathError.invalidAppIdentifier(app);
  }

  validateKebabCase(app.vendor, 'vendor');
  validateKebabCase(app.app, 'app');
}

/**
 * Validate environment variable override path
 */
function validateEnvVarPath(path: string, varName: string, homeDir: string): void {
  if (!isAbsolute(path)) {
    throw ConfigPathError.invalidEnvVar(varName, path);
  }

  // Security: ensure path is within home directory unless explicitly allowed
  // Normalize paths for case-insensitive comparison on Windows
  const resolvedPath = resolve(path);
  const resolvedHome = resolve(homeDir);

  // Case-insensitive comparison for Windows, case-sensitive for Unix-like systems
  const isWindows = process.platform === 'win32';
  const normalizedPath = isWindows ? resolvedPath.toLowerCase() : resolvedPath;
  const normalizedHome = isWindows ? resolvedHome.toLowerCase() : resolvedHome;

  if (!normalizedPath.startsWith(normalizedHome)) {
    throw ConfigPathError.invalidEnvVar(varName, path);
  }
}

/**
 * Get XDG base directories with environment variable overrides
 */
export function getXDGBaseDirs(options: ConfigPathOptions = {}): XDGBaseDirs {
  const platformInfo = getPlatformInfo();
  const homeDir = options.customHomeDir || platformInfo.homeDir;

  // Environment variable overrides take precedence
  const configHome =
    process.env.FULMEN_CONFIG_HOME || process.env.XDG_CONFIG_HOME || join(homeDir, '.config');

  const dataHome =
    process.env.FULMEN_DATA_HOME || process.env.XDG_DATA_HOME || join(homeDir, '.local', 'share');

  const cacheHome =
    process.env.FULMEN_CACHE_HOME || process.env.XDG_CACHE_HOME || join(homeDir, '.cache');

  // Validate environment variable overrides
  if (process.env.FULMEN_CONFIG_HOME) {
    validateEnvVarPath(configHome, 'FULMEN_CONFIG_HOME', homeDir);
  }
  if (process.env.FULMEN_DATA_HOME) {
    validateEnvVarPath(dataHome, 'FULMEN_DATA_HOME', homeDir);
  }
  if (process.env.FULMEN_CACHE_HOME) {
    validateEnvVarPath(cacheHome, 'FULMEN_CACHE_HOME', homeDir);
  }

  return {
    configHome,
    dataHome,
    cacheHome,
  };
}

/**
 * Get platform-specific base directories
 */
function getPlatformBaseDirs(options: ConfigPathOptions = {}): XDGBaseDirs {
  const platformInfo = getPlatformInfo();
  const homeDir = options.customHomeDir || platformInfo.homeDir;

  switch (platformInfo.platform) {
    case 'darwin': {
      // macOS: ~/Library/Application Support for config and data
      const appSupport = join(homeDir, 'Library', 'Application Support');
      const cacheSupport = join(homeDir, 'Library', 'Caches');

      // Start with platform defaults
      let configHome = appSupport;
      let dataHome = appSupport;
      let cacheHome = cacheSupport;

      // Apply environment variable overrides with validation
      if (process.env.FULMEN_CONFIG_HOME) {
        validateEnvVarPath(process.env.FULMEN_CONFIG_HOME, 'FULMEN_CONFIG_HOME', homeDir);
        configHome = process.env.FULMEN_CONFIG_HOME;
      }
      if (process.env.FULMEN_DATA_HOME) {
        validateEnvVarPath(process.env.FULMEN_DATA_HOME, 'FULMEN_DATA_HOME', homeDir);
        dataHome = process.env.FULMEN_DATA_HOME;
      }
      if (process.env.FULMEN_CACHE_HOME) {
        validateEnvVarPath(process.env.FULMEN_CACHE_HOME, 'FULMEN_CACHE_HOME', homeDir);
        cacheHome = process.env.FULMEN_CACHE_HOME;
      }

      return { configHome, dataHome, cacheHome };
    }

    case 'win32': {
      // Windows: %APPDATA% for config, %LOCALAPPDATA% for data and cache
      const appData = platformInfo.winEnv?.APPDATA || join(homeDir, 'AppData', 'Roaming');
      const localAppData = platformInfo.winEnv?.LOCALAPPDATA || join(homeDir, 'AppData', 'Local');
      const cacheDir = join(localAppData, 'Cache');

      // Start with platform defaults
      let configHome = appData;
      let dataHome = localAppData;
      let cacheHome = cacheDir;

      // Apply environment variable overrides with validation
      if (process.env.FULMEN_CONFIG_HOME) {
        validateEnvVarPath(process.env.FULMEN_CONFIG_HOME, 'FULMEN_CONFIG_HOME', homeDir);
        configHome = process.env.FULMEN_CONFIG_HOME;
      }
      if (process.env.FULMEN_DATA_HOME) {
        validateEnvVarPath(process.env.FULMEN_DATA_HOME, 'FULMEN_DATA_HOME', homeDir);
        dataHome = process.env.FULMEN_DATA_HOME;
      }
      if (process.env.FULMEN_CACHE_HOME) {
        validateEnvVarPath(process.env.FULMEN_CACHE_HOME, 'FULMEN_CACHE_HOME', homeDir);
        cacheHome = process.env.FULMEN_CACHE_HOME;
      }

      return { configHome, dataHome, cacheHome };
    }

    case 'linux':
      // Linux: use XDG (already includes validation)
      return getXDGBaseDirs(options);

    default:
      // Fallback: use XDG (Linux-style, already includes validation)
      return getXDGBaseDirs(options);
  }
}

/**
 * Get Fulmen-specific config directory
 */
export function getFulmenConfigDir(options: ConfigPathOptions = {}): string {
  const baseDirs = getPlatformBaseDirs(options);
  return join(baseDirs.configHome, 'fulmen');
}

/**
 * Get Fulmen-specific data directory
 */
export function getFulmenDataDir(options: ConfigPathOptions = {}): string {
  const baseDirs = getPlatformBaseDirs(options);
  return join(baseDirs.dataHome, 'fulmen');
}

/**
 * Get Fulmen-specific cache directory
 */
export function getFulmenCacheDir(options: ConfigPathOptions = {}): string {
  const baseDirs = getPlatformBaseDirs(options);
  return join(baseDirs.cacheHome, 'fulmen');
}

/**
 * Get application-specific config directory
 */
export function getAppConfigDir(app: AppIdentifier, options: ConfigPathOptions = {}): string {
  validateAppIdentifier(app);
  const fulmenConfig = getFulmenConfigDir(options);
  return join(fulmenConfig, app.vendor, app.app);
}

/**
 * Get application-specific data directory
 */
export function getAppDataDir(app: AppIdentifier, options: ConfigPathOptions = {}): string {
  validateAppIdentifier(app);
  const fulmenData = getFulmenDataDir(options);
  return join(fulmenData, app.vendor, app.app);
}

/**
 * Get application-specific cache directory
 */
export function getAppCacheDir(app: AppIdentifier, options: ConfigPathOptions = {}): string {
  validateAppIdentifier(app);
  const fulmenCache = getFulmenCacheDir(options);
  return join(fulmenCache, app.vendor, app.app);
}

/**
 * Get ordered list of config search paths for an application
 */
export function getConfigSearchPaths(
  app: AppIdentifier,
  options: ConfigPathOptions = {},
): string[] {
  validateAppIdentifier(app);

  const paths: string[] = [];

  // 1. Application-specific config directory (highest priority)
  paths.push(getAppConfigDir(app, options));

  // 2. Fulmen-wide config directory
  paths.push(getFulmenConfigDir(options));

  // 3. Legacy names for migration support
  if (options.legacyNames) {
    for (const legacyName of options.legacyNames) {
      const baseDirs = getPlatformBaseDirs(options);
      paths.push(join(baseDirs.configHome, legacyName));
    }
  }

  return paths;
}

/**
 * Ensure directory exists (create if necessary)
 */
export async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await access(dirPath);
    // Directory exists, nothing to do
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      // Directory doesn't exist, create it
      try {
        await mkdir(dirPath, { recursive: true });
      } catch (mkdirError) {
        throw ConfigPathError.directoryCreationFailed(dirPath, mkdirError as Error);
      }
    } else {
      // Other error (permission issues, etc.)
      throw ConfigPathError.directoryCreationFailed(dirPath, nodeError);
    }
  }
}

/**
 * Resolve config file path with search path logic
 */
export async function resolveConfigPath(
  filename: string,
  searchPaths: string[],
  options: { ensureDir?: boolean } = {},
): Promise<string | null> {
  for (const searchPath of searchPaths) {
    if (options.ensureDir) {
      await ensureDirExists(searchPath);
    }

    const fullPath = join(searchPath, filename);
    try {
      await access(fullPath);
      return fullPath;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'ENOENT') {
        // Re-throw non-file-not-found errors
        throw error;
      }
      // File not found, continue to next path
    }
  }

  return null;
}
