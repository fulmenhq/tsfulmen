/**
 * HTTP Signal Endpoint Helper
 *
 * Framework-agnostic scaffold for POST /admin/signal endpoint.
 * Applications provide auth/rate-limiting; helper handles validation and execution.
 */

import { supportsSignal } from "./capabilities.js";
import type { SignalManager } from "./manager.js";
import type { FallbackLogger, TelemetryEmitter } from "./windows.js";

/**
 * Signal request payload
 */
export interface SignalRequest {
  signal: string;
  reason?: string;
  correlation_id?: string;
}

/**
 * Signal response (success)
 */
export interface SignalResponse {
  status: "accepted";
  signal: string;
  correlation_id: string;
  message: string;
}

/**
 * Signal error response
 */
export interface SignalErrorResponse {
  status: "error";
  error: string;
  message: string;
  valid_signals?: string[];
}

/**
 * Authentication result
 */
export interface AuthResult {
  authenticated: boolean;
  identity?: string; // Client identifier (IP, cert fingerprint, etc.)
  reason?: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  reset_at?: number;
}

/**
 * Authentication hook function
 *
 * Applications must provide this to validate requests.
 * Returns authentication result with optional identity.
 */
export type AuthHook = (req: unknown) => Promise<AuthResult> | AuthResult;

/**
 * Rate limiting hook function
 *
 * Applications may provide this to enforce rate limits.
 * Returns whether request is allowed and quota info.
 */
export type RateLimitHook = (
  identity: string,
  signal: string,
) => Promise<RateLimitResult> | RateLimitResult;

/**
 * Signal endpoint options
 */
export interface SignalEndpointOptions {
  /**
   * Signal manager instance
   */
  manager: SignalManager;

  /**
   * Authentication hook (required)
   */
  auth: AuthHook;

  /**
   * Rate limiting hook (optional)
   */
  rateLimit?: RateLimitHook;

  /**
   * Logger for endpoint events
   */
  logger?: FallbackLogger;

  /**
   * Telemetry emitter
   */
  telemetry?: TelemetryEmitter;

  /**
   * Allowed signals (default: all catalog signals)
   */
  allowedSignals?: string[];
}

/**
 * Create a framework-agnostic signal endpoint handler
 *
 * Returns an async function that processes signal requests.
 * Applications wire this to their HTTP framework (Express, Fastify, etc.)
 *
 * @param options - Endpoint configuration
 *
 * @example Express
 * ```typescript
 * const handler = createSignalEndpoint({
 *   manager,
 *   auth: async (req) => {
 *     const token = req.headers.authorization?.split(' ')[1];
 *     return { authenticated: token === process.env.ADMIN_TOKEN };
 *   },
 * });
 *
 * app.post('/admin/signal', async (req, res) => {
 *   const result = await handler(req.body, req);
 *   res.status(result.status === 'accepted' ? 202 : result.statusCode || 400)
 *      .json(result);
 * });
 * ```
 *
 * @example Fastify
 * ```typescript
 * const handler = createSignalEndpoint({ manager, auth });
 *
 * fastify.post('/admin/signal', async (request, reply) => {
 *   const result = await handler(request.body, request);
 *   reply.status(result.status === 'accepted' ? 202 : 400).send(result);
 * });
 * ```
 */
