import { describe, expect, it } from "vitest";
import { AssetNotFoundError } from "../errors.js";
import { listSchemas, loadSchemaById } from "../schemas.js";

describe("listSchemas", () => {
  it("returns all schema assets", async () => {
    const schemas = await listSchemas();

    expect(schemas.length).toBeGreaterThan(0);
    expect(schemas.every((s) => s.category === "schemas")).toBe(true);
  });

  it("extracts schema kind from path", async () => {
    const schemas = await listSchemas();

    expect(schemas.every((s) => s.kind.length > 0)).toBe(true);
    expect(schemas.some((s) => s.kind === "observability")).toBe(true);
  });

  it("extracts version from path", async () => {
    const schemas = await listSchemas();

    expect(schemas.every((s) => s.version.length > 0)).toBe(true);
  });

  it("filters by kind", async () => {
    const loggingSchemas = await listSchemas("observability");

    expect(loggingSchemas.length).toBeGreaterThan(0);
    expect(loggingSchemas.every((s) => s.kind === "observability")).toBe(true);
  });

  it("includes known schema kinds", async () => {
    const schemas = await listSchemas();
    const kinds = new Set(schemas.map((s) => s.kind));

    expect(kinds.has("observability")).toBe(true);
    expect(kinds.has("library")).toBe(true);
  });

  it("returns sorted results", async () => {
    const schemas = await listSchemas();
    const ids = schemas.map((s) => s.id);

    const sorted = [...ids].sort((a, b) => a.localeCompare(b));
    expect(ids).toEqual(sorted);
  });
});

describe("loadSchemaById", () => {
  it("loads and parses JSON schema", async () => {
    const schema = await loadSchemaById("observability/logging/v1.0.0/logger-config");

    expect(schema).toBeDefined();
    expect(typeof schema).toBe("object");
  });

  it("parses schema with $schema field", async () => {
    const schema = await loadSchemaById("observability/logging/v1.0.0/logger-config");

    expect(schema).toHaveProperty("$schema");
  });

  it("loads library foundry schemas", async () => {
    const schema = await loadSchemaById("library/foundry/v1.0.0/patterns");

    expect(schema).toBeDefined();
    expect(typeof schema).toBe("object");
  });

  it("throws AssetNotFoundError for missing schema", async () => {
    await expect(loadSchemaById("nonexistent/schema")).rejects.toThrow(AssetNotFoundError);
  });

  it("includes suggestions in error", async () => {
    try {
      await loadSchemaById("observability/logging/v1.0.0/loger-config");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AssetNotFoundError);
      const notFoundError = error as AssetNotFoundError;
      expect(notFoundError.suggestions.length).toBeGreaterThan(0);
      expect(notFoundError.suggestions).toContain("observability/logging/v1.0.0/logger-config");
    }
  });

  it("handles schemas with complex structures", async () => {
    const schema = await loadSchemaById("observability/logging/v1.0.0/logger-config");

    const schemaObj = schema as Record<string, unknown>;
    expect(schemaObj).toHaveProperty("type");
    expect(schemaObj).toHaveProperty("properties");
  });

  it("preserves schema validation rules", async () => {
    const schema = await loadSchemaById("observability/logging/v1.0.0/logger-config");

    const schemaObj = schema as Record<string, unknown>;
    const properties = schemaObj.properties as Record<string, unknown>;
    expect(properties).toBeDefined();
    expect(Object.keys(properties).length).toBeGreaterThan(0);
  });
});
