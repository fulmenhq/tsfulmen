import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { SchemaExportError } from "../errors.js";
import { exportSchema } from "../export.js";

/**
 * CLI export tests
 *
 * Note: These tests validate the export logic that the CLI uses.
 * Full bin execution tests would require a published CLI entry point.
 */

const TEST_OUT_DIR = join(tmpdir(), `schema-cli-export-${Date.now()}`);

beforeEach(async () => {
  await mkdir(TEST_OUT_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_OUT_DIR, { recursive: true, force: true });
});

describe("CLI export command logic", () => {
  describe("option handling", () => {
    test("--schema-id and --out (required options)", async () => {
      const outPath = join(TEST_OUT_DIR, "required-opts.json");

      const result = await exportSchema({
        schemaId: "library/foundry/v1.0.0/exit-codes",
        outPath,
      });

      expect(result.success).toBe(true);
      expect(result.schemaId).toBe("library/foundry/v1.0.0/exit-codes");
      expect(result.outPath).toBe(outPath);
    });

    test("--force flag enables overwrite", async () => {
      const outPath = join(TEST_OUT_DIR, "force-test.json");

      // First export
      await exportSchema({
        schemaId: "library/foundry/v1.0.0/exit-codes",
        outPath,
      });

      // Second export with force should succeed
      const result = await exportSchema({
        schemaId: "library/foundry/v1.0.0/patterns",
        outPath,
        overwrite: true, // Maps to --force
      });

      expect(result.success).toBe(true);
      expect(result.schemaId).toBe("library/foundry/v1.0.0/patterns");
    });

    test("--no-provenance excludes metadata", async () => {
      const outPath = join(TEST_OUT_DIR, "no-prov.json");

      const result = await exportSchema({
        schemaId: "library/foundry/v1.0.0/exit-codes",
        outPath,
        includeProvenance: false, // Maps to --no-provenance
      });

      expect(result.includeProvenance).toBe(false);
      expect(result.provenance).toBeUndefined();

      const content = await readFile(outPath, "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed.$comment?.["x-crucible-source"]).toBeUndefined();
    });

    test("--no-validate skips validation", async () => {
      const outPath = join(TEST_OUT_DIR, "no-validate.json");

      const result = await exportSchema({
        schemaId: "library/foundry/v1.0.0/exit-codes",
        outPath,
        validate: false, // Maps to --no-validate
      });

      expect(result.success).toBe(true);
    });

    test("--format json exports JSON", async () => {
      const outPath = join(TEST_OUT_DIR, "explicit-json.json");

      const result = await exportSchema({
        schemaId: "library/foundry/v1.0.0/exit-codes",
        outPath,
        format: "json", // Maps to --format json
      });

      expect(result.format).toBe("json");

      const content = await readFile(outPath, "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    });

    test("--format yaml exports YAML", async () => {
      const outPath = join(TEST_OUT_DIR, "explicit-yaml.yaml");

      const result = await exportSchema({
        schemaId: "library/foundry/v1.0.0/exit-codes",
        outPath,
        format: "yaml", // Maps to --format yaml
      });

      expect(result.format).toBe("yaml");

      const content = await readFile(outPath, "utf-8");
      expect(content).toContain("$schema:");
    });

    test("--format auto detects from extension", async () => {
      const jsonPath = join(TEST_OUT_DIR, "auto.json");
      const yamlPath = join(TEST_OUT_DIR, "auto.yaml");

      const jsonResult = await exportSchema({
        schemaId: "library/foundry/v1.0.0/exit-codes",
        outPath: jsonPath,
        format: "auto", // Maps to --format auto (default)
      });

      const yamlResult = await exportSchema({
        schemaId: "library/foundry/v1.0.0/exit-codes",
        outPath: yamlPath,
        format: "auto",
      });

      expect(jsonResult.format).toBe("json");
      expect(yamlResult.format).toBe("yaml");
    });
  });

  describe("error conditions for exit code mapping", () => {
    test("file already exists error", async () => {
      const outPath = join(TEST_OUT_DIR, "exists.json");

      await exportSchema({
        schemaId: "library/foundry/v1.0.0/exit-codes",
        outPath,
      });

      // Try to export again without force
      const error = await exportSchema({
        schemaId: "library/foundry/v1.0.0/exit-codes",
        outPath,
        overwrite: false,
      }).catch((err) => err);

      expect(error).toBeInstanceOf(SchemaExportError);
      expect(error.message.toLowerCase()).toContain("already exists");
      // CLI would map this to EXIT_FILE_WRITE_ERROR (54)
    });

    test("invalid format error", async () => {
      const outPath = join(TEST_OUT_DIR, "invalid.txt");

      const error = await exportSchema({
        schemaId: "library/foundry/v1.0.0/exit-codes",
        outPath,
      }).catch((err) => err);

      expect(error).toBeInstanceOf(SchemaExportError);
      expect(error.message.toLowerCase()).toContain("invalid");
      expect(error.message.toLowerCase()).toContain("format");
      // CLI would map this to EXIT_INVALID_ARGUMENT (40)
    });

    test("schema not found error", async () => {
      const outPath = join(TEST_OUT_DIR, "not-found.json");

      const error = await exportSchema({
        schemaId: "does/not/exist/v1.0.0/missing",
        outPath,
      }).catch((err) => err);

      expect(error).toBeDefined();
      expect(error.message.toLowerCase()).toContain("not found");
      // CLI would map this to EXIT_FILE_NOT_FOUND (51)
    });
  });

  describe("success output format", () => {
    test("exports with all provenance fields", async () => {
      const outPath = join(TEST_OUT_DIR, "full-output.json");

      const result = await exportSchema({
        schemaId: "library/foundry/v1.0.0/exit-codes",
        outPath,
        includeProvenance: true,
      });

      // Verify all fields CLI would display
      expect(result.success).toBe(true);
      expect(result.schemaId).toBeDefined();
      expect(result.outPath).toBeDefined();
      expect(result.format).toBeDefined();
      expect(result.provenance?.crucible_version).toBeDefined();
      expect(result.provenance?.library_version).toBeDefined();
      expect(result.provenance?.revision).toBeDefined();
      expect(result.provenance?.exported_at).toBeDefined();
    });

    test("minimal output without provenance", async () => {
      const outPath = join(TEST_OUT_DIR, "minimal-output.json");

      const result = await exportSchema({
        schemaId: "library/foundry/v1.0.0/exit-codes",
        outPath,
        includeProvenance: false,
      });

      expect(result.success).toBe(true);
      expect(result.schemaId).toBe("library/foundry/v1.0.0/exit-codes");
      expect(result.outPath).toBe(outPath);
      expect(result.format).toBe("json");
      expect(result.includeProvenance).toBe(false);
      expect(result.provenance).toBeUndefined();
    });
  });

  describe("combined options", () => {
    test("all options together", async () => {
      const outPath = join(TEST_OUT_DIR, "combined", "schema.yaml");

      const result = await exportSchema({
        schemaId: "library/foundry/v1.0.0/patterns",
        outPath,
        includeProvenance: true,
        validate: true,
        overwrite: false,
        format: "yaml",
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe("yaml");
      expect(result.includeProvenance).toBe(true);

      const content = await readFile(outPath, "utf-8");
      expect(content).toContain("# x-crucible-source:");
    });
  });
});
