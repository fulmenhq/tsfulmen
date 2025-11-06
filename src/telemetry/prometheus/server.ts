/**
 * Prometheus HTTP server implementation
 *
 * Framework-agnostic HTTP handler and dev server for exposing Prometheus metrics.
 * Compatible with Node.js http, Express, Fastify, and other frameworks.
 */

import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import type { PrometheusExporter } from './exporter.js';
import type { ServerOptions } from './types.js';

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
  const path = options.path ?? '/metrics';
  const refreshOnScrape = options.refreshOnScrape ?? false;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      // Extract request context for hooks
      const context = extractRequestContext(req);

      // Check path - only serve metrics on configured path
      if (req.url !== path) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      // Check authentication if hook provided
      if (options.authenticate) {
        const authResult = await options.authenticate(context);
        if (!authResult) {
          res.writeHead(401, {
            'Content-Type': 'text/plain',
            'WWW-Authenticate': 'Bearer',
          });
          res.end('Unauthorized');
          return;
        }
      }

      // Check rate limit if hook provided
      if (options.rateLimit) {
        const rateLimitResult = await options.rateLimit(context);
        if (!rateLimitResult) {
          res.writeHead(429, {
            'Content-Type': 'text/plain',
            'Retry-After': '60',
          });
          res.end('Too Many Requests');
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
      res.writeHead(200, {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Content-Length': Buffer.byteLength(metrics, 'utf-8'),
      });
      res.end(metrics);
    } catch (err) {
      // Internal server error
      const errorMessage = err instanceof Error ? err.message : 'Internal Server Error';

      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error: ${errorMessage}`);
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
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 9464;
  const path = options.path ?? '/metrics';

  // Create handler with options
  const handler = createMetricsHandler(exporter, options);

  // Create HTTP server
  const server = createServer(handler);

  // Start listening
  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      // Log server startup
      console.log(`Prometheus metrics server listening on http://${host}:${port}${path}`);
      resolve(server);
    });

    server.on('error', (err) => {
      // Log error through console (consistent with startup message)
      console.error('Prometheus metrics server error:', err);
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
export async function stopMetricsServer(server: Server, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    // Set timeout for forced shutdown
    const timeout = setTimeout(() => {
      console.warn(
        `Prometheus metrics server shutdown timed out after ${timeoutMs}ms, forcing close`,
      );
      server.closeAllConnections?.(); // Available in Node.js 18.2+
      reject(new Error(`Server shutdown timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    // Graceful close
    server.close((err) => {
      clearTimeout(timeout);
      if (err) {
        console.error('Error stopping Prometheus metrics server:', err);
        reject(err);
      } else {
        console.log('Prometheus metrics server stopped');
        resolve();
      }
    });

    // Close all connections immediately (allows graceful request completion)
    server.closeAllConnections?.(); // Available in Node.js 18.2+
  });
}
