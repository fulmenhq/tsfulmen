/**
 * Schema validation errors tests
 *
 * Tests for SchemaValidationError and SchemaExportError classes,
 * focusing on format(), toJSON(), and static factory methods.
 */

import { describe, expect, it } from "vitest";
import {
  ExportErrorReason,
  SchemaExportError,
  SchemaValidationError,
} from "../errors.js";
import type { SchemaValidationDiagnostic } from "../types.js";

describe("SchemaValidationError", () => {
  describe("constructor", () => {
    it("should create error with message only", () => {
      const error = new SchemaValidationError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.name).toBe("SchemaValidationError");
      expect(error.schemaId).toBeUndefined();
      expect(error.diagnostics).toEqual([]);
      expect(error.source).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it("should create error with all parameters", () => {
      const diagnostics: SchemaValidationDiagnostic[] = [
        {
          pointer: "/foo",
          message: "Invalid type",
          keyword: "type",
          severity: "ERROR",
          source: "ajv",
        },
      ];
      const source = { type: "file" as const, id: "test.json" };
      const cause = new Error("Original error");

      const error = new SchemaValidationError(
        "Validation failed",
        "test-schema-id",
        diagnostics,
        source,
        cause,
      );

      expect(error.message).toBe("Validation failed");
      expect(error.schemaId).toBe("test-schema-id");
      expect(error.diagnostics).toEqual(diagnostics);
      expect(error.source).toEqual(source);
      expect(error.cause).toBe(cause);
    });
  });

  describe("static factory methods", () => {
    it("schemaNotFound creates appropriate error", () => {
      const error = SchemaValidationError.schemaNotFound("my-schema-id");
      expect(error.message).toBe("Schema not found: my-schema-id");
      expect(error.schemaId).toBe("my-schema-id");
    });

    it("invalidSchemaInput creates appropriate error", () => {
      const source = { type: "string" as const, content: "bad schema" };
      const error = SchemaValidationError.invalidSchemaInput(source, "not valid JSON");
      expect(error.message).toBe("Invalid schema input: not valid JSON");
      expect(error.source).toEqual(source);
    });

    it("validationFailed creates error with diagnostic counts", () => {
      const diagnostics: SchemaValidationDiagnostic[] = [
        { pointer: "/a", message: "Error 1", keyword: "type", severity: "ERROR", source: "ajv" },
        { pointer: "/b", message: "Error 2", keyword: "required", severity: "ERROR", source: "ajv" },
        { pointer: "/c", message: "Warning 1", keyword: "additionalProperties", severity: "WARN", source: "ajv" },
      ];
      const source = { type: "file" as const, id: "test.json" };

      const error = SchemaValidationError.validationFailed("test-id", diagnostics, source);
      expect(error.message).toBe("Schema validation failed: 2 error(s), 1 warning(s)");
      expect(error.schemaId).toBe("test-id");
      expect(error.diagnostics).toEqual(diagnostics);
      expect(error.source).toEqual(source);
    });

    it("goneatNotFound creates error with path info", () => {
      const errorWithPath = SchemaValidationError.goneatNotFound("/custom/goneat");
      expect(errorWithPath.message).toContain("/custom/goneat");
      expect(errorWithPath.message).toContain("at /custom/goneat");

      const errorWithoutPath = SchemaValidationError.goneatNotFound();
      expect(errorWithoutPath.message).toContain("Goneat binary not found");
      expect(errorWithoutPath.message).not.toContain("at /");
    });

    it("goneatExecutionFailed creates error with cause", () => {
      const cause = new Error("Process exited with code 1");
      const error = SchemaValidationError.goneatExecutionFailed(cause);
      expect(error.message).toContain("Goneat execution failed");
      expect(error.cause).toBe(cause);
    });

    it("emptySchemaInput creates error with optional source", () => {
      const errorWithSource = SchemaValidationError.emptySchemaInput({ type: "file", id: "empty.json" });
      expect(errorWithSource.message).toBe("Schema content is empty");
      expect(errorWithSource.source?.id).toBe("empty.json");

      const errorWithoutSource = SchemaValidationError.emptySchemaInput();
      expect(errorWithoutSource.source).toBeUndefined();
    });

    it("parseFailed creates error with cause", () => {
      const source = { type: "string" as const, content: "invalid json {" };
      const cause = new Error("Unexpected token");
      const error = SchemaValidationError.parseFailed(source, cause);
      expect(error.message).toContain("Failed to parse schema");
      expect(error.message).toContain("Unexpected token");
      expect(error.cause).toBe(cause);
    });

    it("encodingFailed creates error with cause", () => {
      const source = { type: "object" as const };
      const cause = new Error("Circular reference");
      const error = SchemaValidationError.encodingFailed(source, cause);
      expect(error.message).toContain("Failed to encode schema");
      expect(error.message).toContain("Circular reference");
      expect(error.cause).toBe(cause);
    });

    it("registryError creates error for operation", () => {
      const error = SchemaValidationError.registryError("lookup", "Schema ID not found in index");
      expect(error.message).toBe("Schema registry lookup failed: Schema ID not found in index");
    });
  });

  describe("format()", () => {
    it("formats simple error message", () => {
      const error = new SchemaValidationError("Simple error");
      expect(error.format()).toBe("Simple error");
    });

    it("includes schemaId when present", () => {
      const error = new SchemaValidationError("Error occurred", "my-schema");
      const formatted = error.format();
      expect(formatted).toContain("Error occurred");
      expect(formatted).toContain("Schema ID: my-schema");
    });

    it("formats diagnostics with all fields", () => {
      const diagnostics: SchemaValidationDiagnostic[] = [
        {
          pointer: "/properties/name",
          message: "Must be a string",
          keyword: "type",
          severity: "ERROR",
          source: "ajv",
        },
        {
          pointer: "/required",
          message: "Missing required property",
          keyword: "required",
          severity: "WARN",
          source: "goneat",
        },
      ];

      const error = new SchemaValidationError("Validation failed", "test", diagnostics);
      const formatted = error.format();

      expect(formatted).toContain("Validation Issues:");
      expect(formatted).toContain("1. [ERROR] Must be a string");
      expect(formatted).toContain("at /properties/name");
      expect(formatted).toContain("(keyword: type)");
      expect(formatted).toContain("[ajv]");
      expect(formatted).toContain("2. [WARN] Missing required property");
      expect(formatted).toContain("[goneat]");
    });

    it("formats diagnostics without optional fields", () => {
      const diagnostics: SchemaValidationDiagnostic[] = [
        {
          pointer: "",
          message: "Root error",
          keyword: "root",
          severity: "ERROR",
          source: "ajv",
        },
      ];

      const error = new SchemaValidationError("Error", undefined, diagnostics);
      const formatted = error.format();

      // Should not include "at " for empty pointer
      expect(formatted).toContain("1. [ERROR] Root error");
      expect(formatted).not.toMatch(/at \s*$/m);
    });

    it("includes source information", () => {
      const error = new SchemaValidationError(
        "Error",
        undefined,
        [],
        { type: "file", id: "schema.json" },
      );
      const formatted = error.format();

      expect(formatted).toContain("Source: file");
      expect(formatted).toContain("(schema.json)");
    });

    it("includes source without id", () => {
      const error = new SchemaValidationError(
        "Error",
        undefined,
        [],
        { type: "string" },
      );
      const formatted = error.format();

      expect(formatted).toContain("Source: string");
      expect(formatted).not.toContain("()");
    });
  });

  describe("toJSON()", () => {
    it("serializes error to JSON-compatible object", () => {
      const diagnostics: SchemaValidationDiagnostic[] = [
        {
          pointer: "/test",
          message: "Test error",
          keyword: "type",
          severity: "ERROR",
          source: "ajv",
        },
      ];
      const source = { type: "file" as const, id: "test.json" };
      const cause = new Error("Cause message");

      const error = new SchemaValidationError(
        "Test message",
        "test-schema",
        diagnostics,
        source,
        cause,
      );

      const json = error.toJSON();

      expect(json.name).toBe("SchemaValidationError");
      expect(json.message).toBe("Test message");
      expect(json.schemaId).toBe("test-schema");
      expect(json.diagnostics).toEqual(diagnostics);
      expect(json.source).toEqual(source);
      expect(json.cause).toBe("Cause message");
    });

    it("handles missing optional fields", () => {
      const error = new SchemaValidationError("Simple error");
      const json = error.toJSON();

      expect(json.name).toBe("SchemaValidationError");
      expect(json.message).toBe("Simple error");
      expect(json.schemaId).toBeUndefined();
      expect(json.diagnostics).toEqual([]);
      expect(json.source).toBeUndefined();
      expect(json.cause).toBeUndefined();
    });
  });
});

describe("SchemaExportError", () => {
  describe("constructor", () => {
    it("should create error with all parameters", () => {
      const cause = new Error("Write failed");
      const error = new SchemaExportError(
        "Export failed",
        ExportErrorReason.WRITE_FAILED,
        "test-schema",
        "/path/to/output.json",
        cause,
      );

      expect(error.message).toBe("Export failed");
      expect(error.name).toBe("SchemaExportError");
      expect(error.reason).toBe(ExportErrorReason.WRITE_FAILED);
      expect(error.schemaId).toBe("test-schema");
      expect(error.outPath).toBe("/path/to/output.json");
      expect(error.cause).toBe(cause);
    });

    it("inherits from SchemaValidationError", () => {
      const error = new SchemaExportError(
        "Test",
        ExportErrorReason.UNKNOWN,
      );
      expect(error).toBeInstanceOf(SchemaValidationError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("static factory methods", () => {
    it("fileExists creates error with FILE_EXISTS reason", () => {
      const error = SchemaExportError.fileExists("/path/to/existing.json");
      expect(error.message).toContain("/path/to/existing.json");
      expect(error.message).toContain("already exists");
      expect(error.reason).toBe(ExportErrorReason.FILE_EXISTS);
      expect(error.outPath).toBe("/path/to/existing.json");
    });

    it("invalidFormat creates error with INVALID_FORMAT reason", () => {
      const error = SchemaExportError.invalidFormat("txt", "/path/to/output.txt");
      expect(error.message).toContain("Invalid export format: txt");
      expect(error.message).toContain("json");
      expect(error.message).toContain("yaml");
      expect(error.reason).toBe(ExportErrorReason.INVALID_FORMAT);
      expect(error.outPath).toBe("/path/to/output.txt");
    });

    it("writeFailed creates error with WRITE_FAILED reason and cause", () => {
      const cause = new Error("EACCES: permission denied");
      const error = SchemaExportError.writeFailed("/path/to/output.json", cause);
      expect(error.message).toContain("Failed to write schema");
      expect(error.message).toContain("/path/to/output.json");
      expect(error.message).toContain("EACCES: permission denied");
      expect(error.reason).toBe(ExportErrorReason.WRITE_FAILED);
      expect(error.outPath).toBe("/path/to/output.json");
      expect(error.cause).toBe(cause);
    });

    it("provenanceFailed creates error with PROVENANCE_FAILED reason", () => {
      const cause = new Error("File not found");
      const error = SchemaExportError.provenanceFailed("metadata.yaml missing", cause);
      expect(error.message).toContain("Failed to extract provenance metadata");
      expect(error.message).toContain("metadata.yaml missing");
      expect(error.reason).toBe(ExportErrorReason.PROVENANCE_FAILED);
      expect(error.cause).toBe(cause);
    });

    it("provenanceFailed works without cause", () => {
      const error = SchemaExportError.provenanceFailed("unknown source");
      expect(error.message).toContain("unknown source");
      expect(error.reason).toBe(ExportErrorReason.PROVENANCE_FAILED);
      expect(error.cause).toBeUndefined();
    });
  });
});

describe("ExportErrorReason enum", () => {
  it("has expected values", () => {
    expect(ExportErrorReason.FILE_EXISTS).toBe("FILE_EXISTS");
    expect(ExportErrorReason.WRITE_FAILED).toBe("WRITE_FAILED");
    expect(ExportErrorReason.INVALID_FORMAT).toBe("INVALID_FORMAT");
    expect(ExportErrorReason.PROVENANCE_FAILED).toBe("PROVENANCE_FAILED");
    expect(ExportErrorReason.UNKNOWN).toBe("UNKNOWN");
  });
});
