/**
 * Application Identity Errors
 *
 * Module-specific error classes for identity operations
 */

import { FulmenError, type FulmenErrorData } from '../errors/index.js';
import type { SchemaValidationDiagnostic } from '../schema/types.js';

/**
 * Base error class for app identity operations
 */
export class AppIdentityError extends FulmenError {
  public readonly identityPath?: string;

  constructor(message: string, identityPath?: string, cause?: Error) {
    // Build FulmenErrorData
    let errorData: FulmenErrorData;

    if (cause) {
      errorData = FulmenError.fromError(cause, {
        code: 'APP_IDENTITY_ERROR',
        severity: 'high',
        context: { identityPath },
      }).data;
    } else {
      errorData = {
        code: 'APP_IDENTITY_ERROR',
        message,
        severity: 'high',
        timestamp: new Date().toISOString(),
        context: { identityPath },
      };
    }

    super(errorData);
    this.name = 'AppIdentityError';
    this.identityPath = identityPath;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppIdentityError);
    }
  }

  /**
   * Create error for identity not found
   */
  static notFound(searchedPaths: string[]): AppIdentityError {
    const message = `App identity not found\nSearched paths:\n${searchedPaths.map((p) => `  - ${p}`).join('\n')}`;
    return new AppIdentityError(message);
  }

  /**
   * Create error for schema validation failure
   */
  static validationFailed(
    path: string,
    diagnostics: SchemaValidationDiagnostic[],
  ): AppIdentityError {
    const errorCount = diagnostics.filter((d) => d.severity === 'ERROR').length;
    const warningCount = diagnostics.filter((d) => d.severity === 'WARN').length;

    let message = `Invalid app identity: ${path}\n`;
    message += `Validation errors: ${errorCount} error(s), ${warningCount} warning(s)\n`;

    // Include first few diagnostics
    const displayDiagnostics = diagnostics.slice(0, 3);
    for (const diag of displayDiagnostics) {
      message += `  - ${diag.message}`;
      if (diag.pointer) {
        message += ` at ${diag.pointer}`;
      }
      message += '\n';
    }

    if (diagnostics.length > 3) {
      message += `  ... and ${diagnostics.length - 3} more\n`;
    }

    return new AppIdentityError(message, path);
  }

  /**
   * Create error for environment variable override pointing to missing file
   */
  static envOverrideMissing(envPath: string): AppIdentityError {
    const message = `FULMEN_APP_IDENTITY_PATH points to missing file: ${envPath}\n`;
    return new AppIdentityError(message, envPath);
  }

  /**
   * Create error for YAML parsing failure
   */
  static parseFailed(path: string, cause: Error): AppIdentityError {
    const message = `Failed to parse identity file: ${path}\n${cause.message}`;
    return new AppIdentityError(message, path, cause);
  }

  /**
   * Create error for file read failure
   */
  static readFailed(path: string, cause: Error): AppIdentityError {
    const message = `Failed to read identity file: ${path}\n${cause.message}`;
    return new AppIdentityError(message, path, cause);
  }
}
