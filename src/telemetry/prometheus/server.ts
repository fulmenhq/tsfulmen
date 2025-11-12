/**
 * Prometheus HTTP server implementation
 *
 * Framework-agnostic HTTP handler and dev server for exposing Prometheus metrics.
 * Compatible with Node.js http, Express, Fastify, and other frameworks.
 */

import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { createLogger, LoggingProfile } from "../../logging/index.js";
import type { MetricsRegistry } from "../registry.js";
import { PROMETHEUS_EXPORTER_METRICS } from "./constants.js";
import type { PrometheusExporter } from "./exporter.js";
import type { ServerOptions } from "./types.js";

/**
 * Safe instrumentation helper for HTTP metrics
 *
 * Emits HTTP metrics to provided registry, silently failing if registry
 * doesn't support operation (e.g., mock registries in tests).
 */
function safeInstrumentHTTP(registry: MetricsRegistry | null, fn: () => void): void {
  if (!registry) return;
  try {
    fn();
  } catch {
    // Silently fail - instrumentation is non-critical
  }
}

/**
 * Get logger from exporter with metricsEnabled check
 */
function getExporterLogger(exporter: PrometheusExporter) {
  // Access private logger property through type assertion
  // biome-ignore lint/suspicious/noExplicitAny: Need to access private logger property
  const exporterAny = exporter as any;
  const logger = exporterAny.logger;

  // Return null logger if metrics disabled
  return exporterAny.metricsEnabled ? logger : null;
}

/**
 * HTTP request context for hooks
 *
 * Provides minimal interface for auth and rate limiting hooks.
 * Compatible with Node.js IncomingMessage and framework request objects.
 */
export interface RequestContext {
  /** HTTP method (GET, POST, etc.) */
  method?: string;
  /** Request URL path */
  url?: string;
  /** Request headers */
  headers: Record<string, string | string[] | undefined>;
  /** Remote IP address */
  remoteAddress?: string;
}

/**
 * Extract request context from Node.js IncomingMessage
 */
function extractRequestContext(req: IncomingMessage): RequestContext {
  return {
    method: req.method,
    url: req.url,
    headers: req.headers as Record<string, string | string[] | undefined>,
    remoteAddress: req.socket.remoteAddress,
  };
}

/**
 * Create Prometheus metrics HTTP handler
 *
 * Returns a framework-agnostic handler compatible with Node.js http, Express,
 * Fastify, and other frameworks. The handler serves Prometheus metrics in
 * text exposition format with optional authentication and rate limiting.
 *
 * @param exporter - PrometheusExporter instance
 * @param options - Server options (auth, rate limiting, refresh behavior)
 * @returns HTTP handler function
 *
 * @example
 * ```typescript
 * // Basic usage with Node.js http
 * import http from 'node:http';
 * import { PrometheusExporter, createMetricsHandler } from '@fulmenhq/tsfulmen/telemetry/prometheus';
 *
 * const exporter = new PrometheusExporter({ registry: metrics });
 * const handler = createMetricsHandler(exporter);
 *
 * const server = http.createServer(handler);
 * server.listen(9464);
 * ```
 *
 * @example
 * ```typescript
 * // With authentication
 * const handler = createMetricsHandler(exporter, {
 *   authenticate: async (req) => {
 *     const token = req.headers['authorization'];
 *     return token === 'Bearer secret-token';
 *   }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With rate limiting
 * const handler = createMetricsHandler(exporter, {
 *   rateLimit: async (req) => {
 *     const ip = req.remoteAddress;
 *     return rateLimiter.checkLimit(ip);
 *   }
 * });
 * ```
 */
