import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { exportSchema, stripProvenance } from "../export.js";
import { normalizeSchema } from "../normalizer.js";
import { getSchema } from "../registry.js";

const TEST_OUT_DIR = join(tmpdir(), `schema-export-parity-${Date.now()}`);

beforeEach(async () => {
  await mkdir(TEST_OUT_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_OUT_DIR, { recursive: true, force: true });
});

describe("export parity", () => {
  test("exported schema matches runtime schema (minus provenance)", async () => {
    const schemaId = "library/foundry/v1.0.0/exit-codes";
    const outPath = join(TEST_OUT_DIR, "parity-test.json");

    // Export schema with provenance
    await exportSchema({
      schemaId,
      outPath,
      includeProvenance: true,
    });

    // Read exported content and strip provenance
    const exportedContent = await readFile(outPath, "utf-8");
    const stripped = stripProvenance(exportedContent);

    // Get runtime schema
    const schema = await getSchema(schemaId);
    const runtimeContent = await readFile(schema.path, "utf-8");

    // Normalize both for comparison
    const exportedNormalized = normalizeSchema(stripped);
    const runtimeNormalized = normalizeSchema(runtimeContent);

    // Should be identical after normalization
    expect(exportedNormalized).toBe(runtimeNormalized);
  }, 30000); // Generous timeout for CI environments

  test("multiple exports produce identical output (deterministic)", async () => {
    const schemaId = "library/foundry/v1.0.0/patterns";
    const outPath1 = join(TEST_OUT_DIR, "export1.json");
    const outPath2 = join(TEST_OUT_DIR, "export2.json");

    // Export same schema twice (without provenance to avoid timestamp differences)
    await exportSchema({
      schemaId,
      outPath: outPath1,
      includeProvenance: false,
    });

    await exportSchema({
      schemaId,
      outPath: outPath2,
      includeProvenance: false,
    });

    // Read both exports
    const content1 = await readFile(outPath1, "utf-8");
    const content2 = await readFile(outPath2, "utf-8");

    // Should be byte-for-byte identical
    expect(content1).toBe(content2);
  });

  test("JSON and YAML exports have same semantic content", async () => {
    const schemaId = "library/foundry/v1.0.0/mime-types";
    const jsonPath = join(TEST_OUT_DIR, "schema.json");
    const yamlPath = join(TEST_OUT_DIR, "schema.yaml");

    // Export to both formats without provenance
    await exportSchema({
      schemaId,
      outPath: jsonPath,
      format: "json",
      includeProvenance: false,
    });

    await exportSchema({
      schemaId,
      outPath: yamlPath,
      format: "yaml",
      includeProvenance: false,
    });

    // Read both
    const jsonContent = await readFile(jsonPath, "utf-8");
    const yamlContent = await readFile(yamlPath, "utf-8");

    // Normalize and compare
    const jsonNormalized = normalizeSchema(jsonContent);
    const yamlNormalized = normalizeSchema(yamlContent);

    expect(jsonNormalized).toBe(yamlNormalized);
  });

  test("provenance does not affect schema semantics", async () => {
    const schemaId = "library/foundry/v1.0.0/http-status-groups";
    const withProvenancePath = join(TEST_OUT_DIR, "with-prov.json");
    const withoutProvenancePath = join(TEST_OUT_DIR, "without-prov.json");

    // Export with and without provenance
    await exportSchema({
      schemaId,
      outPath: withProvenancePath,
      includeProvenance: true,
    });

    await exportSchema({
      schemaId,
      outPath: withoutProvenancePath,
      includeProvenance: false,
    });

    // Strip provenance from first export
    const withProvContent = await readFile(withProvenancePath, "utf-8");
    const stripped = stripProvenance(withProvContent);

    // Read second export
    const withoutProvContent = await readFile(withoutProvenancePath, "utf-8");

    // Normalize and compare
    const strippedNormalized = normalizeSchema(stripped);
    const withoutNormalized = normalizeSchema(withoutProvContent);

    expect(strippedNormalized).toBe(withoutNormalized);
  });

  test("validation ensures exported schemas are well-formed", async () => {
    const schemaId = "library/foundry/v1.0.0/exit-codes";
    const outPath = join(TEST_OUT_DIR, "validated.json");

    // Export with validation enabled
    const result = await exportSchema({
      schemaId,
      outPath,
      validate: true,
    });

    expect(result.success).toBe(true);

    // Read and verify it's valid JSON with proper schema structure
    const content = await readFile(outPath, "utf-8");
    const parsed = JSON.parse(content);

    // Verify schema structure
    expect(parsed.$schema).toBeDefined();
    expect(parsed.$schema).toContain("json-schema.org");
    expect(parsed.type).toBe("object");
  });
});
