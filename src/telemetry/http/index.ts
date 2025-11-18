/**
 * HTTP Metrics Helpers
 *
 * Type-safe HTTP server instrumentation for Express, Fastify, Bun, and Node.js HTTP servers.
 * Implements Crucible v0.2.18 HTTP metrics taxonomy with automatic label injection,
 * unit conversion (ms → seconds), and cardinality protection.
 *
 * CRITICAL: Routes must be templated (/users/:id) to prevent cardinality explosion.
 * Use normalizeRoute() from route-normalizer.ts before calling recordHttpRequest().
 *
 * @example
 * ```typescript
 * import { recordHttpRequest, trackActiveRequest } from '@fulmenhq/tsfulmen/telemetry/http';
 *
 * // Manual instrumentation
 * const start = performance.now();
 * const release = trackActiveRequest('api-server');
 * try {
 *   await handleRequest();
 *   recordHttpRequest({
 *     method: 'GET',
 *     route: '/users/:id',  // Pre-normalized
 *     status: 200,
 *     durationMs: performance.now() - start,
 *     requestBytes: 512,
 *     responseBytes: 2048,
 *   });
 * } finally {
 *   release();
 * }
 * ```
 */

import { getCachedIdentity } from "../../appidentity/index.js";
import { metrics } from "../index.js";
import type {
  GenericHttpRequest,
  GenericHttpResponse,
  MethodExtractor,
  NextFunction,
  RouteNormalizer,
  StatusExtractor,
} from "./types.js";

// Optional framework type imports - consumers need these as peer dependencies
type ExpressRequest = import("express").Request;
type ExpressResponse = import("express").Response;
type FastifyInstance = import("fastify").FastifyInstance;
type FastifyRequest = import("fastify").FastifyRequest;
type FastifyReply = import("fastify").FastifyReply;
type FastifyPluginCallback = import("fastify").FastifyPluginCallback;

/**
 * HTTP request recording options
 */
export interface HttpRequestOptions {
  /**
   * HTTP method (GET, POST, PUT, DELETE, etc.)
   * REQUIRED label for all HTTP metrics
   */
  method: string;

  /**
   * Route template (e.g., /users/:id, not /users/123)
   * REQUIRED label for all HTTP metrics
   * CRITICAL: Must be normalized to prevent cardinality explosion
   */
  route: string;

  /**
   * HTTP status code (200, 404, 500, etc.)
   * REQUIRED label for http_requests_total, http_request_duration_seconds, http_response_size_bytes
   */
  status: number;

  /**
   * Request duration in milliseconds
   * Automatically converted to seconds for http_request_duration_seconds
   * REQUIRED for recording duration metric
   */
  durationMs: number;

  /**
   * Request body size in bytes (optional)
   * Records http_request_size_bytes histogram when provided
   */
  requestBytes?: number;

  /**
   * Response body size in bytes (optional)
   * Records http_response_size_bytes histogram when provided
   */
  responseBytes?: number;

  /**
   * Service name (optional, defaults to AppIdentity binary_name)
   * REQUIRED label for all HTTP metrics
   * Falls back to 'unknown' if AppIdentity not available
   */
  service?: string;
}

/**
 * Active request release function
 * Call to decrement http_active_requests gauge
 */
export type ActiveRequestRelease = () => void;

/**
 * Record HTTP request metrics
 *
 * Records all applicable HTTP metrics from Crucible v0.2.18 taxonomy:
 * - http_requests_total (counter)
 * - http_request_duration_seconds (histogram, converted from ms)
 * - http_request_size_bytes (histogram, if requestBytes provided)
 * - http_response_size_bytes (histogram, if responseBytes provided)
 *
 * Auto-injects service label from AppIdentity if not provided.
 * Converts durationMs to seconds for duration metric.
 *
 * @param options - HTTP request recording options
 *
 * @example
 * ```typescript
 * recordHttpRequest({
 *   method: 'GET',
 *   route: '/users/:id',
 *   status: 200,
 *   durationMs: 45.2,
 *   requestBytes: 512,
 *   responseBytes: 2048,
 *   service: 'api-server',  // Optional, defaults to AppIdentity
 * });
 * ```
 */
export function recordHttpRequest(options: HttpRequestOptions): void {
  const {
    method,
    route,
    status,
    durationMs,
    requestBytes,
    responseBytes,
    service: providedService,
  } = options;

  // Resolve service name (AppIdentity fallback)
  const service = providedService || getServiceName();

  // Convert status to string for labels
  const statusStr = String(status);

  // Common labels for metrics requiring status
  const labelsWithStatus = {
    method,
    route,
    status: statusStr,
    service,
  };

  // Labels for metrics without status requirement
  const labelsWithoutStatus = {
    method,
    route,
    service,
  };

  // Record http_requests_total (counter)
  // Required labels: method, route, status, service
  metrics.counter("http_requests_total").inc(1, labelsWithStatus);

  // Record http_request_duration_seconds (histogram)
  // CRITICAL: Convert milliseconds to seconds
  // Required labels: method, route, status, service
  const durationSeconds = durationMs / 1000;
  metrics.histogram("http_request_duration_seconds").observe(durationSeconds, labelsWithStatus);

  // Record http_request_size_bytes (histogram, optional)
  // Required labels: method, route, service
  if (requestBytes !== undefined) {
    metrics.histogram("http_request_size_bytes").observe(requestBytes, labelsWithoutStatus);
  }

  // Record http_response_size_bytes (histogram, optional)
  // Required labels: method, route, status, service
  if (responseBytes !== undefined) {
    metrics.histogram("http_response_size_bytes").observe(responseBytes, labelsWithStatus);
  }
}

