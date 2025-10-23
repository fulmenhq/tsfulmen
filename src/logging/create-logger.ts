/**
 * Factory function for creating loggers with progressive interface
 */

import { Logger } from './logger.js';
import { type LoggerConfig, LoggingProfile } from './types.js';

/**
 * Create a logger with the specified configuration
 *
 * @param config - Logger configuration
 * @returns Configured logger instance
 *
 * @example
 * // Simple logger for CLI
 * const logger = createLogger({
 *   service: 'mycli',
 *   profile: LoggingProfile.SIMPLE
 * });
 *
 * @example
 * // Structured logger with file output
 * const logger = createLogger({
 *   service: 'myapp',
 *   profile: LoggingProfile.STRUCTURED,
 *   filePath: '/var/log/app.log'
 * });
 */
export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config);
}

/**
 * Create a simple logger for CLI tools
 *
 * @param service - Service name
 * @returns Simple logger instance
 */
export function createSimpleLogger(service: string): Logger {
  return new Logger({
    service,
    profile: LoggingProfile.SIMPLE,
  });
}

/**
 * Create a structured logger with JSON output
 *
 * @param service - Service name
 * @param filePath - Optional file path for log output
 * @returns Structured logger instance
 */
export function createStructuredLogger(service: string, filePath?: string): Logger {
  return new Logger({
    service,
    profile: LoggingProfile.STRUCTURED,
    filePath,
  });
}

/**
 * Create an enterprise logger with full features
 *
 * @param service - Service name
 * @param options - Enterprise options (sinks, middleware, etc.)
 * @returns Enterprise logger instance
 */
export function createEnterpriseLogger(
  service: string,
  options?: {
    // biome-ignore lint/suspicious/noExplicitAny: Phase 1 - Sink type to be properly defined in Phase 2
    sinks?: any[];
    // biome-ignore lint/suspicious/noExplicitAny: Phase 1 - Middleware type to be properly defined in Phase 2
    middleware?: any[];
  },
): Logger {
  return new Logger({
    service,
    profile: LoggingProfile.ENTERPRISE,
    ...options,
  });
}
