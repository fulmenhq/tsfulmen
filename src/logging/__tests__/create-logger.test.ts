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
  createStructuredLoggerWithRedaction,
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

  describe("createStructuredLoggerWithRedaction", () => {
    it("should create logger with redaction middleware", () => {
      const logger = createStructuredLoggerWithRedaction("api-server");

      expect(logger).toBeDefined();
      logger.info("test message", { password: "secret123" });

      const logLine = logOutput.find((line) => line.includes('"service":"api-server"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.password).toBe("[REDACTED]");
      expect(parsed.message).toBe("test message");
    });

    it("should redact default field names (case-insensitive)", () => {
      const logger = createStructuredLoggerWithRedaction("api-server");

      logger.info("auth test", {
        password: "pass123",
        TOKEN: "token123",
        apiKey: "key123",
        Authorization: "Bearer xyz",
      });

      const logLine = logOutput.find((line) => line.includes('"service":"api-server"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.password).toBe("[REDACTED]");
      expect(parsed.TOKEN).toBe("[REDACTED]");
      expect(parsed.apiKey).toBe("[REDACTED]");
      expect(parsed.Authorization).toBe("[REDACTED]");
    });

    it("should apply default redaction patterns", () => {
      const logger = createStructuredLoggerWithRedaction("api-server");

      logger.info("pattern test", {
        data: "My SECRET_API_KEY is here",
        env: "AUTH_TOKEN=sensitive",
        blob: "A very long Base64 string: YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkw",
      });

      const logLine = logOutput.find((line) => line.includes('"service":"api-server"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.data).toBe("My [REDACTED] is here");
      expect(parsed.env).toBe("[REDACTED]=sensitive");
      expect(parsed.blob).toContain("[REDACTED]");
    });

    it("should work with file output", () => {
      const testLogFile = join(tmpdir(), "tsfulmen-redaction-test.log");
      const logger = createStructuredLoggerWithRedaction("file-service", {
        filePath: testLogFile,
      });

      expect(logger).toBeDefined();
      logger.info("file test", { password: "secret456" });

      const logLine = logOutput.find((line) => line.includes('"service":"file-service"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.password).toBe("[REDACTED]");
    });

    it("should support custom patterns", () => {
      const logger = createStructuredLoggerWithRedaction("api-server", {
        customPatterns: [/MY_CUSTOM_SECRET/g, /INTERNAL_ID_\d+/g],
      });

      logger.info("custom pattern test", {
        data: "Found MY_CUSTOM_SECRET and INTERNAL_ID_12345",
      });

      const logLine = logOutput.find((line) => line.includes('"service":"api-server"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.data).toBe("Found [REDACTED] and [REDACTED]");
    });

    it("should support custom fields", () => {
      const logger = createStructuredLoggerWithRedaction("api-server", {
        customFields: ["internalId", "customerKey"],
      });

      logger.info("custom field test", {
        internalId: "id-12345",
        customerKey: "cust-key-789",
        normalField: "visible",
      });

      const logLine = logOutput.find((line) => line.includes('"service":"api-server"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.internalId).toBe("[REDACTED]");
      expect(parsed.customerKey).toBe("[REDACTED]");
      expect(parsed.normalField).toBe("visible");
    });

    it("should disable default patterns with useDefaultPatterns: false", () => {
      const logger = createStructuredLoggerWithRedaction("api-server", {
        useDefaultPatterns: false,
        customPatterns: [/MY_CUSTOM_SECRET/g],
      });

      logger.info("no defaults test", {
        data: "SECRET_API_KEY should not be redacted",
        custom: "MY_CUSTOM_SECRET should be redacted",
      });

      const logLine = logOutput.find((line) => line.includes('"service":"api-server"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.data).toBe("SECRET_API_KEY should not be redacted");
      expect(parsed.custom).toContain("[REDACTED]");
    });

    it("should preserve redaction in child loggers", () => {
      const logger = createStructuredLoggerWithRedaction("parent-service");
      const child = logger.child({ requestId: "req-123" });

      child.info("child test", { password: "secret789" });

      const logLine = logOutput.find(
        (line) =>
          line.includes('"service":"parent-service"') && line.includes('"requestId":"req-123"'),
      );
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.password).toBe("[REDACTED]");
      expect(parsed.requestId).toBe("req-123");
    });

    it("should handle nested objects with redaction", () => {
      const logger = createStructuredLoggerWithRedaction("api-server");

      logger.info("nested test", {
        user: {
          name: "John",
          password: "pass123",
          credentials: {
            token: "token123",
            apiKey: "key123",
          },
        },
      });

      const logLine = logOutput.find((line) => line.includes('"service":"api-server"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.user.name).toBe("John");
      expect(parsed.user.password).toBe("[REDACTED]");
      expect(parsed.user.credentials.token).toBe("[REDACTED]");
      expect(parsed.user.credentials.apiKey).toBe("[REDACTED]");
    });

    it("should handle arrays with redaction", () => {
      const logger = createStructuredLoggerWithRedaction("api-server");

      logger.info("array test", {
        users: [
          { name: "Alice", password: "pass1" },
          { name: "Bob", token: "token2" },
        ],
      });

      const logLine = logOutput.find((line) => line.includes('"service":"api-server"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.users[0].name).toBe("Alice");
      expect(parsed.users[0].password).toBe("[REDACTED]");
      expect(parsed.users[1].name).toBe("Bob");
      expect(parsed.users[1].token).toBe("[REDACTED]");
    });

    it("should redact email addresses by default", () => {
      const logger = createStructuredLoggerWithRedaction("api-server");

      logger.info("email test", {
        contact: "User email is user@example.com for reference",
      });

      const logLine = logOutput.find((line) => line.includes('"service":"api-server"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.contact).toContain("[REDACTED]");
      expect(parsed.contact).not.toContain("user@example.com");
    });

    it("should redact credit card numbers by default", () => {
      const logger = createStructuredLoggerWithRedaction("api-server");

      logger.info("card test", {
        payment: "Card number: 4532015112830366 for processing",
      });

      const logLine = logOutput.find((line) => line.includes('"service":"api-server"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.payment).toContain("[REDACTED]");
      expect(parsed.payment).not.toContain("4532015112830366");
    });
  });
});
