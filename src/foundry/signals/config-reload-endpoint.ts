/**
 * HTTP Config Reload Endpoint Helper
 *
 * Framework-agnostic scaffold for POST /admin/config/reload.
 *
 * Unlike the signal-based reload handler, this helper is synchronous from the
 * perspective of the caller (it returns a response object). Applications can
 * choose whether to apply config live or initiate a restart.
 */

import type { AuthHook, AuthResult, RateLimitResult } from "./http-helper.js";
import type { ConfigLoader, ConfigValidator } from "./reload.js";
import type { FallbackLogger, TelemetryEmitter } from "./windows.js";

export interface ConfigReloadRequest {
  reason?: string;
  correlation_id?: string;
}

export interface ConfigReloadResponse {
  status: "reloaded";
  correlation_id: string;
  message: string;
}

export interface ConfigReloadErrorResponse {
  status: "error";
  error: string;
  message: string;
  validation_errors?: Array<{ path: string; message: string }>;
}

export type ConfigReloadRateLimitHook = (
  identity: string,
) => Promise<RateLimitResult> | RateLimitResult;

export interface ConfigReloadEndpointOptions<T = unknown> {
  loader: ConfigLoader<T>;
  validator?: ConfigValidator<T>;
  onReload?: (config: T) => Promise<void> | void;

  auth: AuthHook;
  rateLimit?: ConfigReloadRateLimitHook;

  logger?: FallbackLogger;
  telemetry?: TelemetryEmitter;
}

export function createConfigReloadEndpoint<T = unknown>(
  options: ConfigReloadEndpointOptions<T>,
): (
  payload: ConfigReloadRequest,
  req: unknown,
) => Promise<(ConfigReloadResponse | ConfigReloadErrorResponse) & { statusCode?: number }> {
  const { loader, validator, onReload, auth, rateLimit, logger, telemetry } = options;

  return async (payload: ConfigReloadRequest, req: unknown) => {
    const correlationId = payload.correlation_id ?? generateCorrelationId();

    const authResult: AuthResult = await auth(req);
    if (!authResult.authenticated) {
      if (logger) {
        logger.warn("Config reload endpoint: authentication failed", {
          correlation_id: correlationId,
          reason: authResult.reason,
        });
      }

      if (telemetry) {
        telemetry.emit("fulmen.config.http_endpoint.auth_failed", {
          correlation_id: correlationId,
        });
      }

      return {
        status: "error",
        error: "authentication_failed",
        message: authResult.reason || "Authentication required",
        statusCode: 401,
      };
    }

    const identity = authResult.identity || "unknown";

    if (rateLimit) {
      const rateLimitResult = await rateLimit(identity);
      if (!rateLimitResult.allowed) {
        if (logger) {
          logger.warn("Config reload endpoint: rate limit exceeded", {
            correlation_id: correlationId,
            identity,
          });
        }

        if (telemetry) {
          telemetry.emit("fulmen.config.http_endpoint.rate_limited", {
            correlation_id: correlationId,
          });
        }

        return {
          status: "error",
          error: "rate_limit_exceeded",
          message: "Rate limit exceeded. Please try again later.",
          statusCode: 429,
        };
      }
    }

    if (telemetry) {
      telemetry.emit("fulmen.config.http_endpoint.reload_requested", {
        correlation_id: correlationId,
      });
    }

    try {
      const config = await loader();

      if (validator) {
        const validation = await validator(config);
        if (!validation.valid) {
          if (logger) {
            logger.warn("Config reload endpoint: validation failed", {
              correlation_id: correlationId,
              error_count: validation.errors?.length ?? 0,
            });
          }

          if (telemetry) {
            telemetry.emit("fulmen.config.http_endpoint.reload_rejected", {
              correlation_id: correlationId,
              reason: "validation_failed",
            });
          }

          return {
            status: "error",
            error: "validation_failed",
            message: "Configuration validation failed",
            validation_errors: validation.errors,
            statusCode: 422,
          };
        }
      }

      if (onReload) {
        await onReload(config);
      }

      if (telemetry) {
        telemetry.emit("fulmen.config.http_endpoint.reload_accepted", {
          correlation_id: correlationId,
        });
      }

      if (logger) {
        logger.info("Config reload endpoint: reload accepted", {
          correlation_id: correlationId,
          reason: payload.reason,
        });
      }

      return {
        status: "reloaded",
        correlation_id: correlationId,
        message: "Configuration reloaded",
        statusCode: 200,
      };
    } catch (error) {
      if (logger) {
        logger.warn("Config reload endpoint: reload failed", {
          correlation_id: correlationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (telemetry) {
        telemetry.emit("fulmen.config.http_endpoint.reload_error", {
          correlation_id: correlationId,
          error_type: error instanceof Error ? error.constructor.name : "unknown",
        });
      }

      return {
        status: "error",
        error: "reload_failed",
        message: error instanceof Error ? error.message : String(error),
        statusCode: 500,
      };
    }
  };
}

function generateCorrelationId(): string {
  return `cfg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