export function createMetricsHandler(
  exporter: PrometheusExporter,
  options: ServerOptions = {},
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const path = options.path ?? "/metrics";
  const refreshOnScrape = options.refreshOnScrape ?? false;
  const logger = getExporterLogger(exporter);

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const telemetryRegistry = exporter.getTelemetryRegistry();
    let _statusCode = 200;
    const startTime = performance.now();

    try {
      // Extract request context for hooks
      const context = extractRequestContext(req);

      // Check path - only serve metrics on configured path
      if (req.url !== path) {
        _statusCode = 404;
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");

        // Emit HTTP request metric (4xx)
        safeInstrumentHTTP(telemetryRegistry, () => {
          telemetryRegistry
            .counter(PROMETHEUS_EXPORTER_METRICS.HTTP_REQUESTS_TOTAL)
            .inc(1, { status: "404", path: req.url || "unknown" });
        });
        return;
      }

      // Check authentication if hook provided
      if (options.authenticate) {
        const authResult = await options.authenticate(context);
        if (!authResult) {
          _statusCode = 401;
          res.writeHead(401, {
            "Content-Type": "text/plain",
            "WWW-Authenticate": "Bearer",
          });
          res.end("Unauthorized");

          // Emit HTTP request and error metrics (auth failure)
          safeInstrumentHTTP(telemetryRegistry, () => {
            telemetryRegistry
              .counter(PROMETHEUS_EXPORTER_METRICS.HTTP_REQUESTS_TOTAL)
              .inc(1, { status: "401", path });
            telemetryRegistry
              .counter(PROMETHEUS_EXPORTER_METRICS.HTTP_ERRORS_TOTAL)
              .inc(1, { status: "401", path });
          });
          return;
        }
      }

      // Check rate limit if hook provided
      if (options.rateLimit) {
        const rateLimitResult = await options.rateLimit(context);
        if (!rateLimitResult) {
          _statusCode = 429;
          res.writeHead(429, {
            "Content-Type": "text/plain",
            "Retry-After": "60",
          });
          res.end("Too Many Requests");

          // Emit HTTP request metric (4xx rate limit)
          safeInstrumentHTTP(telemetryRegistry, () => {
            telemetryRegistry
              .counter(PROMETHEUS_EXPORTER_METRICS.HTTP_REQUESTS_TOTAL)
              .inc(1, { status: "429", path });
          });
          return;
        }
      }

      // Refresh metrics if configured (optional, adds latency)
      if (refreshOnScrape) {
        await exporter.refresh();
      }

      // Get metrics in Prometheus text format
      const metrics = await exporter.getMetrics();

      // Send response with correct content-type
      // Prometheus text format version 0.0.4
      _statusCode = 200;
      res.writeHead(200, {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Content-Length": Buffer.byteLength(metrics, "utf-8"),
      });
      res.end(metrics);

      // Emit HTTP request metric (2xx success)
      safeInstrumentHTTP(telemetryRegistry, () => {
        telemetryRegistry
          .counter(PROMETHEUS_EXPORTER_METRICS.HTTP_REQUESTS_TOTAL)
          .inc(1, { status: "200", path });
      });
    } catch (err) {
      // Internal server error
      const errorMessage = err instanceof Error ? err.message : "Internal Server Error";

      _statusCode = 500;
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Error: ${errorMessage}`);

      // Emit HTTP request and error metrics (5xx failure)
      safeInstrumentHTTP(telemetryRegistry, () => {
        telemetryRegistry
          .counter(PROMETHEUS_EXPORTER_METRICS.HTTP_REQUESTS_TOTAL)
          .inc(1, { status: "500", path });
        telemetryRegistry
          .counter(PROMETHEUS_EXPORTER_METRICS.HTTP_ERRORS_TOTAL)
          .inc(1, { status: "500", path });
      });
    } finally {
      // Log HTTP request completion
      if (logger) {
        const durationMs = performance.now() - startTime;
        const context = extractRequestContext(req);

        logger.info("HTTP request processed", {
          metric_name: PROMETHEUS_EXPORTER_METRICS.HTTP_REQUESTS_TOTAL,
          status: _statusCode.toString(),
          path: req.url || "unknown",
          method: context.method || "GET",
          duration_ms: Math.round(durationMs),
          remote_address: context.remoteAddress,
        });
      }
    }
  };
}

/**
 * Start Prometheus metrics dev server
 *
 * Creates a standalone HTTP server for serving Prometheus metrics.
 * Useful for development, testing, and simple deployments without a full application framework.
 *
 * @param exporter - PrometheusExporter instance
 * @param options - Server configuration (host, port, path, auth, rate limiting)
 * @returns Promise that resolves to the HTTP Server instance
 *
 * @example
 * ```typescript
 * import { PrometheusExporter, startMetricsServer } from '@fulmenhq/tsfulmen/telemetry/prometheus';
 *
 * const exporter = new PrometheusExporter({ registry: metrics });
 *
 * // Start dev server
 * const server = await startMetricsServer(exporter, {
 *   host: '127.0.0.1',
 *   port: 9464,
 *   path: '/metrics'
 * });
 *
 * console.log('Metrics server listening on http://127.0.0.1:9464/metrics');
 *
 * // Graceful shutdown
 * process.on('SIGTERM', async () => {
 *   await stopMetricsServer(server);
 * });
 * ```
 */
export async function startMetricsServer(
  exporter: PrometheusExporter,
  options: ServerOptions = {},
): Promise<Server> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 9464;
  const path = options.path ?? "/metrics";

  // Create handler with options
  const handler = createMetricsHandler(exporter, options);

  // Create HTTP server
  const server = createServer(handler);

  // Create logger for server operations (only if metrics enabled)
  const exporterLogger = getExporterLogger(exporter);
  const logger =
    exporterLogger ||
    createLogger({
      service: "prometheus_exporter",
      profile: LoggingProfile.STRUCTURED,
    });

  // Start listening
  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      // Log server startup
      logger.info("Prometheus metrics server started", {
        host,
        port,
        path,
        url: `http://${host}:${port}${path}`,
      });
      resolve(server);
    });

    server.on("error", (err) => {
      // Log server error
      logger.error("Prometheus metrics server error", err as Error, {
        host,
        port,
        path,
      });
      reject(err);
    });
  });
}

