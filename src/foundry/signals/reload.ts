/**
 * Configuration Reload Helpers
 *
 * Implements restart-based config reload pattern with mandatory schema validation.
 * Per Crucible standard: validate before restart, reject invalid configs without disruption.
 */

import type { FallbackLogger, TelemetryEmitter } from "./windows.js";

/**
 * Configuration validator function type
 *
 * Applications provide this function to validate new config against schema.
 * Should return validation result with errors if invalid.
 */
export type ConfigValidator<T = unknown> = (
  config: T,
) => Promise<ConfigValidationResult> | ConfigValidationResult;

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
  }>;
}

/**
 * Configuration loader function type
 *
 * Applications provide this function to load new config from disk/environment.
 */
export type ConfigLoader<T = unknown> = () => Promise<T> | T;

/**
 * Config reload options
 */
export interface ConfigReloadOptions<T = unknown> {
  /**
   * Config loader function
   */
  loader: ConfigLoader<T>;

  /**
   * Schema validator function
   */
  validator: ConfigValidator<T>;

  /**
   * Callback invoked after successful validation, before exit
   * Use for cleanup, logging, etc.
   */
  onValidated?: (config: T) => void | Promise<void>;

  /**
   * Exit code for successful reload (default: 129 for SIGHUP)
   */
  exitCode?: number;

  /**
   * Logger for reload events
   */
  logger?: FallbackLogger;

  /**
   * Telemetry emitter
   */
  telemetry?: TelemetryEmitter;

  /**
   * Test mode (prevents process.exit)
   */
  testMode?: boolean;
}

/**
 * Config reload result (for testing)
 */
export interface ConfigReloadResult {
  reloaded: boolean;
  validationErrors?: Array<{ path: string; message: string }>;
  error?: Error;
}

/**
 * Create a config reload handler with schema validation
 *
 * Returns a signal handler function that implements restart-based reload:
 * 1. Load new config
 * 2. Validate against schema (mandatory)
 * 3. If invalid: log errors, continue with current config
 * 4. If valid: invoke callback, exit for restart
 *
 * @param options - Reload configuration
 *
 * @example
 * ```typescript
 * const reloadHandler = createConfigReloadHandler({
 *   loader: () => loadConfig('./config.yaml'),
 *   validator: (config) => validateConfigSchema(config),
 *   onValidated: async (config) => {
 *     logger.info('Config validated, restarting...');
 *   },
 *   logger: myLogger,
 * });
 *
 * await manager.register('SIGHUP', reloadHandler);
 * ```
 */
export function createConfigReloadHandler<T = unknown>(
  options: ConfigReloadOptions<T>,
): () => Promise<void> {
  const {
    loader,
    validator,
    onValidated,
    exitCode = 129,
    logger,
    telemetry,
    testMode = false,
  } = options;

  return async () => {
    // Log reload request
    if (logger) {
      logger.info("Config reload requested (SIGHUP)");
    }

    if (telemetry) {
      telemetry.emit("fulmen.signal.config_reload_requested", {
        signal: "SIGHUP",
      });
    }

    try {
      // Load new config
      const newConfig = await loader();

      // Validate against schema (mandatory)
      const result = await validator(newConfig);

      if (!result.valid) {
        // Invalid config - log and reject without restart
        if (logger) {
          logger.warn("Config validation failed - continuing with current config", {
            error_count: result.errors?.length ?? 0,
            errors: result.errors,
          });
        }

        if (telemetry) {
          telemetry.emit("fulmen.signal.config_reload_rejected", {
            signal: "SIGHUP",
            reason: "validation_failed",
            error_count: String(result.errors?.length ?? 0),
          });
        }

        return; // Don't exit - continue with current config
      }

      // Valid config - proceed with restart
      if (logger) {
        logger.info("Config validation succeeded - exiting for restart");
      }

      if (telemetry) {
        telemetry.emit("fulmen.signal.config_reload_accepted", {
          signal: "SIGHUP",
        });
      }

      // Invoke pre-restart callback
      if (onValidated) {
        await onValidated(newConfig);
      }

      // Exit for restart (process supervisor will restart with new config)
      if (!testMode) {
        process.exit(exitCode);
      }
    } catch (error) {
      // Config load or validation threw error
      if (logger) {
        logger.warn("Config reload failed with error - continuing with current config", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (telemetry) {
        telemetry.emit("fulmen.signal.config_reload_error", {
          signal: "SIGHUP",
          error_type: error instanceof Error ? error.constructor.name : "unknown",
        });
      }

      // Don't exit - continue with current config
    }
  };
}

/**
 * Three-strikes failure tracker
 *
 * Tracks consecutive config reload failures and triggers alerts.
 * Useful for detecting persistent config source issues.
 */
export class ConfigReloadTracker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private readonly maxFailures: number;
  private readonly logger?: FallbackLogger;
  private readonly telemetry?: TelemetryEmitter;

  constructor(options: {
    maxFailures?: number;
    logger?: FallbackLogger;
    telemetry?: TelemetryEmitter;
  }) {
    this.maxFailures = options.maxFailures ?? 3;
    this.logger = options.logger;
    this.telemetry = options.telemetry;
  }

  /**
   * Record a reload failure
   *
   * @returns true if threshold exceeded, false otherwise
   */
  recordFailure(): boolean {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.maxFailures) {
      if (this.logger) {
        this.logger.warn(
          `${this.failures} consecutive config reload failures - check config source`,
          {
            failure_count: this.failures,
            threshold: this.maxFailures,
          },
        );
      }

      if (this.telemetry) {
        this.telemetry.emit("fulmen.signal.config_reload_threshold_exceeded", {
          failure_count: String(this.failures),
          threshold: String(this.maxFailures),
        });
      }

      return true; // Threshold exceeded
    }

    return false;
  }

  /**
   * Record a successful reload (resets counter)
   */
  recordSuccess(): void {
    this.failures = 0;
    this.lastFailureTime = null;
  }

  /**
   * Get current failure count
   */
  getFailureCount(): number {
    return this.failures;
  }

  /**
   * Get last failure timestamp
   */
  getLastFailureTime(): number | null {
    return this.lastFailureTime;
  }
}
