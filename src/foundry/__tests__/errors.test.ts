/**
 * Foundry loader unit tests - simplified version
 */

import { describe, expect, it } from "vitest";
import { FoundryCatalogError } from "../errors.js";

describe("FoundryCatalogError", () => {
  it("should create error with correct properties", () => {
    const error = new FoundryCatalogError("Test error", "patterns");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("FoundryCatalogError");
    expect(error.message).toBe("Test error");
    expect(error.catalog).toBe("patterns");
    expect(error.cause).toBeUndefined();
  });

  it("should create error with cause", () => {
    const cause = new Error("Root cause");
    const error = new FoundryCatalogError("Test error", "patterns", cause);

    expect(error.cause).toBe(cause);
  });

  it("should create invalidSchema error", () => {
    const error = FoundryCatalogError.invalidSchema("patterns", "Missing field");

    expect(error).toBeInstanceOf(FoundryCatalogError);
    expect(error.message).toBe("Invalid schema in patterns catalog: Missing field");
    expect(error.catalog).toBe("patterns");
  });

  it("should create missingCatalog error", () => {
    const error = FoundryCatalogError.missingCatalog("patterns");

    expect(error).toBeInstanceOf(FoundryCatalogError);
    expect(error.message).toBe("Catalog patterns not found or could not be loaded");
    expect(error.catalog).toBe("patterns");
  });

  it("should create invalidPattern error", () => {
    const error = FoundryCatalogError.invalidPattern("test-pattern", "Invalid regex");

    expect(error).toBeInstanceOf(FoundryCatalogError);
    expect(error.message).toBe("Invalid pattern test-pattern: Invalid regex");
    expect(error.catalog).toBe("patterns");
  });

  it("should create compilationError error", () => {
    const cause = new Error("Regex syntax error");
    const error = FoundryCatalogError.compilationError("test-pattern", "Invalid syntax", cause);

    expect(error).toBeInstanceOf(FoundryCatalogError);
    expect(error.message).toBe("Failed to compile pattern test-pattern: Invalid syntax");
    expect(error.catalog).toBe("patterns");
    expect(error.cause).toBe(cause);
  });
});