/**
 * Track active HTTP request
 *
 * Increments http_active_requests gauge and returns a release function.
 * Call the release function when the request completes to decrement the gauge.
 *
 * @param service - Service name (optional, defaults to AppIdentity binary_name)
 * @returns Release function to decrement gauge
 *
 * @example
 * ```typescript
 * const release = trackActiveRequest('api-server');
 * try {
 *   await handleRequest();
 * } finally {
 *   release();  // Always decrement, even on error
 * }
 * ```
 */
export function trackActiveRequest(service?: string): ActiveRequestRelease {
  const serviceName = service || getServiceName();
  const labels = { service: serviceName };

  // Increment gauge
  metrics.gauge("http_active_requests").inc(1, labels);

  // Return release function to decrement
  return () => {
    metrics.gauge("http_active_requests").dec(1, labels);
  };
}

/**
 * Middleware options for HTTP metrics collection
 */
export interface MiddlewareOptions {
  /**
   * Service name (optional, defaults to AppIdentity binary_name)
   */
  serviceName?: string;

  /**
   * Custom route normalizer function
   * Receives request object and returns normalized route
   * Defaults to basic normalization (framework-specific)
   *
   * @example
   * ```typescript
   * // Express: use route.path if available
   * routeNormalizer: (req) => req.route?.path || req.path
   *
   * // Custom normalization
   * routeNormalizer: (req) => normalizeRoute(req.path)
   * ```
   */
  routeNormalizer?: RouteNormalizer;

  /**
   * Custom method extractor (defaults to req.method)
   */
  methodExtractor?: MethodExtractor;

  /**
   * Custom status extractor (defaults to res.statusCode)
   */
  statusExtractor?: StatusExtractor;

  /**
   * Whether to track request/response body sizes (default: false)
   * May have performance impact for large bodies
   */
  trackBodySizes?: boolean;
}

/**
 * Create Express/Connect-compatible middleware for HTTP metrics
 *
 * Automatically instruments HTTP requests with metrics collection.
 * Compatible with Express, Connect, and similar frameworks using (req, res, next) signature.
 *
 * @param options - Middleware configuration options
 * @returns Express/Connect middleware function
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createHttpMetricsMiddleware } from '@fulmenhq/tsfulmen/telemetry/http';
 *
 * const app = express();
 * app.use(createHttpMetricsMiddleware({
 *   serviceName: 'api-server',
 *   routeNormalizer: (req) => req.route?.path || req.path,
 * }));
 * ```
 */
export function createHttpMetricsMiddleware(options: MiddlewareOptions = {}) {
  const {
    serviceName,
    routeNormalizer = (req: GenericHttpRequest) => req.route?.path || req.path || "unknown",
    methodExtractor = (req: GenericHttpRequest) => req.method || "UNKNOWN",
    statusExtractor = (res: GenericHttpResponse) => res.statusCode || 0,
    trackBodySizes = false,
  } = options;

  return (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    const startTime = performance.now();
    const release = trackActiveRequest(serviceName);

    // Track request size if enabled
    const requestBytes =
      trackBodySizes && req.headers?.["content-length"]
        ? Number.parseInt(req.headers["content-length"], 10)
        : undefined;

    // Hook into response finish event
    const onFinish = () => {
      const durationMs = performance.now() - startTime;
      const method = methodExtractor(req);
      const route = routeNormalizer(req);
      const status = statusExtractor(res);

      // Track response size if enabled
      const responseBytes =
        trackBodySizes && res.getHeader?.("content-length")
          ? Number.parseInt(String(res.getHeader("content-length")), 10)
          : undefined;

      recordHttpRequest({
        method,
        route,
        status,
        durationMs,
        requestBytes,
        responseBytes,
        service: serviceName,
      });

      release();
      cleanup();
    };

    const onError = () => {
      release();
      cleanup();
    };

    const cleanup = () => {
      res.off?.("finish", onFinish);
      res.off?.("error", onError);
      res.off?.("close", onError);
    };

    // Attach listeners
    res.on?.("finish", onFinish);
    res.on?.("error", onError);
    res.on?.("close", onError);

    next();
  };
}

