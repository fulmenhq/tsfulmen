/**
 * Progressive logging interface with profile-driven configuration
 */

import { hostname } from 'node:os';
import pino from 'pino';
import { PolicyEnforcer } from './policy.js';
import { ConsoleSink } from './sinks.js';
import {
  type LogContext,
  type LogEvent,
  type LoggerConfig,
  type LoggerImplementation,
  LoggingProfile,
  type Middleware,
  PolicyError,
  type Sink,
} from './types.js';

/**
 * Progressive logger with profile-based configuration
 */
export class Logger {
  private readonly service: string;
  private readonly profile: LoggingProfile;
  private readonly impl: LoggerImplementation;

  constructor(config: LoggerConfig) {
    this.service = config.service;
    this.profile = config.profile;

    // Validate against policy if provided
    if (config.policyFile) {
      this.validatePolicy(config.profile, config.policyFile);
    }

    // Create appropriate implementation
    this.impl = this.createImplementation(config);
  }

  debug(message: string, context?: LogContext): void {
    this.impl.debug(message, context);
  }

  info(message: string, context?: LogContext): void {
    this.impl.info(message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.impl.warn(message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.impl.error(message, error, context);
  }

  child(bindings: Record<string, unknown>): Logger {
    const childLogger = Object.create(this);
    childLogger.impl = this.impl.child(bindings);
    return childLogger;
  }

  private validatePolicy(profile: LoggingProfile, policyFile: string): void {
    const enforcer = new PolicyEnforcer(policyFile);
    const appType = process.env.APP_TYPE;
    const environment = process.env.NODE_ENV;

    if (!enforcer.validateProfile(profile, { appType, environment })) {
      throw new PolicyError(enforcer.getValidationErrorMessage(profile, { appType, environment }));
    }
  }

  private createImplementation(config: LoggerConfig): LoggerImplementation {
    switch (config.profile) {
      case LoggingProfile.SIMPLE:
        return new SimpleLogger(config.service);
      case LoggingProfile.STRUCTURED:
        // biome-ignore lint/suspicious/noExplicitAny: Phase 1 - proper discriminated union handling in Phase 2
        return new StructuredLogger(config.service, (config as any).filePath);
      case LoggingProfile.ENTERPRISE:
        return new EnterpriseLogger(config.service, {
          // biome-ignore lint/suspicious/noExplicitAny: Phase 1 - proper discriminated union handling in Phase 2
          sinks: (config as any).sinks,
          // biome-ignore lint/suspicious/noExplicitAny: Phase 1 - proper discriminated union handling in Phase 2
          middleware: (config as any).middleware,
        });
      case LoggingProfile.CUSTOM:
        // biome-ignore lint/suspicious/noExplicitAny: Phase 1 - proper discriminated union handling in Phase 2
        return new EnterpriseLogger(config.service, (config as any).customConfig);
    }
  }
}

/**
 * Simple logger implementation using Pino
 */
class SimpleLogger implements LoggerImplementation {
  private readonly pino: pino.Logger;

  constructor(private readonly service: string) {
    this.pino = pino({
      name: service,
      level: 'debug',
      messageKey: 'message',
      base: undefined,
      timestamp: false,
      formatters: {
        level: (label: string) => ({ severity: label.toUpperCase() }),
        // biome-ignore lint/suspicious/noExplicitAny: Pino formatter requires any type
        log: (object: any) => {
          return {
            service: this.service,
            ...object,
          };
        },
      },
    });
  }

  debug(message: string, context?: LogContext): void {
    this.pino.debug(context, message);
  }

  info(message: string, context?: LogContext): void {
    this.pino.info(context, message);
  }

  warn(message: string, context?: LogContext): void {
    this.pino.warn(context, message);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = {
      ...context,
      ...(error && { error: error.message, stack: error.stack }),
    };
    this.pino.error(errorContext, message);
  }

  child(bindings: Record<string, unknown>): LoggerImplementation {
    const childPino = this.pino.child(bindings);
    const childLogger = Object.create(this);
    childLogger.pino = childPino;
    return childLogger;
  }
}

/**
 * Structured logger implementation using Pino
 */
class StructuredLogger implements LoggerImplementation {
  private readonly pino: pino.Logger;

  constructor(
    private readonly service: string,
    readonly filePath?: string,
  ) {
    const config: pino.LoggerOptions = {
      name: service,
      level: 'debug',
      messageKey: 'message',
      base: undefined,
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      formatters: {
        level: (label: string) => ({ severity: label.toUpperCase() }),
        // biome-ignore lint/suspicious/noExplicitAny: Pino formatter requires any type
        log: (object: any) => {
          return {
            service: this.service,
            ...object,
          };
        },
      },
    };

    // Configure output streams (console + optional file)
    if (filePath) {
      const streams: pino.StreamEntry[] = [
        { stream: process.stdout },
        { stream: pino.destination(filePath) },
      ];
      this.pino = pino(config, pino.multistream(streams));
    } else {
      this.pino = pino(config);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.pino.debug(context, message);
  }

  info(message: string, context?: LogContext): void {
    this.pino.info(context, message);
  }

  warn(message: string, context?: LogContext): void {
    this.pino.warn(context, message);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = {
      ...context,
      ...(error && { error: error.message, stack: error.stack }),
    };
    this.pino.error(errorContext, message);
  }

  child(bindings: Record<string, unknown>): LoggerImplementation {
    const childPino = this.pino.child(bindings);
    const childLogger = Object.create(this);
    childLogger.pino = childPino;
    return childLogger;
  }
}

/**
 * Enterprise logger implementation using Pino
 */
class EnterpriseLogger implements LoggerImplementation {
  private readonly sinks: Sink[];
  private readonly middleware: Middleware[];
  private readonly bindings: Record<string, unknown>;

  constructor(
    private readonly service: string,
    // biome-ignore lint/suspicious/noExplicitAny: Phase 1 - proper discriminated union handling in Phase 2
    config?: any,
    bindings?: Record<string, unknown>,
  ) {
    this.sinks = config?.sinks ?? [new ConsoleSink()];
    this.middleware = config?.middleware ?? [];
    this.bindings = bindings ?? {};
  }

  debug(message: string, context?: LogContext): void {
    this.logWithPipeline('DEBUG', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.logWithPipeline('INFO', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.logWithPipeline('WARN', message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = {
      ...context,
      ...(error && {
        error: error.message,
        stack: error.stack,
        errorType: error.constructor.name,
      }),
    };
    this.logWithPipeline('ERROR', message, errorContext);
  }

  private logWithPipeline(severity: string, message: string, context?: LogContext): void {
    // Create enterprise log event
    let event: LogEvent = {
      timestamp: new Date().toISOString(),
      service: this.service,
      severity,
      message,
      correlationId: context?.correlationId ?? this.generateCorrelationId(),
      host: this.getHostname(),
      pid: process.pid,
      ...this.bindings,
      ...context,
    };

    // Apply middleware pipeline
    for (const mw of this.middleware) {
      event = mw.process(event);
    }

    // Emit to all sinks
    for (const sink of this.sinks) {
      sink.write(event);
    }
  }

  child(bindings: Record<string, unknown>): LoggerImplementation {
    const mergedBindings = { ...this.bindings, ...bindings };
    return new EnterpriseLogger(
      this.service,
      {
        sinks: this.sinks,
        middleware: this.middleware,
      },
      mergedBindings,
    );
  }

  private generateCorrelationId(): string {
    // Simple correlation ID generation - will be enhanced in Phase 2
    return `corr-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private getHostname(): string {
    try {
      return hostname();
    } catch {
      return process.env.HOSTNAME || 'unknown';
    }
  }
}
