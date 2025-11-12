/**
 * Signal Manager Tests
 *
 * Tests for handler registration, execution order, timeout enforcement, and lifecycle.
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { isPOSIX } from "../capabilities.js";
import { createSignalManager, type SignalHandler } from "../manager.js";

describe("Signal Manager", () => {
  describe("Creation and Configuration", () => {
    test("creates manager with default options", () => {
      const manager = createSignalManager();
      expect(manager).toBeDefined();
      expect(manager.isShuttingDown()).toBe(false);
    });

    test("creates manager with custom options", () => {
      const manager = createSignalManager({
        defaultTimeoutMs: 5000,
        timeoutBehavior: "force_exit",
        testMode: true,
      });
      expect(manager).toBeDefined();
    });
  });

  describe("Handler Registration", () => {
    let manager: ReturnType<typeof createSignalManager>;
    let handlerCalls: string[];

    beforeEach(() => {
      manager = createSignalManager({ testMode: true });
      handlerCalls = [];
    });

    test("registers handler for supported signal", async () => {
      const handler: SignalHandler = vi.fn();
      await manager.register("SIGTERM", handler);
      expect(manager.isRegistered("SIGTERM")).toBe(true);
      expect(manager.getHandlerCount("SIGTERM")).toBe(1);
    });

    test("registers multiple handlers for same signal", async () => {
      const handler1: SignalHandler = vi.fn();
      const handler2: SignalHandler = vi.fn();

      await manager.register("SIGTERM", handler1);
      await manager.register("SIGTERM", handler2);

      expect(manager.getHandlerCount("SIGTERM")).toBe(2);
    });

    test("does not register unsupported signals on Windows", async () => {
      if (!isPOSIX()) {
        const handler: SignalHandler = vi.fn();
        await manager.register("SIGHUP", handler);
        // SIGHUP not supported on Windows
        expect(manager.isRegistered("SIGHUP")).toBe(false);
      }
    });

    test("registers handlers with priority", async () => {
      const lowPriority: SignalHandler = () => {
        handlerCalls.push("low");
      };
      const highPriority: SignalHandler = () => {
        handlerCalls.push("high");
      };

      await manager.register("SIGTERM", lowPriority, { priority: 1 });
      await manager.register("SIGTERM", highPriority, { priority: 10 });

      await manager.trigger("SIGTERM");

      // Higher priority runs first
      expect(handlerCalls).toEqual(["high", "low"]);
    });

    test("FIFO order for same priority", async () => {
      const first: SignalHandler = () => {
        handlerCalls.push("first");
      };
      const second: SignalHandler = () => {
        handlerCalls.push("second");
      };

      await manager.register("SIGTERM", first);
      await manager.register("SIGTERM", second);

      await manager.trigger("SIGTERM");

      // FIFO order
      expect(handlerCalls).toEqual(["first", "second"]);
    });

    test("priority overrides FIFO", async () => {
      const first: SignalHandler = () => {
        handlerCalls.push("first");
      };
      const second: SignalHandler = () => {
        handlerCalls.push("second");
      };
      const third: SignalHandler = () => {
        handlerCalls.push("third");
      };

      await manager.register("SIGTERM", first, { priority: 0 });
      await manager.register("SIGTERM", second, { priority: 5 });
      await manager.register("SIGTERM", third, { priority: 0 });

      await manager.trigger("SIGTERM");

      // Second has highest priority, first and third in FIFO order
      expect(handlerCalls).toEqual(["second", "first", "third"]);
    });
  });

  describe("Handler Unregistration", () => {
    let manager: ReturnType<typeof createSignalManager>;

    beforeEach(() => {
      manager = createSignalManager({ testMode: true });
    });

    test("unregisters specific handler", async () => {
      const handler1: SignalHandler = vi.fn();
      const handler2: SignalHandler = vi.fn();

      await manager.register("SIGTERM", handler1);
      await manager.register("SIGTERM", handler2);
      expect(manager.getHandlerCount("SIGTERM")).toBe(2);

      manager.unregister("SIGTERM", handler1);
      expect(manager.getHandlerCount("SIGTERM")).toBe(1);

      await manager.trigger("SIGTERM");
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    test("unregisters all handlers for signal", async () => {
      const handler1: SignalHandler = vi.fn();
      const handler2: SignalHandler = vi.fn();

      await manager.register("SIGTERM", handler1);
      await manager.register("SIGTERM", handler2);

      manager.unregister("SIGTERM");
      expect(manager.isRegistered("SIGTERM")).toBe(false);
      expect(manager.getHandlerCount("SIGTERM")).toBe(0);
    });

    test("handles unregister for non-existent signal", () => {
      // Should not throw
      expect(() => manager.unregister("SIGTERM")).not.toThrow();
    });
  });

  describe("Handler Execution", () => {
    let manager: ReturnType<typeof createSignalManager>;

    beforeEach(() => {
      manager = createSignalManager({ testMode: true });
    });

    test("executes handler on signal trigger", async () => {
      const handler = vi.fn();
      await manager.register("SIGTERM", handler);
      await manager.trigger("SIGTERM");
      expect(handler).toHaveBeenCalledWith("SIGTERM");
    });

    test("executes async handlers", async () => {
      let executed = false;
      const handler: SignalHandler = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        executed = true;
      };

      await manager.register("SIGTERM", handler);
      await manager.trigger("SIGTERM");
      expect(executed).toBe(true);
    });

    test("executes multiple handlers in order", async () => {
      const calls: number[] = [];
      const handler1: SignalHandler = () => {
        calls.push(1);
      };
      const handler2: SignalHandler = () => {
        calls.push(2);
      };

      await manager.register("SIGTERM", handler1);
      await manager.register("SIGTERM", handler2);
      await manager.trigger("SIGTERM");

      expect(calls).toEqual([1, 2]);
    });

    test("continues on handler error with log_and_continue", async () => {
      const calls: string[] = [];
      const failing: SignalHandler = () => {
        calls.push("failing");
        throw new Error("Handler failed");
      };
      const succeeding: SignalHandler = () => {
        calls.push("succeeding");
      };

      const manager = createSignalManager({
        testMode: true,
        timeoutBehavior: "log_and_continue",
      });

      await manager.register("SIGTERM", failing);
      await manager.register("SIGTERM", succeeding);
      await manager.trigger("SIGTERM");

      // Both handlers attempted
      expect(calls).toEqual(["failing", "succeeding"]);
    });

    test("marks manager as shutting down during execution", async () => {
      let wasShuttingDown = false;
      const handler: SignalHandler = () => {
        wasShuttingDown = manager.isShuttingDown();
      };

      await manager.register("SIGTERM", handler);
      expect(manager.isShuttingDown()).toBe(false);

      await manager.trigger("SIGTERM");
      expect(wasShuttingDown).toBe(true);
    });
  });

  describe("Timeout Enforcement", () => {
    test("handler completes within timeout", async () => {
      const manager = createSignalManager({
        testMode: true,
        defaultTimeoutMs: 100,
      });

      let completed = false;
      const handler: SignalHandler = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        completed = true;
      };

      await manager.register("SIGTERM", handler);
      await manager.trigger("SIGTERM");
      expect(completed).toBe(true);
    });

    test("handler timeout with log_and_continue", async () => {
      const manager = createSignalManager({
        testMode: true,
        defaultTimeoutMs: 50,
        timeoutBehavior: "log_and_continue",
      });

      const calls: string[] = [];
      const slow: SignalHandler = async () => {
        calls.push("slow-start");
        await new Promise((resolve) => setTimeout(resolve, 200));
        calls.push("slow-end"); // Won't execute due to timeout
      };
      const fast: SignalHandler = () => {
        calls.push("fast");
      };

      await manager.register("SIGTERM", slow);
      await manager.register("SIGTERM", fast);
      await manager.trigger("SIGTERM");

      // Slow times out, fast still executes
      expect(calls).toContain("slow-start");
      expect(calls).toContain("fast");
    }, 300);

    test("custom timeout per handler", async () => {
      const manager = createSignalManager({
        testMode: true,
        defaultTimeoutMs: 50,
      });

      let longCompleted = false;
      const longHandler: SignalHandler = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        longCompleted = true;
      };

      await manager.register("SIGTERM", longHandler, { timeoutMs: 200 });
      await manager.trigger("SIGTERM");
      expect(longCompleted).toBe(true);
    }, 300);
  });

  describe("Manager Lifecycle", () => {
    test("shutdown removes all handlers", async () => {
      const manager = createSignalManager({ testMode: true });

      await manager.register("SIGTERM", vi.fn());
      await manager.register("SIGINT", vi.fn());

      expect(manager.isRegistered("SIGTERM")).toBe(true);
      expect(manager.isRegistered("SIGINT")).toBe(true);

      await manager.shutdown();

      expect(manager.isRegistered("SIGTERM")).toBe(false);
      expect(manager.isRegistered("SIGINT")).toBe(false);
    });

    test("shutdown resets shutting down state", async () => {
      const manager = createSignalManager({ testMode: true });

      await manager.register("SIGTERM", () => {});
      await manager.trigger("SIGTERM");
      expect(manager.isShuttingDown()).toBe(true);

      await manager.shutdown();
      expect(manager.isShuttingDown()).toBe(false);
    });
  });
});
