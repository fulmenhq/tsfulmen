/**
 * Logging module - progressive logging interface with policy enforcement
 *
 * Provides profile-based logging from simple CLI to enterprise-scale applications
 */

export const VERSION = "0.1.0";

// Factory functions
export {
  createEnterpriseLogger,
  createLogger,
  createSimpleLogger,
  createStructuredLogger,
  createStructuredLoggerWithRedaction,
} from "./create-logger.js";
// Core exports
export { Logger } from "./logger.js";
export {
  AddFieldsMiddleware,
  RedactSecretsMiddleware,
  TransformMiddleware,
} from "./middleware.js";
export { PolicyEnforcer } from "./policy.js";
export { ConsoleSink, FileSink, NullSink } from "./sinks.js";
export {
  type CustomLoggerConfig,
  type LogContext,
  type LogEvent,
  type LoggerConfig,
  type LoggingPolicy,
  LoggingProfile,
  type Middleware,
  PolicyError,
  type Sink,
} from "./types.js";