export function createSignalEndpoint(
  options: SignalEndpointOptions,
): (
  payload: SignalRequest,
  req: unknown,
) => Promise<(SignalResponse | SignalErrorResponse) & { statusCode?: number }> {
  const { manager, auth, rateLimit, logger, telemetry, allowedSignals } = options;

  return async (payload: SignalRequest, req: unknown) => {
    const correlationId = payload.correlation_id ?? generateCorrelationId();

    // Authenticate request
    const authResult = await auth(req);
    if (!authResult.authenticated) {
      if (logger) {
        logger.warn("Signal endpoint: authentication failed", {
          correlation_id: correlationId,
          reason: authResult.reason,
        });
      }

      if (telemetry) {
        telemetry.emit("fulmen.signal.http_endpoint.auth_failed", {
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

    // Validate signal name
    if (!payload.signal) {
      return {
        status: "error",
        error: "invalid_request",
        message: "Signal name is required",
        statusCode: 400,
      };
    }

    // Normalize signal name first
    const signalName = normalizeSignalName(payload.signal);

    // Check if signal is in allowed list
    const defaultAllowed = [
      "SIGHUP",
      "SIGTERM",
      "SIGINT",
      "SIGQUIT",
      "SIGUSR1",
      "SIGUSR2",
      "SIGPIPE",
      "SIGALRM",
    ];

    // Normalize allowed signals list (handle both 'HUP' and 'SIGHUP' formats)
    const allowed = (allowedSignals || defaultAllowed).map((s) => normalizeSignalName(s));

    if (!allowed.includes(signalName)) {
      return {
        status: "error",
        error: "invalid_signal",
        message: `Signal '${payload.signal}' is not recognized. Valid signals: ${allowed.join(", ")}`,
        valid_signals: allowed,
        statusCode: 400,
      };
    }

    // Check platform support
    const supported = await supportsSignal(signalName);
    if (!supported) {
      // This shouldn't happen on Windows (the only reason for HTTP endpoint)
      // but handle gracefully
      return {
        status: "error",
        error: "signal_not_supported",
        message: `Signal ${signalName} is not supported on this platform`,
        statusCode: 400,
      };
    }

    // Check rate limit
    if (rateLimit) {
      const rateLimitResult = await rateLimit(identity, signalName);
      if (!rateLimitResult.allowed) {
        if (logger) {
          logger.warn("Signal endpoint: rate limit exceeded", {
            correlation_id: correlationId,
            identity,
            signal: signalName,
          });
        }

        if (telemetry) {
          telemetry.emit("fulmen.signal.http_endpoint.rate_limited", {
            correlation_id: correlationId,
            signal: signalName,
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

    // Log signal request
    if (logger) {
      logger.info("Signal endpoint: signal received", {
        correlation_id: correlationId,
        identity,
        signal: signalName,
        reason: payload.reason,
      });
    }

    if (telemetry) {
      telemetry.emit("fulmen.signal.http_endpoint.signal_received", {
        correlation_id: correlationId,
        signal: signalName,
      });
    }

    // Trigger signal asynchronously
    // Don't await - signal handlers may exit the process
    void manager.trigger(signalName).catch((error) => {
      if (logger) {
        logger.warn("Signal handler execution failed", {
          correlation_id: correlationId,
          signal: signalName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Return success response immediately
    return {
      status: "accepted",
      signal: signalName,
      correlation_id: correlationId,
      message: "Signal will be processed asynchronously",
      statusCode: 202,
    };
  };
}

/**
 * Normalize signal name from HTTP request
 *
 * Converts "HUP" or "hup" to "SIGHUP"
 */
function normalizeSignalName(signal: string): string {
  const upper = signal.toUpperCase();
  if (upper.startsWith("SIG")) {
    return upper;
  }
  return `SIG${upper}`;
}

/**
 * Generate a correlation ID
 */
function generateCorrelationId(): string {
  return `sig-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a simple bearer token auth hook
 *
 * Validates requests against a static token.
 * For production, use mTLS or more robust auth.
 *
 * @param expectedToken - Expected bearer token
 *
 * @example
 * ```typescript
 * const auth = createBearerTokenAuth(process.env.ADMIN_TOKEN);
 * const handler = createSignalEndpoint({ manager, auth });
 * ```
 */
export function createBearerTokenAuth(expectedToken: string): AuthHook {
  return (req: unknown) => {
    const headers = (req as { headers?: Record<string, string> }).headers;
    const authHeader = headers?.authorization || headers?.Authorization;

    if (!authHeader) {
      return {
        authenticated: false,
        reason: "Missing Authorization header",
      };
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || token !== expectedToken) {
      return {
        authenticated: false,
        reason: "Invalid bearer token",
      };
    }

    return {
      authenticated: true,
      identity: "bearer-token-user",
    };
  };
}

/**
 * Create a simple in-memory rate limiter
 *
 * Tracks requests per identity with sliding window.
 * For production, use Redis or distributed rate limiting.
 *
 * @param requestsPerMinute - Max requests per minute per identity
 *
 * @example
 * ```typescript
 * const rateLimit = createSimpleRateLimiter(10); // 10 req/min
 * const handler = createSignalEndpoint({ manager, auth, rateLimit });
 * ```
 */
export function createSimpleRateLimiter(requestsPerMinute: number): RateLimitHook {
  const requests = new Map<string, number[]>();
  const windowMs = 60000; // 1 minute

  return (identity: string) => {
    const now = Date.now();
    const key = identity;

    // Get existing requests
    let timestamps = requests.get(key) || [];

    // Remove timestamps outside window
    timestamps = timestamps.filter((ts) => now - ts < windowMs);

    // Check if limit exceeded
    if (timestamps.length >= requestsPerMinute) {
      const oldestTimestamp = Math.min(...timestamps);
      const resetAt = oldestTimestamp + windowMs;

      return {
        allowed: false,
        remaining: 0,
        reset_at: resetAt,
      };
    }

    // Add current request
    timestamps.push(now);
    requests.set(key, timestamps);

    return {
      allowed: true,
      remaining: requestsPerMinute - timestamps.length,
      reset_at: now + windowMs,
    };
  };
}
