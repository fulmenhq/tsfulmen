/**
 * Schema validator tests
 */

import { describe, expect, it } from "vitest";
import {
  clearCache,
  compileSchema,
  getCacheSize,
  validateData,
  validateSchema,
} from "../validator.js";

describe("Schema Validator", () => {
  describe("Basic validation", () => {
    it("should validate data against simple schema", async () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number", minimum: 0 },
        },
        required: ["name"],
      };

      const validator = await compileSchema(schema);
      const result = validateData({ name: "John", age: 25 }, validator);

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.source).toBe("ajv");
    });

    it("should detect validation errors", async () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number", minimum: 0 },
        },
        required: ["name"],
      };

      const validator = await compileSchema(schema);
      const result = validateData({ age: -5 }, validator);

      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.source).toBe("ajv");
    });

    it("should validate schema itself", async () => {
      const validSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };

      const result = await validateSchema(validSchema);
      expect(result.valid).toBe(true);
    });

    it("should detect invalid schema", async () => {
      const invalidSchema = {
        type: "invalid-type",
        properties: {},
      };

      const result = await validateSchema(invalidSchema);
      expect(result.valid).toBe(false);
    });
  });

  describe("Cache management", () => {
    it("should clear cache", () => {
      clearCache();
      expect(getCacheSize()).toBe(0);
    });

    it("should track cache size", async () => {
      clearCache();
      expect(getCacheSize()).toBe(0);

      const schema = { type: "object" };
      await compileSchema(schema);

      // Cache size should increase after compilation
      expect(getCacheSize()).toBeGreaterThan(0);
    });
  });

  describe("YAML schema support", () => {
    it("should compile YAML schema", async () => {
      const yamlSchema = `
type: object
properties:
  name:
    type: string
required:
  - name
`;

      const validator = await compileSchema(yamlSchema);
      const result = validateData({ name: "Test" }, validator);

      expect(result.valid).toBe(true);
    });
  });
});
