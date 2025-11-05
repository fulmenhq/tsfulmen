/**
 * Application Identity Types
 *
 * TypeScript interfaces matching the Crucible app-identity schema v1.0.0
 */

/**
 * Repository category taxonomy from Fulmen standards
 */
export type RepositoryCategory =
  | 'cli'
  | 'workhorse'
  | 'service'
  | 'library'
  | 'pipeline'
  | 'codex'
  | 'sdk';

/**
 * Python-specific packaging metadata
 * Field names use snake_case to match Crucible schema
 */
export interface PythonMetadata {
  readonly distribution_name?: string;
  readonly package_name?: string;
  readonly console_scripts?: ReadonlyArray<{
    readonly name: string;
    readonly entry_point: string;
  }>;
}

/**
 * Required application identity fields
 *
 * All fields are readonly to enforce immutability
 * Field names use snake_case to match Crucible schema
 */
export interface AppIdentity {
  /**
   * Lowercase kebab-case binary/executable name
   * Pattern: ^[a-z][a-z0-9-]{0,62}[a-z0-9]$
   */
  readonly binary_name: string;

  /**
   * Lowercase alphanumeric vendor namespace (no hyphens)
   * Pattern: ^[a-z][a-z0-9]{0,62}[a-z0-9]$
   */
  readonly vendor: string;

  /**
   * Uppercase environment variable prefix (must end with _)
   * Pattern: ^[A-Z][A-Z0-9_]*_$
   */
  readonly env_prefix: string;

  /**
   * Filesystem-safe config directory name
   * Pattern: ^[a-z][a-z0-9-]{0,62}[a-z0-9]$
   */
  readonly config_name: string;

  /**
   * One-line application description (10-200 chars)
   */
  readonly description: string;
}

/**
 * Optional metadata fields
 *
 * Additional properties are allowed for extensibility
 * Field names use snake_case to match Crucible schema
 */
export interface IdentityMetadata {
  readonly project_url?: string;
  readonly support_email?: string;
  readonly license?: string;
  readonly repository_category?: RepositoryCategory;
  readonly telemetry_namespace?: string;
  readonly registry_id?: string; // UUIDv7
  readonly python?: PythonMetadata;
  readonly [key: string]: unknown;
}

/**
 * Complete application identity document
 */
export interface Identity {
  readonly app: AppIdentity;
  readonly metadata?: IdentityMetadata;
}

/**
 * Options for loading identity
 */
export interface LoadIdentityOptions {
  /**
   * Explicit path override
   * Highest priority in discovery algorithm
   */
  readonly path?: string;

  /**
   * Test injection - bypass filesystem and discovery
   * Never cached
   */
  readonly identity?: Identity;

  /**
   * Starting directory for ancestor search
   * Defaults to process.cwd()
   */
  readonly startDir?: string;

  /**
   * Force reload, bypass cache
   * Useful for testing cache behavior
   */
  readonly skipCache?: boolean;

  /**
   * Skip schema validation (dangerous)
   * Only use for testing or when identity is pre-validated
   */
  readonly skipValidation?: boolean;
}
