/**
 * Schema validation utilities tests
 *
 * Tests for utility functions including formatDiagnostics, formatValidationResult,
 * isValidationError, extractValidationResult, normalizePointer, createDiagnostic,
 * groupDiagnosticsBySeverity, and countDiagnostics.
 */

import { describe, expect, it } from "vitest";
import { SchemaValidationError } from "../errors.js";
import type { SchemaValidationDiagnostic, SchemaValidationResult } from "../types.js";
import {
  countDiagnostics,
  createDiagnostic,
  extractValidationResult,
  formatDiagnostics,
  formatValidationResult,
  groupDiagnosticsBySeverity,
  isValidationError,
  normalizePointer,
} from "../utils.js";

describe("formatDiagnostics", () => {
  it("returns message for empty diagnostics", () => {
    expect(formatDiagnostics([])).toBe("No validation issues found.");
  });

  it("formats errors only", () => {
    const diagnostics: SchemaValidationDiagnostic[] = [
      {
        pointer: "/name",
        message: "Must be a string",
        keyword: "type",
        severity: "ERROR",
        source: "ajv",
      },
      {
        pointer: "/age",
        message: "Must be a number",
        keyword: "type",
        severity: "ERROR",
        source: "ajv",
      },
    ];

    const formatted = formatDiagnostics(diagnostics);
    expect(formatted).toContain("2 error(s) found:");
    expect(formatted).toContain("1. Must be a string");
    expect(formatted).toContain("at /name");
    expect(formatted).toContain("keyword: type");
    expect(formatted).toContain("2. Must be a number");
    expect(formatted).toContain("at /age");
  });

  it("formats warnings only", () => {
    const diagnostics: SchemaValidationDiagnostic[] = [
      {
        pointer: "/extra",
        message: "Additional property not allowed",
        keyword: "additionalProperties",
        severity: "WARN",
        source: "ajv",
      },
    ];

    const formatted = formatDiagnostics(diagnostics);
    expect(formatted).toContain("1 warning(s) found:");
    expect(formatted).toContain("1. Additional property not allowed");
    expect(formatted).toContain("at /extra");
  });

  it("formats both errors and warnings", () => {
    const diagnostics: SchemaValidationDiagnostic[] = [
      {
        pointer: "/required",
        message: "Missing required field",
        keyword: "required",
        severity: "ERROR",
        source: "ajv",
      },
      {
        pointer: "/deprecated",
        message: "Field is deprecated",
        keyword: "deprecated",
        severity: "WARN",
        source: "ajv",
      },
    ];

    const formatted = formatDiagnostics(diagnostics);
    expect(formatted).toContain("1 error(s) found:");
    expect(formatted).toContain("1 warning(s) found:");
  });

  it("handles diagnostics without pointer", () => {
    const diagnostics: SchemaValidationDiagnostic[] = [
      {
        pointer: "",
        message: "Root level error",
        keyword: "type",
        severity: "ERROR",
        source: "ajv",
      },
    ];

    const formatted = formatDiagnostics(diagnostics);
    expect(formatted).toContain("1. Root level error");
    // Empty pointer should not add "at" line
    expect(formatted).not.toContain("at ");
  });

  it("handles diagnostics without keyword", () => {
    const diagnostics: SchemaValidationDiagnostic[] = [
      {
        pointer: "/test",
        message: "Generic error",
        keyword: "",
        severity: "ERROR",
        source: "ajv",
      },
    ];

    const formatted = formatDiagnostics(diagnostics);
    expect(formatted).toContain("1. Generic error");
    // Empty keyword should not add "keyword:" line
    expect(formatted).not.toContain("keyword:");
  });
});

describe("formatValidationResult", () => {
  it("formats valid result", () => {
    const result: SchemaValidationResult = {
      valid: true,
      diagnostics: [],
      source: "ajv",
    };

    const formatted = formatValidationResult(result);
    expect(formatted).toContain("Validation passed");
  });

  it("formats invalid result with diagnostics", () => {
    const result: SchemaValidationResult = {
      valid: false,
      diagnostics: [
        {
          pointer: "/test",
          message: "Error message",
          keyword: "type",
          severity: "ERROR",
          source: "ajv",
        },
      ],
      source: "ajv",
    };

    const formatted = formatValidationResult(result);
    expect(formatted).toContain("Validation failed");
    expect(formatted).toContain("Error message");
    expect(formatted).toContain("Source: ajv");
  });
});

describe("isValidationError", () => {
  it("returns true for SchemaValidationError", () => {
    const error = new SchemaValidationError("Test error");
    expect(isValidationError(error)).toBe(true);
  });

  it("returns false for regular Error", () => {
    const error = new Error("Regular error");
    expect(isValidationError(error)).toBe(false);
  });

  it("returns false for non-error values", () => {
    expect(isValidationError(null)).toBe(false);
    expect(isValidationError(undefined)).toBe(false);
    expect(isValidationError("string")).toBe(false);
    expect(isValidationError(123)).toBe(false);
    expect(isValidationError({})).toBe(false);
  });
});

describe("extractValidationResult", () => {
  it("extracts result from SchemaValidationError", () => {
    const diagnostics: SchemaValidationDiagnostic[] = [
      {
        pointer: "/test",
        message: "Error",
        keyword: "type",
        severity: "ERROR",
        source: "goneat",
      },
    ];
    const error = new SchemaValidationError("Failed", "schema-id", diagnostics);

    const result = extractValidationResult(error);
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(diagnostics);
    expect(result.source).toBe("goneat");
  });

  it("returns ajv source for error without diagnostics", () => {
    const error = new SchemaValidationError("Failed");
    const result = extractValidationResult(error);
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.source).toBe("ajv");
  });

  it("returns valid result for non-validation errors", () => {
    const result1 = extractValidationResult(new Error("Regular error"));
    expect(result1.valid).toBe(true);
    expect(result1.source).toBe("ajv");

    const result2 = extractValidationResult(null);
    expect(result2.valid).toBe(true);

    const result3 = extractValidationResult("not an error");
    expect(result3.valid).toBe(true);
  });
});

