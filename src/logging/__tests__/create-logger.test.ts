/**
 * Tests for createLogger factory functions
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createEnterpriseLogger,
  createLogger,
  createSimpleLogger,
  createStructuredLogger,
} from "../create-logger.js";
import { LoggingProfile } from "../types.js";

describe("createLogger factory functions", () => {
  let originalWrite: typeof process.stdout.write;
  let originalLog: typeof console.log;
  let logOutput: string[] = [];

  beforeEach(() => {
    // Capture stdout and console.log
    logOutput = [];
    originalWrite = process.stdout.write;
    originalLog = console.log;

    // Capture process.stdout.write (used by Pino in Simple/Structured)
    // biome-ignore lint/suspicious/noExplicitAny: Test mock requires any for stdout override
    process.stdout.write = ((chunk: any, _encoding?: any, _cb?: any) => {
      if (typeof chunk === "string") {
        logOutput.push(chunk);
      }
      return true;
      // biome-ignore lint/suspicious/noExplicitAny: Test mock requires any for stdout override
    }) as any;

    // Capture console.log (used by ConsoleSink in Enterprise)
    console.log = (message: string) => {
      logOutput.push(message);
    };
  });

  afterEach(() => {
    // Restore stdout and console.log
    process.stdout.write = originalWrite;
    console.log = originalLog;
  });

  it("should create logger with createLogger", () => {
    const logger = createLogger({
      service: "test-service",
      profile: LoggingProfile.SIMPLE,
    });

    expect(logger).toBeDefined();
    logger.info("test message");

    const logLine = logOutput.find((line) => line.includes('"service":"test-service"'));
    expect(logLine).toBeDefined();
  });

  it("should create simple logger with createSimpleLogger", () => {
    const logger = createSimpleLogger("mycli");

    expect(logger).toBeDefined();
    logger.info("simple message");

    const logLine = logOutput.find((line) => line.includes('"service":"mycli"'));
    expect(logLine).toBeDefined();
  });

  it("should create structured logger with createStructuredLogger", () => {
    const logger = createStructuredLogger("api-gateway");

    expect(logger).toBeDefined();
    logger.info("structured message");

    const logLine = logOutput.find((line) => line.includes('"service":"api-gateway"'));
    expect(logLine).toBeDefined();

    // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
    const parsed = JSON.parse(logLine!);
    expect(parsed.service).toBe("api-gateway");
    expect(parsed.message).toBe("structured message");
  });

  it("should create structured logger with file path", () => {
    const testLogFile = join(tmpdir(), "tsfulmen-create-logger-test.log");
    const logger = createStructuredLogger("file-service", testLogFile);

    expect(logger).toBeDefined();
    logger.info("structured file message");

    const logLine = logOutput.find((line) => line.includes('"service":"file-service"'));
    expect(logLine).toBeDefined();

    // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
    const parsed = JSON.parse(logLine!);
    expect(parsed.service).toBe("file-service");
    expect(parsed.message).toBe("structured file message");
  });

  it("should create enterprise logger with createEnterpriseLogger", () => {
    const logger = createEnterpriseLogger("enterprise-app");

    expect(logger).toBeDefined();
    logger.info("enterprise message");

    const logLine = logOutput.find((line) => line.includes('"service":"enterprise-app"'));
    expect(logLine).toBeDefined();

    // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
    const parsed = JSON.parse(logLine!);
    expect(parsed.service).toBe("enterprise-app");
    expect(parsed.message).toBe("enterprise message");
    expect(parsed.correlationId).toBeDefined();
  });
});