/**
 * Create Fastify plugin for HTTP metrics
 *
 * Fastify-compatible plugin for automatic HTTP metrics collection.
 *
 * @param options - Middleware configuration options
 * @returns Fastify plugin function
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { createFastifyMetricsPlugin } from '@fulmenhq/tsfulmen/telemetry/http';
 *
 * const fastify = Fastify();
 * fastify.register(createFastifyMetricsPlugin({
 *   serviceName: 'fastify-api',
 *   routeNormalizer: (req) => req.routeOptions?.url || req.url,
 * }));
 * ```
 */
export function createFastifyMetricsPlugin(options: MiddlewareOptions = {}) {
  const {
    serviceName,
    routeNormalizer = (req: GenericHttpRequest) => req.routeOptions?.url || req.url || "unknown",
    methodExtractor = (req: GenericHttpRequest) => req.method || "UNKNOWN",
  } = options;

  const plugin: FastifyPluginCallback = (
    fastify: FastifyInstance,
    _opts: unknown,
    done: (err?: Error) => void,
  ) => {
    fastify.addHook("onRequest", async (req: FastifyRequest, _reply: FastifyReply) => {
      // Store start time and release function in request context
      // biome-ignore lint/suspicious/noExplicitAny: Runtime property injection for metrics tracking
      (req as any).metricsStartTime = performance.now();
      // biome-ignore lint/suspicious/noExplicitAny: Runtime property injection for metrics tracking
      (req as any).metricsRelease = trackActiveRequest(serviceName);
    });

    fastify.addHook("onResponse", async (req: FastifyRequest, reply: FastifyReply) => {
      // biome-ignore lint/suspicious/noExplicitAny: Runtime property access for metrics tracking
      const durationMs = performance.now() - (req as any).metricsStartTime;
      const method = methodExtractor(req);
      const route = routeNormalizer(req);
      const status = reply.statusCode || 0;

      recordHttpRequest({
        method,
        route,
        status,
        durationMs,
        service: serviceName,
      });

      // biome-ignore lint/suspicious/noExplicitAny: Runtime property access for metrics tracking
      (req as any).metricsRelease?.();
    });

    // Handle errors/close
    fastify.addHook("onError", async (req: FastifyRequest, _reply: FastifyReply, _error: Error) => {
      // biome-ignore lint/suspicious/noExplicitAny: Runtime property access for metrics tracking
      (req as any).metricsRelease?.();
    });

    done();
  };

  return plugin;
}

/**
 * Create Bun.serve fetch handler wrapper for HTTP metrics
 *
 * Wraps a Bun.serve fetch handler with automatic HTTP metrics collection.
 *
 * @param handler - Original fetch handler
 * @param options - Middleware configuration options
 * @returns Wrapped fetch handler with metrics
 *
 * @example
 * ```typescript
 * import { createBunMetricsHandler } from '@fulmenhq/tsfulmen/telemetry/http';
 *
 * Bun.serve({
 *   fetch: createBunMetricsHandler(async (req) => {
 *     return new Response("Hello World");
 *   }, {
 *     serviceName: 'bun-api',
 *     routeNormalizer: (req) => new URL(req.url).pathname,
 *   }),
 * });
 * ```
 */
export function createBunMetricsHandler(
  handler: (req: Request) => Response | Promise<Response>,
  options: MiddlewareOptions = {},
) {
  const {
    serviceName,
    routeNormalizer: customNormalizer,
    methodExtractor: customExtractor,
  } = options;

  // Type-safe defaults for Bun Request
  const routeNormalizer =
    customNormalizer ||
    ((req: GenericHttpRequest) => {
      const url = (req as unknown as Request).url;
      return new URL(url).pathname;
    });
  const methodExtractor =
    customExtractor ||
    ((req: GenericHttpRequest) => {
      return (req as unknown as Request).method;
    });

  return async (req: Request): Promise<Response> => {
    const startTime = performance.now();
    const release = trackActiveRequest(serviceName);

    try {
      const response = await handler(req);
      const durationMs = performance.now() - startTime;
      // Cast to GenericHttpRequest for extractors
      const method = methodExtractor(req as unknown as GenericHttpRequest);
      const route = routeNormalizer(req as unknown as GenericHttpRequest);
      const status = response.status;

      recordHttpRequest({
        method,
        route,
        status,
        durationMs,
        service: serviceName,
      });

      release();
      return response;
    } catch (error) {
      release();
      throw error;
    }
  };
}

/**
 * Get service name from AppIdentity or fallback to 'unknown'
 * @internal
 */
function getServiceName(): string {
  try {
    const identity = getCachedIdentity();
    if (identity?.app?.binary_name) {
      return identity.app.binary_name;
    }
  } catch {
    // AppIdentity not loaded or available, use fallback
  }
  return "unknown";
}

export type { NormalizeOptions } from "./route-normalizer.js";
// Re-export route normalization utilities for convenience
export { normalizeRoute } from "./route-normalizer.js";
