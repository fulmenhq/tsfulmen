/**
 * Validator in EMBEDDED asset mode (v0.4.0 T4a).
 *
 * Forces `TSFULMEN_ASSET_MODE=embedded` so metaschema + vocabulary loads resolve
 * from the generated embedded modules (registered by the schema subpath) instead
 * of the filesystem — proving config/schema validation works in a `bun --compile`
 * single-file binary. Isolated in its own test file so the validator's per-dialect
 * caches start cold under embedded mode.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearEmbeddedAssets, resetAssetResolver } from "../../assets/index.js";
import { compileSchema, validateData } from "../validator.js";

describe("validator (embedded asset mode)", () => {
  beforeAll(() => {
    process.env.TSFULMEN_ASSET_MODE = "embedded";
    resetAssetResolver();
  });

  afterAll(() => {
    delete process.env.TSFULMEN_ASSET_MODE;
    resetAssetResolver();
    clearEmbeddedAssets();
  });

  it("loads the draft-07 metaschema from embedded assets and validates", async () => {
    const validator = await compileSchema(
      JSON.stringify({
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        required: ["x"],
        properties: { x: { type: "string" } },
      }),
    );
    expect(validateData({ x: "ok" }, validator).valid).toBe(true);
    expect(validateData({ x: 1 }, validator).valid).toBe(false);
  });

  it("loads draft-2020-12 metaschema + vocabulary from embedded assets", async () => {
    const validator = await compileSchema(
      JSON.stringify({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: { y: { type: "number" } },
        required: ["y"],
      }),
    );
    expect(validateData({ y: 2 }, validator).valid).toBe(true);
    expect(validateData({ y: "no" }, validator).valid).toBe(false);
  });
});
