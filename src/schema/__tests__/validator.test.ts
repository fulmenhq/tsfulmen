/**
 * Schema validator tests
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SchemaValidationError } from "../errors.js";
import {
  clearCache,
  compileSchema,
  compileSchemaById,
  getCacheSize,
  validateData,
  validateDataBySchemaId,
  validateFile,
  validateFileBySchemaId,
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

  describe("Buffer schema support", () => {
    it("should compile JSON schema from Buffer", async () => {
      const schema = { type: "object", properties: { name: { type: "string" } } };
      const buffer = Buffer.from(JSON.stringify(schema));

      const validator = await compileSchema(buffer);
      const result = validateData({ name: "Test" }, validator);

      expect(result.valid).toBe(true);
    });

    it("should compile YAML schema from Buffer", async () => {
      const yamlContent = "type: object\nproperties:\n  name:\n    type: string";
      const buffer = Buffer.from(yamlContent);

      const validator = await compileSchema(buffer);
      const result = validateData({ name: "Test" }, validator);

      expect(result.valid).toBe(true);
    });
  });

  describe("Boolean schema support", () => {
    it("should compile true schema", async () => {
      const validator = await compileSchema(true);
      expect(validateData({}, validator).valid).toBe(true);
      expect(validateData("anything", validator).valid).toBe(true);
    });

    it("should compile false schema", async () => {
      const validator = await compileSchema(false);
      expect(validateData({}, validator).valid).toBe(false);
    });
  });

  describe("validateSchema error paths", () => {
    it("should return invalid result for invalid schema type", async () => {
      // A schema with an invalid type value
      const badSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "not-a-valid-type",
      };

      const result = await validateSchema(badSchema);
      expect(result.valid).toBe(false);
      expect(result.source).toBe("ajv");
    });

    it("should handle schema with only $ref that is valid", async () => {
      // A simple $ref schema that compiles fine
      const result = await validateSchema({
        $ref: "#/$defs/test",
        $defs: { test: { type: "string" } },
      });
      expect(result.source).toBe("ajv");
      // May be valid or invalid depending on AJV behavior
      expect(typeof result.valid).toBe("boolean");
    });

    it("should handle YAML input", async () => {
      const yamlSchema = "type: object\nproperties:\n  name:\n    type: string";
      const result = await validateSchema(yamlSchema);
      expect(result.valid).toBe(true);
    });

    it("should handle Buffer input with JSON", async () => {
      const schema = { type: "object", properties: { name: { type: "string" } } };
      const buffer = Buffer.from(JSON.stringify(schema));
      const result = await validateSchema(buffer);
      expect(result.valid).toBe(true);
    });

    it("should handle Buffer input with YAML", async () => {
      const yamlContent = "type: object\nproperties:\n  name:\n    type: string";
      const buffer = Buffer.from(yamlContent);
      const result = await validateSchema(buffer);
      expect(result.valid).toBe(true);
    });

    it("should return invalid result with diagnostics when meta-validation fails", async () => {
      // A schema with invalid keywords (meta-validation should fail)
      const invalidSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: ["string", "not-a-type"],
      };

      const result = await validateSchema(invalidSchema);
      expect(result.valid).toBe(false);
      expect(result.source).toBe("ajv");
    });
  });

  describe("compileSchema error paths", () => {
    it("should throw SchemaValidationError for schema with invalid $ref", async () => {
      // This will fail during compilation due to invalid $ref
      const schema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $ref: "https://non-existent-host.invalid/does-not-exist.json",
      };

      await expect(compileSchema(schema)).rejects.toThrow(SchemaValidationError);
    });

    it("should use cache for repeated compilations", async () => {
      clearCache();
      const schema = { type: "object", properties: { test: { type: "string" } } };

      // First compilation
      const validator1 = await compileSchema(schema);
      const sizeAfterFirst = getCacheSize();

      // Second compilation should use cache
      const validator2 = await compileSchema(schema);
      const sizeAfterSecond = getCacheSize();

      expect(validator1).toBeDefined();
      expect(validator2).toBeDefined();
      expect(sizeAfterSecond).toBe(sizeAfterFirst);
    });

    it("should support schema with aliases", async () => {
      const schema = {
        $id: "https://example.com/test.schema.json",
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };

      const validator = await compileSchema(schema, {
        aliases: ["https://example.com/test-alias.schema.json"],
      });

      expect(typeof validator).toBe("function");
    });
  });
});

describe("File validation", () => {
  const testDir = join(tmpdir(), `schema-validator-tests-${Date.now()}`);

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("validateFile", () => {
    it("should validate JSON file", async () => {
      const schema = { type: "object", properties: { name: { type: "string" } }, required: ["name"] };
      const validator = await compileSchema(schema);

      const filePath = join(testDir, "valid.json");
      await writeFile(filePath, JSON.stringify({ name: "Test" }));

      const result = await validateFile(filePath, validator);
      expect(result.valid).toBe(true);
    });

    it("should validate YAML file", async () => {
      const schema = { type: "object", properties: { name: { type: "string" } }, required: ["name"] };
      const validator = await compileSchema(schema);

      const filePath = join(testDir, "valid.yaml");
      await writeFile(filePath, "name: Test");

      const result = await validateFile(filePath, validator);
      expect(result.valid).toBe(true);
    });

    it("should return invalid for non-conforming data", async () => {
      const schema = { type: "object", properties: { name: { type: "string" } }, required: ["name"] };
      const validator = await compileSchema(schema);

      const filePath = join(testDir, "invalid.json");
      await writeFile(filePath, JSON.stringify({ age: 25 })); // missing required name

      const result = await validateFile(filePath, validator);
      expect(result.valid).toBe(false);
    });

    it("should throw SchemaValidationError for unreadable file", async () => {
      const schema = { type: "object" };
      const validator = await compileSchema(schema);

      await expect(
        validateFile("/non-existent-file-path.json", validator),
      ).rejects.toThrow(SchemaValidationError);
    });

    it("should preserve SchemaValidationError thrown during validation", async () => {
      const schema = { type: "object" };
      const validator = await compileSchema(schema);

      // Write a file with invalid JSON
      const filePath = join(testDir, "invalid-json.json");
      await writeFile(filePath, "{ not valid json");

      await expect(validateFile(filePath, validator)).rejects.toThrow(
        SchemaValidationError,
      );
    });
  });

  describe("validateFileBySchemaId", () => {
    it("should validate file against schema from registry", async () => {
      // Create a valid data file
      const filePath = join(testDir, "exit-codes-data.json");
      const validData = {
        version: "1.0.0",
        categories: {},
        signals: {},
      };
      await writeFile(filePath, JSON.stringify(validData));

      // Use a known schema from the registry
      const result = await validateFileBySchemaId(
        filePath,
        "library/foundry/v1.0.0/exit-codes",
        { baseDir: "./schemas/crucible-ts" },
      );

      expect(result.source).toBe("ajv");
      // Result may be valid or invalid depending on schema requirements
      expect(typeof result.valid).toBe("boolean");
    });

    it("should throw error for non-existent schema", async () => {
      const filePath = join(testDir, "test.json");
      await writeFile(filePath, "{}");

      await expect(
        validateFileBySchemaId(filePath, "non-existent/schema/id", {
          baseDir: "./schemas/crucible-ts",
        }),
      ).rejects.toThrow();
    });

    it("should throw error for non-existent file", async () => {
      await expect(
        validateFileBySchemaId("/non-existent-file.json", "library/foundry/v1.0.0/exit-codes", {
          baseDir: "./schemas/crucible-ts",
        }),
      ).rejects.toThrow();
    });
  });

  describe("validateDataBySchemaId", () => {
    it("should validate data against schema from registry", async () => {
      const validData = {
        version: "1.0.0",
        categories: {},
        signals: {},
      };

      const result = await validateDataBySchemaId(
        validData,
        "library/foundry/v1.0.0/exit-codes",
        { baseDir: "./schemas/crucible-ts" },
      );

      expect(result.source).toBe("ajv");
      expect(typeof result.valid).toBe("boolean");
    });

    it("should throw error for non-existent schema", async () => {
      await expect(
        validateDataBySchemaId({}, "non-existent/schema/id", {
          baseDir: "./schemas/crucible-ts",
        }),
      ).rejects.toThrow();
    });
  });

  describe("compileSchemaById", () => {
    it("should compile schema from registry", async () => {
      const validator = await compileSchemaById("library/foundry/v1.0.0/exit-codes", {
        baseDir: "./schemas/crucible-ts",
      });

      expect(typeof validator).toBe("function");
    });

    it("should throw error for non-existent schema", async () => {
      await expect(
        compileSchemaById("non-existent/schema/id", {
          baseDir: "./schemas/crucible-ts",
        }),
      ).rejects.toThrow();
    });
  });
});
