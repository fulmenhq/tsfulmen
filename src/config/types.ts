/**
 * Config Path API types - implements Fulmen Config Path Standard
 */

/**
 * Application identifier for directory resolution
 */
export interface AppIdentifier {
  /** Vendor/organization name (e.g., 'fulmenhq', 'mycompany') */
  vendor: string;
  /** Application name (e.g., 'gofulmen', 'myapp') */
  app: string;
}

/**
 * XDG Base directories
 */
export interface XDGBaseDirs {
  /** Configuration home directory */
  configHome: string;
  /** Data home directory */
  dataHome: string;
  /** Cache home directory */
  cacheHome: string;
}

/**
 * Platform-specific directory information
 */
export interface PlatformDirs {
  /** Operating system platform */
  platform: 'linux' | 'darwin' | 'win32' | 'unknown';
  /** Home directory path */
  homeDir: string;
  /** XDG environment variables (if available) */
  xdgEnv?: {
    XDG_CONFIG_HOME?: string;
    XDG_DATA_HOME?: string;
    XDG_CACHE_HOME?: string;
  };
  /** Windows environment variables (if available) */
  winEnv?: {
    APPDATA?: string;
    LOCALAPPDATA?: string;
  };
}

/**
 * Configuration path resolution options
 */
export interface ConfigPathOptions {
  /** Whether to create directories if they don't exist */
  ensureExists?: boolean;
  /** Legacy application names for migration support */
  legacyNames?: string[];
  /** Custom home directory (for testing) */
  customHomeDir?: string;
}
