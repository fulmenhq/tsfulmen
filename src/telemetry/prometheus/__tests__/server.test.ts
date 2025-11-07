/**
 * Prometheus HTTP server and handler tests
 *
 * Tests for createMetricsHandler, startMetricsServer, and stopMetricsServer.
 */

import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { request as httpRequest } from 'node:http';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MetricsRegistry } from '../../registry.js';
import { PrometheusExporter } from '../exporter.js';
import { createMetricsHandler, startMetricsServer, stopMetricsServer } from '../server.js';

describe('createMetricsHandler', () => {
  let registry: MetricsRegistry;
  let exporter: PrometheusExporter;

  beforeEach(() => {
    registry = new MetricsRegistry();
    exporter = new PrometheusExporter({ registry });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('path routing', () => {
    test('serves metrics on configured path', async () => {
      const handler = createMetricsHandler(exporter, { path: '/metrics' });

      // Mock request and response
      const req = {
        url: '/metrics',
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as IncomingMessage;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      // Mock getMetrics to return test data
      vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# HELP test_metric Test metric\n');

      await handler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Content-Length': expect.any(Number),
      });
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining('test_metric'));
    });

    test('returns 404 for non-metrics paths', async () => {
      const handler = createMetricsHandler(exporter, { path: '/metrics' });

      const req = {
        url: '/health',
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as IncomingMessage;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      await handler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(404, {
        'Content-Type': 'text/plain',
      });
      expect(res.end).toHaveBeenCalledWith('Not Found');
    });

    test('supports custom metrics paths', async () => {
      const handler = createMetricsHandler(exporter, {
        path: '/custom/metrics',
      });

      const req = {
        url: '/custom/metrics',
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as IncomingMessage;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# HELP test Test\n');

      await handler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('authentication', () => {
    test('calls authenticate hook before serving metrics', async () => {
      const authenticate = vi.fn().mockResolvedValue(true);
      const handler = createMetricsHandler(exporter, { authenticate });

      const req = {
        url: '/metrics',
        method: 'GET',
        headers: { authorization: 'Bearer token' },
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as IncomingMessage;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# HELP test Test\n');

      await handler(req, res);

      expect(authenticate).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/metrics',
          headers: expect.any(Object),
          remoteAddress: '127.0.0.1',
        }),
      );
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    test('returns 401 when authentication fails', async () => {
      const authenticate = vi.fn().mockResolvedValue(false);
      const handler = createMetricsHandler(exporter, { authenticate });

      const req = {
        url: '/metrics',
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as IncomingMessage;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      await handler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(401, {
        'Content-Type': 'text/plain',
        'WWW-Authenticate': 'Bearer',
      });
      expect(res.end).toHaveBeenCalledWith('Unauthorized');
    });

    test('includes WWW-Authenticate header in 401 response', async () => {
      const authenticate = vi.fn().mockResolvedValue(false);
      const handler = createMetricsHandler(exporter, { authenticate });

      const req = {
        url: '/metrics',
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as IncomingMessage;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      await handler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(
        401,
        expect.objectContaining({
          'WWW-Authenticate': 'Bearer',
        }),
      );
    });
  });

  describe('rate limiting', () => {
    test('calls rateLimit hook before serving metrics', async () => {
      const rateLimit = vi.fn().mockResolvedValue(true);
      const handler = createMetricsHandler(exporter, { rateLimit });

      const req = {
        url: '/metrics',
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '192.168.1.100' },
      } as unknown as IncomingMessage;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# HELP test Test\n');

      await handler(req, res);

      expect(rateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          remoteAddress: '192.168.1.100',
        }),
      );
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    test('returns 429 when rate limit exceeded', async () => {
      const rateLimit = vi.fn().mockResolvedValue(false);
      const handler = createMetricsHandler(exporter, { rateLimit });

      const req = {
        url: '/metrics',
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '192.168.1.100' },
      } as unknown as IncomingMessage;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      await handler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(429, {
        'Content-Type': 'text/plain',
        'Retry-After': '60',
      });
      expect(res.end).toHaveBeenCalledWith('Too Many Requests');
    });

    test('includes Retry-After header in 429 response', async () => {
      const rateLimit = vi.fn().mockResolvedValue(false);
      const handler = createMetricsHandler(exporter, { rateLimit });

      const req = {
        url: '/metrics',
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '192.168.1.100' },
      } as unknown as IncomingMessage;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      await handler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(
        429,
        expect.objectContaining({
          'Retry-After': '60',
        }),
      );
    });
  });

  describe('response headers', () => {
    test('sets correct Content-Type for Prometheus text format', async () => {
      const handler = createMetricsHandler(exporter);

      const req = {
        url: '/metrics',
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as IncomingMessage;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# HELP test Test\n');

      await handler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        }),
      );
    });

    test('sets Content-Length header', async () => {
      const handler = createMetricsHandler(exporter);

      const req = {
        url: '/metrics',
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as IncomingMessage;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      const metricsData = '# HELP test_metric Test metric\ntest_metric 42\n';
      vi.spyOn(exporter, 'getMetrics').mockResolvedValue(metricsData);

      await handler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          'Content-Length': Buffer.byteLength(metricsData, 'utf-8'),
        }),
      );
    });
  });

  describe('refresh-on-scrape', () => {
    test('refreshes metrics when refreshOnScrape is true', async () => {
      const handler = createMetricsHandler(exporter, { refreshOnScrape: true });
      const refreshSpy = vi.spyOn(exporter, 'refresh').mockResolvedValue();
      vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# HELP test Test\n');

      const req = {
        url: '/metrics',
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as IncomingMessage;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      await handler(req, res);

      expect(refreshSpy).toHaveBeenCalled();
    });

    test('does not refresh when refreshOnScrape is false (default)', async () => {
      const handler = createMetricsHandler(exporter, {
        refreshOnScrape: false,
      });
      const refreshSpy = vi.spyOn(exporter, 'refresh').mockResolvedValue();
      vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# HELP test Test\n');

      const req = {
        url: '/metrics',
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as IncomingMessage;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      await handler(req, res);

      expect(refreshSpy).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('returns 500 when getMetrics throws', async () => {
      const handler = createMetricsHandler(exporter);

      const req = {
        url: '/metrics',
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as IncomingMessage;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      vi.spyOn(exporter, 'getMetrics').mockRejectedValue(new Error('Metrics export failed'));

      await handler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(500, {
        'Content-Type': 'text/plain',
      });
      expect(res.end).toHaveBeenCalledWith('Error: Metrics export failed');
    });

    test('returns 500 when refresh throws', async () => {
      const handler = createMetricsHandler(exporter, { refreshOnScrape: true });

      const req = {
        url: '/metrics',
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as IncomingMessage;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      vi.spyOn(exporter, 'refresh').mockRejectedValue(new Error('Refresh failed'));

      await handler(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(500, {
        'Content-Type': 'text/plain',
      });
      expect(res.end).toHaveBeenCalledWith('Error: Refresh failed');
    });
  });
});

describe('startMetricsServer / stopMetricsServer', () => {
  let registry: MetricsRegistry;
  let exporter: PrometheusExporter;
  let server: Server | null = null;

  beforeEach(() => {
    registry = new MetricsRegistry();
    exporter = new PrometheusExporter({ registry });
  });

  afterEach(async () => {
    if (server) {
      try {
        await stopMetricsServer(server, 1000);
      } catch {
        // Ignore shutdown errors in cleanup
      }
      server = null;
    }
  });

  describe('startMetricsServer', () => {
    test('starts HTTP server on configured port', async () => {
      vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# HELP test Test\n');

      server = await startMetricsServer(exporter, {
        host: '127.0.0.1',
        port: 9465,
        path: '/metrics',
      });

      expect(server.listening).toBe(true);
    });

    test('serves metrics on configured path', async () => {
      vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# HELP test_counter Test counter\n');

      server = await startMetricsServer(exporter, {
        host: '127.0.0.1',
        port: 9466,
        path: '/metrics',
      });

      // Make HTTP request to server
      const response = await new Promise<string>((resolve, reject) => {
        const req = httpRequest(
          {
            hostname: '127.0.0.1',
            port: 9466,
            path: '/metrics',
            method: 'GET',
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => resolve(data));
          },
        );

        req.on('error', reject);
        req.end();
      });

      expect(response).toContain('test_counter');
    });

    test('returns 404 for non-metrics paths', async () => {
      vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# HELP test Test\n');

      server = await startMetricsServer(exporter, {
        host: '127.0.0.1',
        port: 9467,
        path: '/metrics',
      });

      // Make request to non-metrics path
      const statusCode = await new Promise<number>((resolve, reject) => {
        const req = httpRequest(
          {
            hostname: '127.0.0.1',
            port: 9467,
            path: '/health',
            method: 'GET',
          },
          (res) => {
            resolve(res.statusCode || 0);
            res.resume(); // Consume response data
          },
        );

        req.on('error', reject);
        req.end();
      });

      expect(statusCode).toBe(404);
    });

    test('uses default host and port when not specified', async () => {
      vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# HELP test Test\n');

      server = await startMetricsServer(exporter);

      expect(server.listening).toBe(true);

      // Verify default port 9464 is listening
      const statusCode = await new Promise<number>((resolve, reject) => {
        const req = httpRequest(
          {
            hostname: '127.0.0.1',
            port: 9464,
            path: '/metrics',
            method: 'GET',
          },
          (res) => {
            resolve(res.statusCode || 0);
            res.resume();
          },
        );

        req.on('error', reject);
        req.end();
      });

      expect(statusCode).toBe(200);
    });

    test('logs startup information to console', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# HELP test Test\n');

      server = await startMetricsServer(exporter, {
        host: '127.0.0.1',
        port: 9468,
        path: '/metrics',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Prometheus metrics server listening on http://127.0.0.1:9468/metrics',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('stopMetricsServer', () => {
    test('stops running server gracefully', async () => {
      vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# HELP test Test\n');

      server = await startMetricsServer(exporter, {
        host: '127.0.0.1',
        port: 9469,
      });

      expect(server.listening).toBe(true);

      await stopMetricsServer(server);

      expect(server.listening).toBe(false);
      server = null; // Mark as cleaned up
    });

    test('logs shutdown message', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# HELP test Test\n');

      server = await startMetricsServer(exporter, {
        host: '127.0.0.1',
        port: 9470,
      });

      await stopMetricsServer(server);

      expect(consoleSpy).toHaveBeenCalledWith('Prometheus metrics server stopped');

      consoleSpy.mockRestore();
      server = null;
    });

    test('times out if shutdown takes too long', async () => {
      vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# HELP test Test\n');

      server = await startMetricsServer(exporter, {
        host: '127.0.0.1',
        port: 9471,
      });

      // Mock server.close to delay indefinitely
      const originalClose = server.close.bind(server);
      server.close = vi.fn(() => {
        // Don't call callback to simulate hanging
        return server as Server;
      });

      await expect(stopMetricsServer(server, 100)).rejects.toThrow('Server shutdown timeout');

      // Force cleanup
      originalClose();
      server = null;
    });
  });
});

describe('HTTP instrumentation', () => {
  let registry: MetricsRegistry;
  let exporter: PrometheusExporter;

  beforeEach(() => {
    registry = new MetricsRegistry();
    exporter = new PrometheusExporter({ registry });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('emits http_requests_total metric for successful request', async () => {
    const handler = createMetricsHandler(exporter);
    vi.spyOn(exporter, 'getMetrics').mockResolvedValue('# metrics\n');

    const req = {
      url: '/metrics',
      method: 'GET',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as IncomingMessage;

    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    await handler(req, res);

    // Check telemetry registry for HTTP metric
    const telemetryRegistry = exporter.getTelemetryRegistry();
    const events = await telemetryRegistry.export();
    const httpRequests = events.find(
      (e) => e.name === 'prometheus_exporter_http_requests_total' && e.tags?.status === '200',
    );

    expect(httpRequests).toBeDefined();
    expect(httpRequests?.value).toBe(1);
    expect(httpRequests?.tags).toEqual({ status: '200', path: '/metrics' });
  });

  test('emits http_requests_total and http_errors_total for 404', async () => {
    const handler = createMetricsHandler(exporter);

    const req = {
      url: '/not-found',
      method: 'GET',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as IncomingMessage;

    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    await handler(req, res);

    // Check telemetry registry
    const telemetryRegistry = exporter.getTelemetryRegistry();
    const events = await telemetryRegistry.export();
    const httpRequests = events.find(
      (e) => e.name === 'prometheus_exporter_http_requests_total' && e.tags?.status === '404',
    );

    expect(httpRequests).toBeDefined();
    expect(httpRequests?.value).toBe(1);
    expect(httpRequests?.tags?.path).toBe('/not-found');
  });

  test('emits http_requests_total and http_errors_total for 401', async () => {
    const handler = createMetricsHandler(exporter, {
      authenticate: async () => false,
    });

    const req = {
      url: '/metrics',
      method: 'GET',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as IncomingMessage;

    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    await handler(req, res);

    // Check telemetry registry
    const telemetryRegistry = exporter.getTelemetryRegistry();
    const events = await telemetryRegistry.export();
    const httpRequests = events.find(
      (e) => e.name === 'prometheus_exporter_http_requests_total' && e.tags?.status === '401',
    );
    const httpErrors = events.find(
      (e) => e.name === 'prometheus_exporter_http_errors_total' && e.tags?.status === '401',
    );

    expect(httpRequests).toBeDefined();
    expect(httpRequests?.value).toBe(1);
    expect(httpErrors).toBeDefined();
    expect(httpErrors?.value).toBe(1);
  });

  test('emits http_requests_total and http_errors_total for 500', async () => {
    const handler = createMetricsHandler(exporter);
    vi.spyOn(exporter, 'getMetrics').mockRejectedValue(new Error('Test error'));

    const req = {
      url: '/metrics',
      method: 'GET',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as IncomingMessage;

    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    await handler(req, res);

    // Check telemetry registry
    const telemetryRegistry = exporter.getTelemetryRegistry();
    const events = await telemetryRegistry.export();
    const httpRequests = events.find(
      (e) => e.name === 'prometheus_exporter_http_requests_total' && e.tags?.status === '500',
    );
    const httpErrors = events.find(
      (e) => e.name === 'prometheus_exporter_http_errors_total' && e.tags?.status === '500',
    );

    expect(httpRequests).toBeDefined();
    expect(httpRequests?.value).toBe(1);
    expect(httpErrors).toBeDefined();
    expect(httpErrors?.value).toBe(1);
  });

  test('emits http_requests_total for 429 rate limit', async () => {
    const handler = createMetricsHandler(exporter, {
      rateLimit: async () => false,
    });

    const req = {
      url: '/metrics',
      method: 'GET',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as IncomingMessage;

    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    await handler(req, res);

    // Check telemetry registry
    const telemetryRegistry = exporter.getTelemetryRegistry();
    const events = await telemetryRegistry.export();
    const httpRequests = events.find(
      (e) => e.name === 'prometheus_exporter_http_requests_total' && e.tags?.status === '429',
    );

    expect(httpRequests).toBeDefined();
    expect(httpRequests?.value).toBe(1);
  });
});