/**
 * Stop Prometheus metrics server
 *
 * Gracefully shuts down the HTTP server with a configurable timeout.
 * Closes all connections and waits for in-flight requests to complete.
 *
 * @param server - HTTP Server instance from startMetricsServer
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Promise that resolves when server is closed
 *
 * @example
 * ```typescript
 * // Graceful shutdown with 5 second timeout
 * await stopMetricsServer(server);
 *
 * // Custom timeout
 * await stopMetricsServer(server, 10000);
 * ```
 */
export async function stopMetricsServer(
  server: Server,
  timeoutMs = 5000,
  exporter?: PrometheusExporter,
): Promise<void> {
  // Create logger for server operations (only if metrics enabled)
  const exporterLogger = exporter ? getExporterLogger(exporter) : null;
  const logger =
    exporterLogger ||
    createLogger({
      service: "prometheus_exporter",
      profile: LoggingProfile.STRUCTURED,
    });

  return new Promise((resolve, reject) => {
    // Set timeout for forced shutdown
    const timeout = setTimeout(() => {
      logger.warn("Prometheus metrics server shutdown timed out, forcing close", {
        timeout_ms: timeoutMs,
      });
      server.closeAllConnections?.(); // Available in Node.js 18.2+
      reject(new Error(`Server shutdown timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    // Graceful close
    server.close((err) => {
      clearTimeout(timeout);
      if (err) {
        logger.error("Error stopping Prometheus metrics server", err, {
          timeout_ms: timeoutMs,
        });
        reject(err);
      } else {
        logger.info("Prometheus metrics server stopped", {
          timeout_ms: timeoutMs,
        });
        resolve();
      }
    });

    // Close all connections immediately (allows graceful request completion)
    server.closeAllConnections?.(); // Available in Node.js 18.2+
  });
}
