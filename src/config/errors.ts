/**
 * Config Path API errors - implements Fulmen Config Path Standard error handling
 */

/**
 * Base error class for config path operations
 */
export class ConfigPathError extends Error {
  constructor(
    message: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = 'ConfigPathError';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigPathError);
    }
  }

  /**
   * Create error for invalid application identifier
   */
  static invalidAppIdentifier(identifier: unknown): ConfigPathError {
    return new ConfigPathError(
      `Invalid application identifier: ${JSON.stringify(identifier)}. Expected { vendor: string, app: string }`,
    );
  }

  /**
   * Create error for invalid vendor/app names
   */
  static invalidName(name: string, type: 'vendor' | 'app'): ConfigPathError {
    return new ConfigPathError(
      `Invalid ${type} name: "${name}". Must be lowercase kebab-case (e.g., 'fulmenhq', 'my-app')`,
    );
  }

  /**
   * Create error for home directory detection failure
   */
  static homeDirNotFound(): ConfigPathError {
    return new ConfigPathError(
      'Unable to determine home directory. Please set HOME environment variable.',
    );
  }

  /**
   * Create error for directory creation failure
   */
  static directoryCreationFailed(path: string, cause: Error): ConfigPathError {
    return new ConfigPathError(`Failed to create directory: ${path}`, cause);
  }

  /**
   * Create error for invalid environment variable
   */
  static invalidEnvVar(varName: string, value: string): ConfigPathError {
    return new ConfigPathError(
      `Invalid environment variable ${varName}: ${value}. Path must be absolute and within user home directory.`,
    );
  }
}
