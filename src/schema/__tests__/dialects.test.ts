/**
 * JSON Schema dialect support tests (draft-04 .. 2020-12)
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileSchema, validateData, validateSchema } from "../validator.js";

function getFixturesDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, "..", "..", "..", "schemas", "crucible-ts", "meta", "fixtures");
}

describe("Schema Validator - dialect support", () => {
  it("meta-validates all supported drafts (fixtures)", async () => {
    const dir = getFixturesDir();
    const fixtureFiles = [
      "draft-04-sample.json",
      "draft-06-sample.json",
      "draft-07-sample.json",
      "draft-2019-09-sample.json",
      "draft-2020-12-sample.json",
    ];

    for (const file of fixtureFiles) {
      const content = await readFile(join(dir, file), "utf-8");
      const result = await validateSchema(content);
      expect(result.valid, `fixture should validate: ${file}`).toBe(true);
    }
  });

  it("compiles + validates draft-04 semantics (exclusiveMinimum boolean)", async () => {
    const schema = {
      $schema: "http://json-schema.org/draft-04/schema#",
      type: "number",
      minimum: 5,
      exclusiveMinimum: true,
    };

    const validator = await compileSchema(schema);

    expect(validateData(5, validator).valid).toBe(false);
    expect(validateData(6, validator).valid).toBe(true);
  });

  it("compiles + validates draft-2019-09 recursive keywords", async () => {
    const schema = {
      $schema: "https://json-schema.org/draft/2019-09/schema",
      $recursiveAnchor: true,
      type: "object",
      properties: {
        child: { $recursiveRef: "#" },
      },
    };

    const validator = await compileSchema(schema);
    expect(validateData({ child: {} }, validator).valid).toBe(true);
  });

  it("compiles + validates draft-2020-12 keywords (prefixItems)", async () => {
    const schema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "array",
      prefixItems: [{ type: "string" }, { type: "number" }],
      items: false,
    };

    const validator = await compileSchema(schema);
    expect(validateData(["a", 1], validator).valid).toBe(true);
    expect(validateData(["a", "b"], validator).valid).toBe(false);
  });
});
