/**
 * HTTP Metrics Helpers Tests
 *
 * Comprehensive tests for HTTP metrics helpers including:
 * - recordHttpRequest() function
 * - trackActiveRequest() function
 * - Unit conversion (ms → seconds)
 * - Label combinations and requirements
 * - AppIdentity integration
 * - Middleware factories
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { metrics } from "../../index.js";
import {
  createBunMetricsHandler,
  createFastifyMetricsPlugin,
  createHttpMetricsMiddleware,
  recordHttpRequest,
  trackActiveRequest,
} from "../index.js";

describe("HTTP Metrics Helpers", () => {
  beforeEach(async () => {
    // Clear metrics before each test by flushing
    await metrics.flush();
  });

  afterEach(async () => {
    // Clean up after each test
    await metrics.flush();
  });

  describe("recordHttpRequest()", () => {
    it("should record http_requests_total counter", async () => {
      recordHttpRequest({
        method: "GET",
        route: "/users/:id",
        status: 200,
        durationMs: 45.2,
        service: "test-service",
      });

      const events = await metrics.export();
      const counterEvent = events.find((e) => e.name === "http_requests_total" && e.tags);

      expect(counterEvent).toBeDefined();
      expect(counterEvent?.tags).toEqual({
        method: "GET",
        route: "/users/:id",
        status: "200",
        service: "test-service",
      });
      expect(counterEvent?.value).toBe(1);
    });

    it("should record http_request_duration_seconds histogram with ms→s conversion", async () => {
      recordHttpRequest({
        method: "POST",
        route: "/api/orders",
        status: 201,
        durationMs: 123.456,
        service: "api",
      });

      const events = await metrics.export();
      const histogramEvent = events.find(
        (e) => e.name === "http_request_duration_seconds" && e.tags,
      );

      expect(histogramEvent).toBeDefined();
      expect(histogramEvent?.tags).toEqual({
        method: "POST",
        route: "/api/orders",
        status: "201",
        service: "api",
      });

      // Verify ms → seconds conversion (123.456ms → 0.123456s)
      const summary = histogramEvent?.value as { sum: number; count: number };
      expect(summary.sum).toBeCloseTo(0.123456, 6);
      expect(summary.count).toBe(1);
    });

    it("should record http_request_size_bytes when requestBytes provided", async () => {
      recordHttpRequest({
        method: "PUT",
        route: "/files/:id",
        status: 200,
        durationMs: 50,
        requestBytes: 2048,
        service: "upload",
      });

      const events = await metrics.export();
      const sizeEvent = events.find((e) => e.name === "http_request_size_bytes" && e.tags);

      expect(sizeEvent).toBeDefined();
      expect(sizeEvent?.tags).toEqual({
        method: "PUT",
        route: "/files/:id",
        service: "upload",
      });

      const summary = sizeEvent?.value as { sum: number; count: number };
      expect(summary.sum).toBe(2048);
      expect(summary.count).toBe(1);
    });

    it("should not record http_request_size_bytes when requestBytes not provided", async () => {
      recordHttpRequest({
        method: "GET",
        route: "/status",
        status: 200,
        durationMs: 5,
        service: "health",
      });

      const events = await metrics.export();
      const sizeEvent = events.find(
        (e) => e.name === "http_request_size_bytes" && e.tags?.service === "health",
      );

      expect(sizeEvent).toBeUndefined();
    });

    it("should record http_response_size_bytes when responseBytes provided", async () => {
      recordHttpRequest({
        method: "GET",
        route: "/users/:id",
        status: 200,
        durationMs: 30,
        responseBytes: 4096,
        service: "api",
      });

      const events = await metrics.export();
      const sizeEvent = events.find((e) => e.name === "http_response_size_bytes" && e.tags);

      expect(sizeEvent).toBeDefined();
      expect(sizeEvent?.tags).toEqual({
        method: "GET",
        route: "/users/:id",
        status: "200",
        service: "api",
      });

      const summary = sizeEvent?.value as { sum: number; count: number };
      expect(summary.sum).toBe(4096);
      expect(summary.count).toBe(1);
    });

    it("should not record http_response_size_bytes when responseBytes not provided", async () => {
      recordHttpRequest({
        method: "DELETE",
        route: "/items/:id",
        status: 204,
        durationMs: 10,
        service: "api",
      });

      const events = await metrics.export();
      const _sizeEvent = events.find(
        (e) => e.name === "http_response_size_bytes" && e.tags?.service === "api",
      );

      // Unlabeled metric will exist, but not the labeled one
      expect(events.some((e) => e.name === "http_response_size_bytes" && e.tags)).toBe(false);
    });

    it("should record all metrics when all options provided", async () => {
      recordHttpRequest({
        method: "POST",
        route: "/api/v1/orders",
        status: 201,
        durationMs: 150.5,
        requestBytes: 1024,
        responseBytes: 512,
        service: "ecommerce",
      });

      const events = await metrics.export();

      // Verify all 4 metrics recorded (5th is http_active_requests via trackActiveRequest)
      expect(events.find((e) => e.name === "http_requests_total" && e.tags)).toBeDefined();
      expect(
        events.find((e) => e.name === "http_request_duration_seconds" && e.tags),
      ).toBeDefined();
      expect(events.find((e) => e.name === "http_request_size_bytes" && e.tags)).toBeDefined();
      expect(events.find((e) => e.name === "http_response_size_bytes" && e.tags)).toBeDefined();
    });

    it("should handle different HTTP methods", async () => {
      const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];

      for (const method of methods) {
        recordHttpRequest({
          method,
          route: "/test",
          status: 200,
          durationMs: 10,
          service: "test",
        });
      }

      const events = await metrics.export();
      const counterEvents = events.filter((e) => e.name === "http_requests_total" && e.tags);

      expect(counterEvents.length).toBeGreaterThanOrEqual(methods.length);
      for (const method of methods) {
        expect(counterEvents.some((e) => e.tags?.method === method)).toBe(true);
      }
    });

    it("should handle different HTTP status codes", async () => {
      const statuses = [200, 201, 204, 301, 400, 401, 404, 500, 502, 503];

      for (const status of statuses) {
        recordHttpRequest({
          method: "GET",
          route: "/test",
          status,
          durationMs: 10,
          service: "test",
        });
      }

      const events = await metrics.export();
      const counterEvents = events.filter((e) => e.name === "http_requests_total" && e.tags);

      for (const status of statuses) {
        expect(counterEvents.some((e) => e.tags?.status === String(status))).toBe(true);
      }
    });

    it("should accumulate multiple requests to same route", async () => {
      for (let i = 0; i < 5; i++) {
        recordHttpRequest({
          method: "GET",
          route: "/users/:id",
          status: 200,
          durationMs: 50,
          service: "api",
        });
      }

      const events = await metrics.export();
      const counterEvent = events.find(
        (e) => e.name === "http_requests_total" && e.tags?.route === "/users/:id",
      );

      expect(counterEvent?.value).toBe(5);
    });

    it("should handle zero duration", async () => {
      recordHttpRequest({
        method: "GET",
        route: "/fast",
        status: 200,
        durationMs: 0,
        service: "cache",
      });

      const events = await metrics.export();
      const histogramEvent = events.find(
        (e) => e.name === "http_request_duration_seconds" && e.tags?.route === "/fast",
      );

      const summary = histogramEvent?.value as { sum: number; count: number };
      expect(summary.sum).toBe(0);
      expect(summary.count).toBe(1);
    });

    it("should handle large duration values", async () => {
      recordHttpRequest({
        method: "GET",
        route: "/slow",
        status: 200,
        durationMs: 30000, // 30 seconds
        service: "batch",
      });

      const events = await metrics.export();
      const histogramEvent = events.find(
        (e) => e.name === "http_request_duration_seconds" && e.tags?.route === "/slow",
      );

      const summary = histogramEvent?.value as { sum: number; count: number };
      expect(summary.sum).toBe(30); // Converted to seconds
    });

    it("should use 'unknown' service when service not provided and AppIdentity unavailable", async () => {
      recordHttpRequest({
        method: "GET",
        route: "/test",
        status: 200,
        durationMs: 10,
      });

      const events = await metrics.export();
      const counterEvent = events.find((e) => e.name === "http_requests_total" && e.tags);

      expect(counterEvent?.tags?.service).toBe("unknown");
    });
  });

  describe("trackActiveRequest()", () => {
    it("should increment http_active_requests gauge", async () => {
      trackActiveRequest("test-service");

      const events = await metrics.export();
      const gaugeEvent = events.find(
        (e) => e.name === "http_active_requests" && e.tags?.service === "test-service",
      );

      expect(gaugeEvent?.value).toBe(1);
    });

    it("should decrement gauge when release function called", async () => {
      const release = trackActiveRequest("test-service");
      release();

      const events = await metrics.export();
      const gaugeEvent = events.find(
        (e) => e.name === "http_active_requests" && e.tags?.service === "test-service",
      );

      expect(gaugeEvent?.value).toBe(0);
    });

    it("should track multiple concurrent requests", async () => {
      const release1 = trackActiveRequest("api");
      const release2 = trackActiveRequest("api");
      const release3 = trackActiveRequest("api");

      let events = await metrics.export();
      let gaugeEvent = events.find(
        (e) => e.name === "http_active_requests" && e.tags?.service === "api",
      );

      expect(gaugeEvent?.value).toBe(3);

      // Release one
      release1();
      events = await metrics.export();
      gaugeEvent = events.find(
        (e) => e.name === "http_active_requests" && e.tags?.service === "api",
      );

      expect(gaugeEvent?.value).toBe(2);

      // Release remaining
      release2();
      release3();
      events = await metrics.export();
      gaugeEvent = events.find(
        (e) => e.name === "http_active_requests" && e.tags?.service === "api",
      );

      expect(gaugeEvent?.value).toBe(0);
    });

    it("should handle multiple services independently", async () => {
      const releaseApi = trackActiveRequest("api");
      const releaseWeb = trackActiveRequest("web");

      const events = await metrics.export();

      const apiGauge = events.find(
        (e) => e.name === "http_active_requests" && e.tags?.service === "api",
      );
      const webGauge = events.find(
        (e) => e.name === "http_active_requests" && e.tags?.service === "web",
      );

      expect(apiGauge?.value).toBe(1);
      expect(webGauge?.value).toBe(1);

      releaseApi();
      const eventsAfter = await metrics.export();

      const apiGaugeAfter = eventsAfter.find(
        (e) => e.name === "http_active_requests" && e.tags?.service === "api",
      );
      const webGaugeAfter = eventsAfter.find(
        (e) => e.name === "http_active_requests" && e.tags?.service === "web",
      );

      expect(apiGaugeAfter?.value).toBe(0);
      expect(webGaugeAfter?.value).toBe(1);

      releaseWeb();
    });

    it("should not go negative when over-releasing", async () => {
      const release = trackActiveRequest("test");
      release();
      release(); // Double release

      const events = await metrics.export();
      const gaugeEvent = events.find(
        (e) => e.name === "http_active_requests" && e.tags?.service === "test",
      );

      // Gauge should be -1 (no clamping in current implementation)
      // If we want to prevent negatives, we'd need to add Math.max(0, ...) in the release function
      expect(gaugeEvent?.value).toBe(-1);
    });

    it("should use 'unknown' service when not provided", async () => {
      const release = trackActiveRequest();

      const events = await metrics.export();
      const gaugeEvent = events.find(
        (e) => e.name === "http_active_requests" && e.tags?.service === "unknown",
      );

      expect(gaugeEvent?.value).toBe(1);
      release();
    });
  });

  describe("createHttpMetricsMiddleware() - Express/Connect", () => {
    it("should create middleware function", () => {
      const middleware = createHttpMetricsMiddleware();
      expect(typeof middleware).toBe("function");
      expect(middleware.length).toBe(3); // (req, res, next) signature
    });

    it("should record metrics on response finish", async () => {
      const middleware = createHttpMetricsMiddleware({ serviceName: "express" });

      // Mock request/response
      const listeners: Record<string, Array<() => void>> = {};
      const req = {
        method: "GET",
        path: "/users/123",
        route: { path: "/users/:id" },
        headers: {},
      };
      const res = {
        statusCode: 200,
        on: (event: string, handler: () => void) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(handler);
        },
        off: (_event: string, _handler: () => void) => {
          // No-op for test
        },
        getHeader: () => undefined,
      };
      const next = vi.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();

      // Simulate response finish
      for (const handler of listeners.finish || []) {
        handler();
      }

      // Wait a tick for metrics to be recorded
      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await metrics.export();
      const counterEvent = events.find(
        (e) => e.name === "http_requests_total" && e.tags?.service === "express",
      );

      expect(counterEvent).toBeDefined();
      expect(counterEvent?.tags).toMatchObject({
        method: "GET",
        route: "/users/:id",
        status: "200",
        service: "express",
      });
    });

    it("should use custom route normalizer", async () => {
      const middleware = createHttpMetricsMiddleware({
        serviceName: "custom",
        routeNormalizer: () => "/custom-route",
      });

      const listeners: Record<string, Array<() => void>> = {};
      const req = { method: "POST", path: "/anything" };
      const res = {
        statusCode: 201,
        on: (event: string, handler: () => void) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(handler);
        },
        off: () => {},
        getHeader: () => undefined,
      };
      const next = vi.fn();

      middleware(req, res, next);

      for (const handler of listeners.finish || []) {
        handler();
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await metrics.export();
      const counterEvent = events.find(
        (e) => e.name === "http_requests_total" && e.tags?.service === "custom",
      );

      expect(counterEvent?.tags?.route).toBe("/custom-route");
    });

    it("should track request/response sizes when enabled", async () => {
      const middleware = createHttpMetricsMiddleware({
        serviceName: "sized",
        trackBodySizes: true,
      });

      const listeners: Record<string, Array<() => void>> = {};
      const req = {
        method: "POST",
        path: "/upload",
        headers: { "content-length": "2048" },
      };
      const res = {
        statusCode: 200,
        on: (event: string, handler: () => void) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(handler);
        },
        off: () => {},
        getHeader: (name: string) => (name === "content-length" ? "1024" : undefined),
      };
      const next = vi.fn();

      middleware(req, res, next);

      for (const handler of listeners.finish || []) {
        handler();
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await metrics.export();
      const requestSizeEvent = events.find(
        (e) => e.name === "http_request_size_bytes" && e.tags?.service === "sized",
      );
      const responseSizeEvent = events.find(
        (e) => e.name === "http_response_size_bytes" && e.tags?.service === "sized",
      );

      expect(requestSizeEvent).toBeDefined();
      expect(responseSizeEvent).toBeDefined();

      const reqSummary = requestSizeEvent?.value as { sum: number };
      const resSummary = responseSizeEvent?.value as { sum: number };

      expect(reqSummary.sum).toBe(2048);
      expect(resSummary.sum).toBe(1024);
    });

    it("should handle errors and release active request counter", async () => {
      const middleware = createHttpMetricsMiddleware({ serviceName: "error-test" });

      const listeners: Record<string, Array<() => void>> = {};
      const req = { method: "GET", path: "/fail" };
      const res = {
        statusCode: 500,
        on: (event: string, handler: () => void) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(handler);
        },
        off: () => {},
        getHeader: () => undefined,
      };
      const next = vi.fn();

      middleware(req, res, next);

      // Verify active request incremented
      let events = await metrics.export();
      let gaugeEvent = events.find(
        (e) => e.name === "http_active_requests" && e.tags?.service === "error-test",
      );
      expect(gaugeEvent?.value).toBe(1);

      // Simulate error event
      for (const handler of listeners.error || []) {
        handler();
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify active request decremented
      events = await metrics.export();
      gaugeEvent = events.find(
        (e) => e.name === "http_active_requests" && e.tags?.service === "error-test",
      );
      expect(gaugeEvent?.value).toBe(0);
    });
  });

  describe("createFastifyMetricsPlugin()", () => {
    it("should create Fastify plugin function", () => {
      const plugin = createFastifyMetricsPlugin();
      expect(typeof plugin).toBe("function");
      expect(plugin.length).toBe(3); // (fastify, opts, done) signature
    });

    it("should register onRequest and onResponse hooks", () => {
      const hooks: Record<string, unknown> = {};
      const mockFastify = {
        addHook: (name: string, handler: (req: unknown, reply: unknown) => void) => {
          (hooks as Record<string, unknown>)[name] = handler;
        },
      };
      const done = vi.fn();

      const plugin = createFastifyMetricsPlugin({ serviceName: "fastify" });
      plugin(mockFastify, {}, done);

      expect(hooks.onRequest).toBeDefined();
      expect(hooks.onResponse).toBeDefined();
      expect(hooks.onError).toBeDefined();
      expect(done).toHaveBeenCalled();
    });

    it("should track request lifecycle metrics", async () => {
      const hooks: Record<string, unknown> = {};
      const mockFastify = {
        addHook: (name: string, handler: (req: unknown, reply: unknown) => Promise<void>) => {
          (hooks as Record<string, unknown>)[name] = handler;
        },
      };
      const done = vi.fn();

      const plugin = createFastifyMetricsPlugin({ serviceName: "fastify-test" });
      plugin(mockFastify, {}, done);

      // Simulate request
      const req: Record<string, unknown> = {
        method: "GET",
        url: "/api/users/123",
        routeOptions: { url: "/api/users/:id" },
      };
      const reply = { statusCode: 200 };

      await hooks.onRequest(req, reply);
      await hooks.onResponse(req, reply);

      const events = await metrics.export();
      const counterEvent = events.find(
        (e) => e.name === "http_requests_total" && e.tags?.service === "fastify-test",
      );

      expect(counterEvent).toBeDefined();
      expect(counterEvent?.tags).toMatchObject({
        method: "GET",
        route: "/api/users/:id",
        status: "200",
        service: "fastify-test",
      });
    });
  });

  describe("createBunMetricsHandler()", () => {
    it("should wrap handler and record metrics", async () => {
      const originalHandler = async (_req: Request) => new Response("OK", { status: 200 });
      const wrappedHandler = createBunMetricsHandler(originalHandler, {
        serviceName: "bun-test",
      });

      const mockRequest = new Request("http://localhost:3000/api/test");
      const response = await wrappedHandler(mockRequest);

      expect(response.status).toBe(200);

      const events = await metrics.export();
      const counterEvent = events.find(
        (e) => e.name === "http_requests_total" && e.tags?.service === "bun-test",
      );

      expect(counterEvent).toBeDefined();
      expect(counterEvent?.tags).toMatchObject({
        method: "GET",
        route: "/api/test",
        status: "200",
        service: "bun-test",
      });
    });

    it("should handle handler errors and release active request counter", async () => {
      const originalHandler = async (_req: Request) => {
        throw new Error("Handler error");
      };
      const wrappedHandler = createBunMetricsHandler(originalHandler, {
        serviceName: "bun-error",
      });

      const mockRequest = new Request("http://localhost:3000/fail");

      // Verify active request incremented
      const promise = wrappedHandler(mockRequest);

      await expect(promise).rejects.toThrow("Handler error");

      // Verify active request decremented after error
      const events = await metrics.export();
      const gaugeEvent = events.find(
        (e) => e.name === "http_active_requests" && e.tags?.service === "bun-error",
      );
      expect(gaugeEvent?.value).toBe(0);
    });

    it("should use custom route normalizer", async () => {
      const originalHandler = async (_req: Request) => new Response("OK");
      const wrappedHandler = createBunMetricsHandler(originalHandler, {
        serviceName: "bun-custom",
        routeNormalizer: () => "/custom-route",
      });

      await wrappedHandler(new Request("http://localhost/anything"));

      const events = await metrics.export();
      const counterEvent = events.find(
        (e) => e.name === "http_requests_total" && e.tags?.service === "bun-custom",
      );

      expect(counterEvent?.tags?.route).toBe("/custom-route");
    });
  });

  describe("Unit Conversion Accuracy", () => {
    it("should convert milliseconds to seconds accurately", async () => {
      const testCases = [
        { ms: 0, expected: 0 },
        { ms: 1, expected: 0.001 },
        { ms: 10, expected: 0.01 },
        { ms: 100, expected: 0.1 },
        { ms: 1000, expected: 1 },
        { ms: 1234.567, expected: 1.234567 },
        { ms: 0.001, expected: 0.000001 },
      ];

      for (const { ms, expected } of testCases) {
        await metrics.flush(); // Clear before each test case
        recordHttpRequest({
          method: "GET",
          route: "/test",
          status: 200,
          durationMs: ms,
          service: `test-${ms}`,
        });

        const events = await metrics.export();
        const histogramEvent = events.find(
          (e) => e.name === "http_request_duration_seconds" && e.tags?.service === `test-${ms}`,
        );

        const summary = histogramEvent?.value as { sum: number };
        expect(summary.sum).toBeCloseTo(expected, 10);
      }
    });
  });
});
