/**
 * Tests for progressive logger implementation
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Logger } from "../logger.js";
import { RedactSecretsMiddleware } from "../middleware.js";
import { FileSink } from "../sinks.js";
import { type LoggerConfig, LoggingProfile } from "../types.js";

describe("Logger", () => {
  let originalWrite: typeof process.stdout.write;
  let originalLog: typeof console.log;
  let logOutput: string[] = [];

  beforeEach(() => {
    // Capture stdout to intercept Pino output
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

  describe("SIMPLE profile", () => {
    it("should create simple logger", () => {
      const config: LoggerConfig = {
        service: "test-service",
        profile: LoggingProfile.SIMPLE,
      };

      const logger = new Logger(config);
      expect(logger).toBeDefined();
    });

    it("should log messages in simple format", () => {
      const config: LoggerConfig = {
        service: "mycli",
        profile: LoggingProfile.SIMPLE,
      };

      const logger = new Logger(config);
      logger.info("Hello world");

      // Find the JSON log line
      const logLine = logOutput.find((line) => line.includes('"service":"mycli"'));
      expect(logLine).toBeDefined();
      expect(logLine).toContain('"severity":"INFO"');
      expect(logLine).toContain('"message":"Hello world"');
    });

    it("should log errors with stack trace", () => {
      const config: LoggerConfig = {
        service: "mycli",
        profile: LoggingProfile.SIMPLE,
      };

      const logger = new Logger(config);
      const error = new Error("Test error");
      logger.error("Something went wrong", error);

      // Find the JSON log line
      const logLine = logOutput.find((line) => line.includes('"service":"mycli"'));
      expect(logLine).toBeDefined();
      expect(logLine).toContain('"severity":"ERROR"');
      expect(logLine).toContain('"message":"Something went wrong"');
      expect(logLine).toContain('"error":"Test error"');
    });
  });

  describe("STRUCTURED profile", () => {
    it("should create structured logger", () => {
      const config: LoggerConfig = {
        service: "test-service",
        profile: LoggingProfile.STRUCTURED,
      };

      const logger = new Logger(config);
      expect(logger).toBeDefined();
    });

    it("should log messages as JSON", () => {
      const config: LoggerConfig = {
        service: "api-gateway",
        profile: LoggingProfile.STRUCTURED,
      };

      const logger = new Logger(config);
      logger.info("Request received", {
        correlationId: "req-123",
        method: "GET",
        path: "/api/users",
      });

      const logLine = logOutput.find((line) => line.includes('"service":"api-gateway"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.service).toBe("api-gateway");
      expect(parsed.severity).toBe("INFO");
      expect(parsed.message).toBe("Request received");
      expect(parsed.correlationId).toBe("req-123");
      expect(parsed.method).toBe("GET");
      expect(parsed.path).toBe("/api/users");
      expect(parsed.timestamp).toBeDefined();
    });

    it("should write to file when filePath provided", () => {
      const testDir = join(tmpdir(), "tsfulmen-test-logs");
      const logFile = join(testDir, "structured-test.log");

      // Clean up any existing test directory
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
      mkdirSync(testDir, { recursive: true });

      const config: LoggerConfig = {
        service: "file-logger",
        profile: LoggingProfile.STRUCTURED,
        filePath: logFile,
      };

      const logger = new Logger(config);
      logger.info("File test message", { testId: "file-001" });

      // Give Pino a moment to flush
      // Using a small timeout to ensure file write completes
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(existsSync(logFile)).toBe(true);

          const fileContent = readFileSync(logFile, "utf-8");
          expect(fileContent).toContain('"service":"file-logger"');
          expect(fileContent).toContain('"message":"File test message"');
          expect(fileContent).toContain('"testId":"file-001"');

          // Clean up
          rmSync(testDir, { recursive: true });
          resolve();
        }, 100);
      });
    });
  });

  describe("ENTERPRISE profile", () => {
    it("should create enterprise logger", () => {
      const config: LoggerConfig = {
        service: "test-service",
        profile: LoggingProfile.ENTERPRISE,
      };

      const logger = new Logger(config);
      expect(logger).toBeDefined();
    });

    it("should log messages with full envelope", () => {
      const config: LoggerConfig = {
        service: "datawhirl",
        profile: LoggingProfile.ENTERPRISE,
      };

      const logger = new Logger(config);
      logger.info("Job started", {
        correlationId: "job-456",
        userId: 789,
      });

      const logLine = logOutput.find((line) => line.includes('"service":"datawhirl"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.service).toBe("datawhirl");
      expect(parsed.severity).toBe("INFO");
      expect(parsed.message).toBe("Job started");
      expect(parsed.correlationId).toBe("job-456");
      expect(parsed.userId).toBe(789);
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.host).toBeDefined();
      expect(parsed.pid).toBeDefined();
    });

    it("should apply middleware pipeline", () => {
      const config: LoggerConfig = {
        service: "middleware-test",
        profile: LoggingProfile.ENTERPRISE,
        middleware: [new RedactSecretsMiddleware()],
      };

      const logger = new Logger(config);
      logger.info("User login", {
        username: "john",
        password: "secret123",
      });

      const logLine = logOutput.find((line) => line.includes('"service":"middleware-test"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.username).toBe("john");
      expect(parsed.password).toBe("[REDACTED]");
    });

    it("should write to multiple sinks", () => {
      const testDir = join(tmpdir(), "tsfulmen-multi-sink-test");
      const logFile = join(testDir, "enterprise-sink.log");

      // Clean up any existing test directory
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
      mkdirSync(testDir, { recursive: true });

      const config: LoggerConfig = {
        service: "multi-sink-test",
        profile: LoggingProfile.ENTERPRISE,
        sinks: [new FileSink(logFile)],
      };

      const logger = new Logger(config);
      logger.info("Multi-sink message", { testId: "sink-001" });

      // Give a moment for file write
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(existsSync(logFile)).toBe(true);

          const fileContent = readFileSync(logFile, "utf-8");
          expect(fileContent).toContain('"service":"multi-sink-test"');
          expect(fileContent).toContain('"message":"Multi-sink message"');
          expect(fileContent).toContain('"testId":"sink-001"');

          // Clean up
          rmSync(testDir, { recursive: true });
          resolve();
        }, 100);
      });
    });
  });

  describe("Policy validation", () => {
    it("should throw PolicyError for invalid policy file", () => {
      const config: LoggerConfig = {
        service: "test-service",
        profile: LoggingProfile.ENTERPRISE,
        policyFile: "/nonexistent/policy.yaml",
      };

      expect(() => new Logger(config)).toThrow("Policy file not found");
    });

    it("should allow profile when policy permits it", () => {
      const policyFile = `${__dirname}/fixtures/basic-policy.yaml`;
      const config: LoggerConfig = {
        service: "test-service",
        profile: LoggingProfile.ENTERPRISE,
        policyFile,
      };

      expect(() => new Logger(config)).not.toThrow();
    });

    it("should throw PolicyError when profile not allowed by policy", () => {
      const policyFile = `${__dirname}/fixtures/restrictive-policy.yaml`;
      const config: LoggerConfig = {
        service: "test-service",
        profile: LoggingProfile.SIMPLE,
        policyFile,
      };

      expect(() => new Logger(config)).toThrow('Profile "simple" not allowed');
    });
  });

  describe("Child logger", () => {
    it("should create child logger", () => {
      const config: LoggerConfig = {
        service: "parent-service",
        profile: LoggingProfile.SIMPLE,
      };

      const parent = new Logger(config);
      const child = parent.child({ module: "auth" });

      expect(child).toBeDefined();
    });

    it("should propagate bindings to child logger output", () => {
      const config: LoggerConfig = {
        service: "parent-service",
        profile: LoggingProfile.STRUCTURED,
      };

      const parent = new Logger(config);
      const child = parent.child({ module: "auth", requestId: "req-123" });

      child.info("User logged in", { userId: 42 });

      const logLine = logOutput.find((line) => line.includes('"service":"parent-service"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.module).toBe("auth");
      expect(parsed.requestId).toBe("req-123");
      expect(parsed.userId).toBe(42);
      expect(parsed.message).toBe("User logged in");
    });

    it("should preserve middleware in child logger (Enterprise)", () => {
      const config: LoggerConfig = {
        service: "parent-service",
        profile: LoggingProfile.ENTERPRISE,
        middleware: [new RedactSecretsMiddleware()],
      };

      const parent = new Logger(config);
      const child = parent.child({ module: "auth" });

      child.info("Login attempt", { username: "john", password: "secret123" });

      const logLine = logOutput.find((line) => line.includes('"service":"parent-service"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.module).toBe("auth");
      expect(parsed.username).toBe("john");
      expect(parsed.password).toBe("[REDACTED]");
    });

    it("should preserve sinks in child logger (Enterprise)", () => {
      const testDir = join(tmpdir(), "tsfulmen-child-sink-test");
      const logFile = join(testDir, "child-logger.log");

      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
      mkdirSync(testDir, { recursive: true });

      const config: LoggerConfig = {
        service: "parent-service",
        profile: LoggingProfile.ENTERPRISE,
        sinks: [new FileSink(logFile)],
      };

      const parent = new Logger(config);
      const child = parent.child({ component: "database" });

      child.info("Query executed", { queryTime: 123 });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(existsSync(logFile)).toBe(true);

          const fileContent = readFileSync(logFile, "utf-8");
          expect(fileContent).toContain('"service":"parent-service"');
          expect(fileContent).toContain('"component":"database"');
          expect(fileContent).toContain('"message":"Query executed"');
          expect(fileContent).toContain('"queryTime":123');

          rmSync(testDir, { recursive: true });
          resolve();
        }, 100);
      });
    });

    it("should support nested child loggers", () => {
      const config: LoggerConfig = {
        service: "parent-service",
        profile: LoggingProfile.STRUCTURED,
      };

      const parent = new Logger(config);
      const child1 = parent.child({ module: "api" });
      const child2 = child1.child({ endpoint: "/users" });

      child2.info("Request handled", { userId: 789 });

      const logLine = logOutput.find((line) => line.includes('"service":"parent-service"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.module).toBe("api");
      expect(parsed.endpoint).toBe("/users");
      expect(parsed.userId).toBe(789);
    });

    it("should merge child bindings with log context", () => {
      const config: LoggerConfig = {
        service: "parent-service",
        profile: LoggingProfile.STRUCTURED,
      };

      const parent = new Logger(config);
      const child = parent.child({ module: "auth", env: "production" });

      child.info("Operation completed", { userId: 456, duration: 123 });

      const logLine = logOutput.find((line) => line.includes('"service":"parent-service"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.module).toBe("auth");
      expect(parsed.env).toBe("production");
      expect(parsed.userId).toBe(456);
      expect(parsed.duration).toBe(123);
    });

    it("should preserve middleware with nested child loggers", () => {
      const config: LoggerConfig = {
        service: "parent-service",
        profile: LoggingProfile.ENTERPRISE,
        middleware: [new RedactSecretsMiddleware()],
      };

      const parent = new Logger(config);
      const child1 = parent.child({ module: "api" });
      const child2 = child1.child({ endpoint: "/auth" });

      child2.info("Auth request", {
        username: "alice",
        password: "secret456",
        apiKey: "key-789",
      });

      const logLine = logOutput.find((line) => line.includes('"service":"parent-service"'));
      expect(logLine).toBeDefined();

      // biome-ignore lint/style/noNonNullAssertion: Test asserts logLine is defined
      const parsed = JSON.parse(logLine!);
      expect(parsed.module).toBe("api");
      expect(parsed.endpoint).toBe("/auth");
      expect(parsed.username).toBe("alice");
      expect(parsed.password).toBe("[REDACTED]");
      expect(parsed.apiKey).toBe("[REDACTED]");
    });
  });
});
