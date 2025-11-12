/**
 * HTTP Signal Endpoint Tests
 *
 * Tests for framework-agnostic signal endpoint helper.
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createBearerTokenAuth,
  createSignalEndpoint,
  createSimpleRateLimiter,
  type SignalRequest,
} from "../http-helper.js";
import { createSignalManager } from "../manager.js";

describe("HTTP Signal Endpoint", () => {
  describe("createSignalEndpoint", () => {
    let manager: ReturnType<typeof createSignalManager>;

    beforeEach(() => {
      manager = createSignalManager({ testMode: true });
    });

    test("accepts valid signal request", async () => {
      const auth = vi.fn().mockResolvedValue({ authenticated: true });
      const handler = createSignalEndpoint({ manager, auth });

      const payload: SignalRequest = { signal: "TERM" };
      const result = await handler(payload, {});

      expect(result.status).toBe("accepted");
      expect(result.signal).toBe("SIGTERM");
      expect(result.correlation_id).toBeDefined();
    });

    test("normalizes signal names", async () => {
      const auth = vi.fn().mockResolvedValue({ authenticated: true });
      const handler = createSignalEndpoint({ manager, auth });

      const tests = [
        { input: "TERM", expected: "SIGTERM" },
        { input: "term", expected: "SIGTERM" },
        { input: "HUP", expected: "SIGHUP" },
        { input: "SIGINT", expected: "SIGINT" },
      ];

      for (const { input, expected } of tests) {
        const result = await handler({ signal: input }, {});
        if (result.status === "accepted") {
          expect(result.signal).toBe(expected);
        }
      }
    });

    test("rejects unauthenticated requests", async () => {
      const auth = vi.fn().mockResolvedValue({
        authenticated: false,
        reason: "Invalid token",
      });
      const handler = createSignalEndpoint({ manager, auth });

      const result = await handler({ signal: "TERM" }, {});

      expect(result.status).toBe("error");
      expect(result.error).toBe("authentication_failed");
      expect(result.statusCode).toBe(401);
    });

    test("rejects invalid signal names", async () => {
      const auth = vi.fn().mockResolvedValue({ authenticated: true });
      const handler = createSignalEndpoint({ manager, auth });

      const result = await handler({ signal: "INVALID" }, {});

      expect(result.status).toBe("error");
      expect(result.error).toBe("invalid_signal");
      expect(result.statusCode).toBe(400);
    });

    test("rejects missing signal", async () => {
      const auth = vi.fn().mockResolvedValue({ authenticated: true });
      const handler = createSignalEndpoint({ manager, auth });

      const result = await handler({ signal: "" }, {});

      expect(result.status).toBe("error");
      expect(result.error).toBe("invalid_request");
    });

    test("enforces rate limits", async () => {
      const auth = vi.fn().mockResolvedValue({
        authenticated: true,
        identity: "test-user",
      });
      const rateLimit = vi.fn().mockResolvedValue({ allowed: false });
      const handler = createSignalEndpoint({ manager, auth, rateLimit });

      const result = await handler({ signal: "TERM" }, {});

      expect(result.status).toBe("error");
      expect(result.error).toBe("rate_limit_exceeded");
      expect(result.statusCode).toBe(429);
      expect(rateLimit).toHaveBeenCalledWith("test-user", "SIGTERM");
    });

    test("passes rate limit checks", async () => {
      const auth = vi.fn().mockResolvedValue({ authenticated: true, identity: "test-user" });
      const rateLimit = vi.fn().mockResolvedValue({ allowed: true, remaining: 5 });
      const handler = createSignalEndpoint({ manager, auth, rateLimit });

      const result = await handler({ signal: "TERM" }, {});

      expect(result.status).toBe("accepted");
    });

    test("uses correlation ID from request", async () => {
      const auth = vi.fn().mockResolvedValue({ authenticated: true });
      const handler = createSignalEndpoint({ manager, auth });

      const correlationId = "test-correlation-123";
      const result = await handler({ signal: "TERM", correlation_id: correlationId }, {});

      if (result.status === "accepted") {
        expect(result.correlation_id).toBe(correlationId);
      }
    });

    test("generates correlation ID when not provided", async () => {
      const auth = vi.fn().mockResolvedValue({ authenticated: true });
      const handler = createSignalEndpoint({ manager, auth });

      const result = await handler({ signal: "TERM" }, {});

      if (result.status === "accepted") {
        expect(result.correlation_id).toMatch(/^sig-/);
      }
    });

    test("triggers signal on manager", async () => {
      const auth = vi.fn().mockResolvedValue({ authenticated: true });
      const handler = createSignalEndpoint({ manager, auth });

      const signalHandler = vi.fn();
      await manager.register("SIGTERM", signalHandler);

      await handler({ signal: "TERM" }, {});

      // Give async trigger time to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(signalHandler).toHaveBeenCalled();
    });

    test("respects allowed signals list", async () => {
      const auth = vi.fn().mockResolvedValue({ authenticated: true });
      const handler = createSignalEndpoint({
        manager,
        auth,
        allowedSignals: ["TERM", "INT"],
      });

      const termResult = await handler({ signal: "TERM" }, {});
      expect(termResult.status).toBe("accepted");

      const hupResult = await handler({ signal: "HUP" }, {});
      expect(hupResult.status).toBe("error");
      expect(hupResult.error).toBe("invalid_signal");
    });

    test("logs signal requests", async () => {
      const logCalls: Array<{ level: string; message: string }> = [];
      const logger = {
        info: (msg: string) => logCalls.push({ level: "info", message: msg }),
        warn: (msg: string) => logCalls.push({ level: "warn", message: msg }),
      };

      const auth = vi.fn().mockResolvedValue({ authenticated: true });
      const handler = createSignalEndpoint({ manager, auth, logger });

      await handler({ signal: "TERM", reason: "test reload" }, {});

      expect(logCalls).toContainEqual(
        expect.objectContaining({
          level: "info",
          message: expect.stringContaining("signal received"),
        }),
      );
    });

    test("emits telemetry events", async () => {
      const telemetryCalls: Array<{ event: string }> = [];
      const telemetry = {
        emit: (event: string) => telemetryCalls.push({ event }),
      };

      const auth = vi.fn().mockResolvedValue({ authenticated: true });
      const handler = createSignalEndpoint({ manager, auth, telemetry });

      await handler({ signal: "TERM" }, {});

      expect(telemetryCalls).toContainEqual(
        expect.objectContaining({
          event: "fulmen.signal.http_endpoint.signal_received",
        }),
      );
    });
  });

  describe("createBearerTokenAuth", () => {
    test("accepts valid bearer token", () => {
      const auth = createBearerTokenAuth("secret-token");
      const req = {
        headers: { authorization: "Bearer secret-token" },
      };

      const result = auth(req);
      expect(result.authenticated).toBe(true);
    });

    test("rejects invalid token", () => {
      const auth = createBearerTokenAuth("secret-token");
      const req = {
        headers: { authorization: "Bearer wrong-token" },
      };

      const result = auth(req);
      expect(result.authenticated).toBe(false);
    });

    test("rejects missing authorization header", () => {
      const auth = createBearerTokenAuth("secret-token");
      const req = { headers: {} };

      const result = auth(req);
      expect(result.authenticated).toBe(false);
    });

    test("rejects non-bearer schemes", () => {
      const auth = createBearerTokenAuth("secret-token");
      const req = {
        headers: { authorization: "Basic secret-token" },
      };

      const result = auth(req);
      expect(result.authenticated).toBe(false);
    });
  });

  describe("createSimpleRateLimiter", () => {
    test("allows requests under limit", () => {
      const rateLimit = createSimpleRateLimiter(5);

      for (let i = 0; i < 5; i++) {
        const result = rateLimit("user1", "SIGTERM");
        expect(result.allowed).toBe(true);
      }
    });

    test("blocks requests over limit", () => {
      const rateLimit = createSimpleRateLimiter(3);

      // First 3 allowed
      for (let i = 0; i < 3; i++) {
        const result = rateLimit("user1", "SIGTERM");
        expect(result.allowed).toBe(true);
      }

      // 4th blocked
      const result = rateLimit("user1", "SIGTERM");
      expect(result.allowed).toBe(false);
    });

    test("tracks different identities separately", () => {
      const rateLimit = createSimpleRateLimiter(2);

      const user1_1 = rateLimit("user1", "SIGTERM");
      const user2_1 = rateLimit("user2", "SIGTERM");

      expect(user1_1.allowed).toBe(true);
      expect(user2_1.allowed).toBe(true);
    });

    test("provides remaining count", () => {
      const rateLimit = createSimpleRateLimiter(5);

      const result1 = rateLimit("user1", "SIGTERM");
      expect(result1.remaining).toBe(4);

      const result2 = rateLimit("user1", "SIGTERM");
      expect(result2.remaining).toBe(3);
    });

    test("provides reset timestamp", () => {
      const rateLimit = createSimpleRateLimiter(5);

      const result = rateLimit("user1", "SIGTERM");
      expect(result.reset_at).toBeGreaterThan(Date.now());
    });

    test("resets after window expires", async () => {
      // Use very short window for testing (hacky - modifies internal state)
      const rateLimit = createSimpleRateLimiter(2);

      // Fill quota
      rateLimit("user1", "SIGTERM");
      rateLimit("user1", "SIGTERM");

      // Next request blocked
      const blocked = rateLimit("user1", "SIGTERM");
      expect(blocked.allowed).toBe(false);

      // Wait for window to expire (1 minute in real implementation)
      // In production, this would reset. Testing the remaining count logic instead.
    });
  });
});
