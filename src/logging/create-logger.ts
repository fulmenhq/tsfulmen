/**
 * Factory function for creating loggers with progressive interface
 */

import { Logger } from "./logger.js";
import { RedactSecretsMiddleware } from "./middleware.js";
import { type LoggerConfig, LoggingProfile } from "./types.js";

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

/**
 * Create a structured logger with default redaction middleware
 *
 * Enables secure logging with gofulmen-aligned secret redaction patterns.
 * Child loggers inherit both middleware chain and bindings from parent.
 *
 * Default redaction patterns (can be disabled with useDefaultPatterns: false):
 * - SECRET_* environment variables
 * - *TOKEN*, *KEY* variants
 * - Base64 blobs (40+ characters)
 * - Email addresses
 * - Credit card numbers (13-19 digits)
 *
 * Default field names (case-insensitive):
 * - password, token, apiKey, authorization, secret
 * - cardNumber, cvv, ssn
 *
 * Middleware can modify event severity. The finalSeverity from middleware
 * output is honored in Pino logging, allowing middleware to downgrade noisy
 * errors to warnings or upgrade critical info to error.
 *
 * @param service - Service name
 * @param options - Configuration options
 * @returns Structured logger with redaction enabled
 *
 * @example
 * // Basic usage (default patterns)
 * const logger = createStructuredLoggerWithRedaction('api-server');
 *
 * @example
 * // Custom patterns only
 * const logger = createStructuredLoggerWithRedaction('api-server', {
 *   useDefaultPatterns: false,
 *   customPatterns: [/MY_CUSTOM_SECRET/g]
 * });
 *
 * @example
 * // Custom fields with default patterns
 * const logger = createStructuredLoggerWithRedaction('api-server', {
 *   customFields: ['internalId', 'customerKey']
 * });
 *
 * @example
 * // With file output
 * const logger = createStructuredLoggerWithRedaction('api-server', {
 *   filePath: '/var/log/app.log'
 * });
 */
export function createStructuredLoggerWithRedaction(
  service: string,
  options?: {
    filePath?: string;
    customPatterns?: RegExp[];
    customFields?: string[];
    useDefaultPatterns?: boolean; // default: true
  },
): Logger {
  return new Logger({
    service,
    profile: LoggingProfile.STRUCTURED,
    filePath: options?.filePath,
    middleware: [
      new RedactSecretsMiddleware({
        secretKeys: options?.customFields,
        patterns: options?.customPatterns,
        useDefaultPatterns: options?.useDefaultPatterns,
      }),
    ],
  });
}