describe("normalizePointer", () => {
  it("converts empty string to root", () => {
    expect(normalizePointer("")).toBe("root");
  });

  it("converts JSON pointer to dot notation", () => {
    expect(normalizePointer("/properties/name")).toBe("properties.name");
    expect(normalizePointer("/items/0/type")).toBe("items.0.type");
  });

  it("handles single level", () => {
    expect(normalizePointer("/name")).toBe("name");
  });
});

describe("createDiagnostic", () => {
  it("creates diagnostic with default values", () => {
    const diag = createDiagnostic("/test", "Test message", "type");
    expect(diag.pointer).toBe("/test");
    expect(diag.message).toBe("Test message");
    expect(diag.keyword).toBe("type");
    expect(diag.severity).toBe("ERROR");
    expect(diag.source).toBe("ajv");
    expect(diag.data).toBeUndefined();
  });

  it("creates diagnostic with all parameters", () => {
    const data = { expected: "string", actual: "number" };
    const diag = createDiagnostic("/test", "Type mismatch", "type", "WARN", "goneat", data);
    expect(diag.pointer).toBe("/test");
    expect(diag.message).toBe("Type mismatch");
    expect(diag.keyword).toBe("type");
    expect(diag.severity).toBe("WARN");
    expect(diag.source).toBe("goneat");
    expect(diag.data).toEqual(data);
  });
});

describe("groupDiagnosticsBySeverity", () => {
  it("groups empty array", () => {
    const result = groupDiagnosticsBySeverity([]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("groups errors and warnings separately", () => {
    const error1: SchemaValidationDiagnostic = {
      pointer: "/a",
      message: "Error 1",
      keyword: "type",
      severity: "ERROR",
      source: "ajv",
    };
    const error2: SchemaValidationDiagnostic = {
      pointer: "/b",
      message: "Error 2",
      keyword: "required",
      severity: "ERROR",
      source: "ajv",
    };
    const warning1: SchemaValidationDiagnostic = {
      pointer: "/c",
      message: "Warning 1",
      keyword: "additionalProperties",
      severity: "WARN",
      source: "ajv",
    };
    const warning2: SchemaValidationDiagnostic = {
      pointer: "/d",
      message: "Warning 2",
      keyword: "deprecated",
      severity: "WARN",
      source: "ajv",
    };

    const diagnostics = [error1, warning1, error2, warning2];
    const result = groupDiagnosticsBySeverity(diagnostics);

    expect(result.errors).toHaveLength(2);
    expect(result.errors).toContain(error1);
    expect(result.errors).toContain(error2);

    expect(result.warnings).toHaveLength(2);
    expect(result.warnings).toContain(warning1);
    expect(result.warnings).toContain(warning2);
  });

  it("handles only errors", () => {
    const diagnostics: SchemaValidationDiagnostic[] = [
      { pointer: "/a", message: "Error", keyword: "type", severity: "ERROR", source: "ajv" },
    ];
    const result = groupDiagnosticsBySeverity(diagnostics);
    expect(result.errors).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
  });

  it("handles only warnings", () => {
    const diagnostics: SchemaValidationDiagnostic[] = [
      { pointer: "/a", message: "Warning", keyword: "deprecated", severity: "WARN", source: "ajv" },
    ];
    const result = groupDiagnosticsBySeverity(diagnostics);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
  });
});

describe("countDiagnostics", () => {
  it("counts empty array", () => {
    const result = countDiagnostics([]);
    expect(result.total).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
  });

  it("counts errors and warnings", () => {
    const diagnostics: SchemaValidationDiagnostic[] = [
      { pointer: "/a", message: "Error 1", keyword: "type", severity: "ERROR", source: "ajv" },
      { pointer: "/b", message: "Error 2", keyword: "required", severity: "ERROR", source: "ajv" },
      { pointer: "/c", message: "Error 3", keyword: "minimum", severity: "ERROR", source: "ajv" },
      {
        pointer: "/d",
        message: "Warning 1",
        keyword: "deprecated",
        severity: "WARN",
        source: "ajv",
      },
      {
        pointer: "/e",
        message: "Warning 2",
        keyword: "additionalProperties",
        severity: "WARN",
        source: "ajv",
      },
    ];

    const result = countDiagnostics(diagnostics);
    expect(result.total).toBe(5);
    expect(result.errors).toBe(3);
    expect(result.warnings).toBe(2);
  });

  it("counts only errors", () => {
    const diagnostics: SchemaValidationDiagnostic[] = [
      { pointer: "/a", message: "Error", keyword: "type", severity: "ERROR", source: "ajv" },
    ];

    const result = countDiagnostics(diagnostics);
    expect(result.total).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.warnings).toBe(0);
  });

  it("counts only warnings", () => {
    const diagnostics: SchemaValidationDiagnostic[] = [
      { pointer: "/a", message: "Warning", keyword: "deprecated", severity: "WARN", source: "ajv" },
      { pointer: "/b", message: "Warning", keyword: "deprecated", severity: "WARN", source: "ajv" },
    ];

    const result = countDiagnostics(diagnostics);
    expect(result.total).toBe(2);
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(2);
  });
});
