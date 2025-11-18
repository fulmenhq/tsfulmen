/**
 * Core types for progressive logging interface
 */

/**
 * Logging profile enum matching cross-language standard
 */
export enum LoggingProfile {
  /**
   * Basic logging for CLI tools and simple applications.
   *
   * Features:
   * - Console output only
   * - Basic severity levels (DEBUG, INFO, WARN, ERROR)
   * - Simple string formatting
   * - No correlation/middleware support
   */
  SIMPLE = "simple",

  /**
   * Structured logging with basic enterprise features.
   *
   * Features:
   * - JSON output with core envelope fields
   * - Correlation and request IDs
   * - Basic middleware (redaction)
   * - Console and file sinks
   * - No throttling/advanced features
   */
  STRUCTURED = "structured",

  /**
   * Full enterprise logging with all features.
   *
   * Features:
   * - Complete JSON envelope (20+ fields)
   * - Full correlation/trace support
   * - Complete middleware pipeline
   * - Multiple sink types with rotation
   * - Throttling and backpressure
   * - Performance optimization
   */
  ENTERPRISE = "enterprise",

  /**
   * User-defined configuration with explicit parameters.
   *
   * Features:
   * - Full parameter control
   * - Custom sink/middleware combinations
   * - Advanced configuration options
   */
  CUSTOM = "custom",
}

/**
 * Base logger configuration
 */
export interface BaseLoggerConfig {
  service: string;
  profile: LoggingProfile;
  policyFile?: string;
}

/**
 * Profile-specific configurations using discriminated unions
 */
export type LoggerConfig =
  | ({ profile: LoggingProfile.SIMPLE } & BaseLoggerConfig)
  | ({
      profile: LoggingProfile.STRUCTURED;
      filePath?: string;
      middleware?: Middleware[];
    } & BaseLoggerConfig)
  | ({
      profile: LoggingProfile.ENTERPRISE;
      sinks?: Sink[];
      middleware?: Middleware[];
    } & BaseLoggerConfig)
  | ({
      profile: LoggingProfile.CUSTOM;
      customConfig: CustomLoggerConfig;
    } & BaseLoggerConfig);

/**
 * Custom configuration for CUSTOM profile
 */
export interface CustomLoggerConfig {
  sinks: Sink[];
  middleware?: Middleware[];
  throttling?: ThrottlingConfig;
  envelope?: EnvelopeConfig;
}

/**
 * Log context for structured/enterprise profiles
 */
export interface LogContext {
  correlationId?: string;
  requestId?: string;
  userId?: string | number;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

/**
 * Sink interface for log output destinations
 */
export interface Sink {
  write(event: LogEvent): void;
}

/**
 * Middleware interface for log processing pipeline
 */
export interface Middleware {
  process(event: LogEvent): LogEvent;
}

/**
 * Base log event interface
 */
export interface LogEvent {
  timestamp: string;
  service: string;
  severity: string;
  message: string;
  [key: string]: unknown;
}

/**
 * Enterprise log event with full envelope
 */
export interface EnterpriseLogEvent extends LogEvent {
  correlationId: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string | number;
  host?: string;
  pid?: number;
  version?: string;
  environment?: string;
  region?: string;
  zone?: string;
  instanceId?: string;
  cluster?: string;
  namespace?: string;
  deployment?: string;
  component?: string;
  module?: string;
  function?: string;
  line?: number;
  stackTrace?: string;
}

/**
 * Throttling configuration
 */
export interface ThrottlingConfig {
  maxPerSecond: number;
  maxPerMinute?: number;
  burstSize?: number;
}

/**
 * Envelope configuration
 */
export interface EnvelopeConfig {
  includeStackTrace?: boolean;
  includeHostInfo?: boolean;
  includeProcessInfo?: boolean;
  customFields?: Record<string, unknown>;
}

/**
 * Logger implementation interface
 */
export interface LoggerImplementation {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  child(bindings: Record<string, unknown>): LoggerImplementation;
}

/**
 * Logging policy definition
 */
export interface LoggingPolicy {
  allowedProfiles: LoggingProfile[];
  requiredProfiles?: Record<string, LoggingProfile[]>;
  environmentRules?: Record<string, LoggingProfile[]>;
  customRequirements?: Record<string, unknown>;
}

/**
 * Policy error thrown when profile not allowed
 */
export class PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyError";
  }
}
