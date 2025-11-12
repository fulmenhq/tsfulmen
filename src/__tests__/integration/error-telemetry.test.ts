import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ConfigPathError } from "../../config/errors.js";
import { FulmenError } from "../../errors/fulmen-error.js";
import { SchemaValidationError } from "../../schema/errors.js";
import { MetricsRegistry } from "../../telemetry/registry.js";

describe("Error & Telemetry Integration", () => {
  let metricsRegistry: MetricsRegistry;

  beforeEach(() => {
    metricsRegistry = new MetricsRegistry();
  });

  describe("Config Error Integration", () => {
    it("wraps ConfigPathError with FulmenError and tracks metrics", async () => {
      const configError = ConfigPathError.homeDirNotFound();
      const wrapped = FulmenError.wrap(configError, {
        code: "CONFIG_PATH_INVALID",
        severity: "medium",
      });

      metricsRegistry.counter("config_load_errors").inc();

      expect(wrapped.data.code).toBe("CONFIG_PATH_INVALID");
      expect(wrapped.data.message).toContain("home directory");
      expect(wrapped.data.severity).toBe("medium");
      expect(wrapped.data.severity_level).toBe(2);

      const events = await metricsRegistry.export();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe("config_load_errors");
      expect(events[0].value).toBe(1);
    });

    it("tracks config load time with histogram", async () => {
      const startTime = performance.now();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const duration = performance.now() - startTime;
      metricsRegistry.histogram("config_load_ms").observe(duration);

      const events = await metricsRegistry.export();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe("config_load_ms");
      expect(events[0].value).toHaveProperty("count", 1);
      expect(events[0].value).toHaveProperty("sum");
    });

    it("preserves error context through wrapping", () => {
      const configError = ConfigPathError.invalidName("invalid name", "vendor");
      const wrapped = FulmenError.wrap(configError, {
        code: "CONFIG_VALIDATION_FAILED",
        context: {
          field: "vendor",
          value: "invalid name",
        },
      });

      expect(wrapped.data.context).toMatchObject({
        field: "vendor",
        value: "invalid name",
      });
      expect(wrapped.data.message).toContain("Invalid vendor name");
    });
  });

  describe("Schema Error Integration", () => {
    it("wraps SchemaValidationError with diagnostics", () => {
      const schemaError = SchemaValidationError.validationFailed("test/schema", [
        {
          severity: "ERROR",
          message: "Missing required field",
          pointer: "/field",
          keyword: "required",
          source: "ajv",
        },
      ]);

      const wrapped = FulmenError.wrap(schemaError, {
        code: "SCHEMA_VALIDATION_FAILED",
        severity: "high",
      });

      expect(wrapped.data.code).toBe("SCHEMA_VALIDATION_FAILED");
      expect(wrapped.data.severity).toBe("high");
      expect(wrapped.data.message).toContain("validation failed");
    });

    it("tracks schema validation metrics", async () => {
      metricsRegistry.counter("schema_validations").inc(5);
      metricsRegistry.counter("schema_validation_errors").inc(2);

      const events = await metricsRegistry.export();

      const validations = events.find((e) => e.name === "schema_validations");
      const errors = events.find((e) => e.name === "schema_validation_errors");

      expect(validations?.value).toBe(5);
      expect(errors?.value).toBe(2);
    });

    it("tracks validation errors with context tags", async () => {
      metricsRegistry.counter("schema_validation_errors").inc();

      const events = await metricsRegistry.export();
      expect(events[0].name).toBe("schema_validation_errors");
    });
  });

  describe("Fixture Validation", () => {
    it("loads and validates error fixtures", async () => {
      const fixturePath = join(process.cwd(), "tests", "fixtures", "errors", "valid-minimal.json");
      const content = await readFile(fixturePath, "utf-8");
      const data = JSON.parse(content);

      expect(data).toHaveProperty("code");
      expect(data).toHaveProperty("message");
      expect(data.code).toBe("CONFIG_LOAD_FAILED");
    });

    it("loads and validates full error fixture", async () => {
      const fixturePath = join(process.cwd(), "tests", "fixtures", "errors", "valid-full.json");
      const content = await readFile(fixturePath, "utf-8");
      const data = JSON.parse(content);

      expect(data).toHaveProperty("code");
      expect(data).toHaveProperty("message");
      expect(data).toHaveProperty("severity");
      expect(data).toHaveProperty("severity_level");
      expect(data).toHaveProperty("correlation_id");
      expect(data.severity).toBe("high");
      expect(data.severity_level).toBe(3);
    });

    it("loads and validates metrics fixture", async () => {
      const fixturePath = join(
        process.cwd(),
        "tests",
        "fixtures",
        "metrics",
        "valid-config-load-ms.json",
      );
      const content = await readFile(fixturePath, "utf-8");
      const data = JSON.parse(content);

      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("name");
      expect(data).toHaveProperty("value");
      expect(data.name).toBe("config_load_ms");
      expect(data.value).toHaveProperty("count");
      expect(data.value).toHaveProperty("sum");
      expect(data.value).toHaveProperty("buckets");
    });
  });

  describe("End-to-End Error Flow", () => {
    it("handles error from creation to metrics emission", async () => {
      const originalError = new Error("Config file not found");
      const fulmenError = FulmenError.fromError(originalError, {
        code: "CONFIG_NOT_FOUND",
        severity: "high",
        context: {
          file: "/path/to/config.json",
        },
      });

      metricsRegistry.counter("config_load_errors").inc();
      const histogram = metricsRegistry.histogram("config_load_ms");
      histogram.observe(125);

      expect(fulmenError.data.code).toBe("CONFIG_NOT_FOUND");

      const events = await metricsRegistry.export();
      expect(events).toHaveLength(2);

      const errorCount = events.find((e) => e.name === "config_load_errors");
      const loadTime = events.find((e) => e.name === "config_load_ms");

      expect(errorCount?.value).toBe(1);
      expect(loadTime?.value).toHaveProperty("count", 1);
    });

    it("correlates errors and metrics with correlation_id", () => {
      const correlationId = "test-correlation-id";
      const error = FulmenError.fromError(new Error("Test error"), {
        code: "TEST_ERROR",
        correlation_id: correlationId,
      });

      expect(error.data.correlation_id).toBe(correlationId);
    });
  });

  describe("Metrics Export Integration", () => {
    it("exports multiple metric types together", async () => {
      metricsRegistry.counter("schema_validations").inc(10);
      metricsRegistry.gauge("foundry_lookup_count").set(42);
      metricsRegistry.histogram("config_load_ms").observe(50);
      metricsRegistry.histogram("config_load_ms").observe(150);

      const events = await metricsRegistry.export();

      expect(events).toHaveLength(3);
      expect(events.map((e) => e.name)).toContain("schema_validations");
      expect(events.map((e) => e.name)).toContain("foundry_lookup_count");
      expect(events.map((e) => e.name)).toContain("config_load_ms");
    });

    it("flush clears metrics after export", async () => {
      metricsRegistry.counter("schema_validations").inc(5);

      const events = await metricsRegistry.flush();
      expect(events[0].value).toBe(5);

      const eventsAfter = await metricsRegistry.export();
      expect(eventsAfter[0].value).toBe(0);
    });
  });

  describe("Error Serialization", () => {
    it("serializes FulmenError to JSON", () => {
      const error = FulmenError.fromError(new Error("Test"), {
        code: "TEST_CODE",
        severity: "low",
      });

      const json = error.toJSON();

      expect(json).toHaveProperty("code", "TEST_CODE");
      expect(json).toHaveProperty("message", "Test");
      expect(json).toHaveProperty("severity", "low");
      expect(json).toHaveProperty("severity_level", 1);
    });

    it("round-trips error through JSON", () => {
      const original = FulmenError.fromError(new Error("Original"), {
        code: "ORIGINAL_CODE",
        severity: "medium",
        context: { key: "value" },
      });

      const json = JSON.stringify(original.toJSON());
      const parsed = JSON.parse(json);

      expect(parsed.code).toBe("ORIGINAL_CODE");
      expect(parsed.severity).toBe("medium");
      expect(parsed.context).toMatchObject({ key: "value" });
      expect(parsed.context.originalName).toBe("Error");
      expect(parsed.context.stack).toBeDefined();
    });
  });

  describe("Pathfinder Metrics Integration", () => {
    it("tracks pathfinder operations with new metrics", async () => {
      metricsRegistry.histogram("pathfinder_find_ms").observe(25);
      metricsRegistry.counter("pathfinder_validation_errors").inc(2);
      metricsRegistry.counter("pathfinder_security_warnings").inc(1);

      const events = await metricsRegistry.export();

      const findTime = events.find((e) => e.name === "pathfinder_find_ms");
      const validationErrors = events.find((e) => e.name === "pathfinder_validation_errors");
      const securityWarnings = events.find((e) => e.name === "pathfinder_security_warnings");

      expect(findTime).toBeDefined();
      expect(validationErrors?.value).toBe(2);
      expect(securityWarnings?.value).toBe(1);
    });

    it("applies ADR-0007 buckets to pathfinder_find_ms", () => {
      const histogram = metricsRegistry.histogram("pathfinder_find_ms");

      histogram.observe(5);
      histogram.observe(50);
      histogram.observe(500);

      const summary = histogram.getSummary();

      expect(summary.buckets).toHaveLength(9);
      expect(summary.buckets[0].le).toBe(1);
      expect(summary.buckets[8].le).toBe(10000);
    });
  });
});
