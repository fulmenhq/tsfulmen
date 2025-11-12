/**
 * Tests for sink implementations
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConsoleSink, FileSink, NullSink } from "../sinks.js";
import type { LogEvent } from "../types.js";

describe("Sinks", () => {
  let originalLog: typeof console.log;
  let logOutput: string[] = [];

  beforeEach(() => {
    // Capture console.log output
    logOutput = [];
    originalLog = console.log;
    console.log = (message: string) => {
      logOutput.push(message);
    };
  });

  afterEach(() => {
    // Restore console.log
    console.log = originalLog;
  });

  describe("ConsoleSink", () => {
    it("should write log event to console as JSON", () => {
      const sink = new ConsoleSink();
      const event: LogEvent = {
        timestamp: "2025-10-23T10:00:00.000Z",
        service: "test-service",
        severity: "INFO",
        message: "Test message",
        userId: 123,
      };

      sink.write(event);

      expect(logOutput).toHaveLength(1);
      const parsed = JSON.parse(logOutput[0]);
      expect(parsed.service).toBe("test-service");
      expect(parsed.message).toBe("Test message");
      expect(parsed.userId).toBe(123);
    });
  });

  describe("FileSink", () => {
    const testDir = join(tmpdir(), "tsfulmen-sink-test");
    const logFile = join(testDir, "test.log");

    beforeEach(() => {
      // Clean up test directory
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      // Clean up test directory
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
    });

    it("should write log event to file as JSON", () => {
      const sink = new FileSink(logFile);
      const event: LogEvent = {
        timestamp: "2025-10-23T10:00:00.000Z",
        service: "test-service",
        severity: "INFO",
        message: "File test message",
      };

      sink.write(event);

      expect(existsSync(logFile)).toBe(true);
      const content = readFileSync(logFile, "utf-8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(1);

      const parsed = JSON.parse(lines[0]);
      expect(parsed.service).toBe("test-service");
      expect(parsed.message).toBe("File test message");
    });

    it("should append multiple log events to file", () => {
      const sink = new FileSink(logFile);
      const event1: LogEvent = {
        timestamp: "2025-10-23T10:00:00.000Z",
        service: "test-service",
        severity: "INFO",
        message: "First message",
      };
      const event2: LogEvent = {
        timestamp: "2025-10-23T10:00:01.000Z",
        service: "test-service",
        severity: "WARN",
        message: "Second message",
      };

      sink.write(event1);
      sink.write(event2);

      const content = readFileSync(logFile, "utf-8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(2);

      const parsed1 = JSON.parse(lines[0]);
      const parsed2 = JSON.parse(lines[1]);
      expect(parsed1.message).toBe("First message");
      expect(parsed2.message).toBe("Second message");
    });

    it("should fall back to console on file write error", () => {
      const sink = new FileSink("/invalid/path/to/file.log");
      const event: LogEvent = {
        timestamp: "2025-10-23T10:00:00.000Z",
        service: "test-service",
        severity: "ERROR",
        message: "Error message",
      };

      // Should not throw
      sink.write(event);

      // Should have fallen back to console.log
      expect(logOutput.length).toBeGreaterThan(0);
      const parsed = JSON.parse(logOutput[logOutput.length - 1]);
      expect(parsed.message).toBe("Error message");
    });
  });

  describe("NullSink", () => {
    it("should discard log events", () => {
      const sink = new NullSink();
      const event: LogEvent = {
        timestamp: "2025-10-23T10:00:00.000Z",
        service: "test-service",
        severity: "INFO",
        message: "This should be discarded",
      };

      sink.write(event);

      // Nothing should be logged
      expect(logOutput).toHaveLength(0);
    });
  });
});
