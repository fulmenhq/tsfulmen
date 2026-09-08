import { rmSync } from "node:fs";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SchemaValidationError } from "../errors.js";
import {
  validateInstance,
  validateInstanceBytes,
  validateInstanceFile,
  validateInstanceWithSchemaFile,
} from "../file.js";

describe("file-backed schema validation", () => {
  let dir: string;
  const itPosix = process.platform === "win32" ? it.skip : it;

  beforeEach(async () => {
    dir = join(
      tmpdir(),
      `tsfulmen-schema-file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "root.schema.json"),
      JSON.stringify({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: "https://schemas.example.test/catalog/root.schema.json",
        type: "object",
        additionalProperties: false,
        required: ["name", "widget"],
        properties: {
          name: { type: "string" },
          widget: { $ref: "widget.schema.json" },
        },
      }),
    );
    await writeFile(
      join(dir, "widget.schema.json"),
      JSON.stringify({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: "https://schemas.example.test/catalog/widget.schema.json",
        type: "object",
        additionalProperties: false,
        required: ["$id", "kind"],
        properties: {
          $id: { const: "widget-1" },
          kind: { const: "ok" },
        },
      }),
    );
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("validates an on-disk schema catalog and reports instance keywords", async () => {
    const valid = await validateInstanceWithSchemaFile(
      join(dir, "root.schema.json"),
      { name: "n", widget: { $id: "widget-1", kind: "ok" } },
      { refDirs: [dir] },
    );
    expect(valid).toMatchObject({ valid: true, diagnostics: [] });

    const extra = await validateInstanceWithSchemaFile(
      join(dir, "root.schema.json"),
      { name: "n", widget: { $id: "widget-1", kind: "ok" }, extra: true },
      { refDirs: [dir] },
    );
    expect(extra.valid).toBe(false);
    expect(extra.diagnostics.some((item) => item.keyword === "additionalProperties")).toBe(true);

    const missing = await validateInstanceWithSchemaFile(
      join(dir, "root.schema.json"),
      { name: "n", widget: { kind: "ok" } },
      { refDirs: [dir] },
    );
    expect(missing.valid).toBe(false);
    expect(missing.diagnostics.some((item) => item.keyword === "required")).toBe(true);
  });

  it("validates instance files and bytes", async () => {
    const instancePath = join(dir, "instance.yaml");
    await writeFile(instancePath, "name: n\nwidget:\n  $id: widget-1\n  kind: ok\n");
    expect(
      (await validateInstanceFile(join(dir, "root.schema.json"), instancePath, { refDirs: [dir] }))
        .valid,
    ).toBe(true);
    expect(
      (
        await validateInstanceBytes(
          join(dir, "root.schema.json"),
          Buffer.from('{"name":"n","widget":{"$id":"widget-1","kind":"ok"}}'),
          { refDirs: [dir] },
        )
      ).valid,
    ).toBe(true);
  });

  it("loads embedded meta-schemas for declared draft-06 and draft-07", async () => {
    for (const draft of ["06", "07"]) {
      const $schema = `http://json-schema.org/draft-${draft}/schema#`;
      const schemaPath = join(dir, `declared-${draft}.schema.json`);
      await writeFile(schemaPath, JSON.stringify({ $schema, type: "string", const: "valid" }));

      await expect(
        validateInstanceWithSchemaFile(schemaPath, "valid", { refDirs: [dir] }),
      ).resolves.toMatchObject({ valid: true, diagnostics: [] });
    }
  });

  it("validates an in-memory schema and resolves a separate refDirs catalog", async () => {
    expect((await validateInstance({ type: "string", const: "ok" }, "ok")).valid).toBe(true);

    const schemaDir = join(dir, "schemas");
    const refDir = join(dir, "refs");
    await mkdir(schemaDir, { recursive: true });
    await mkdir(refDir, { recursive: true });
    await writeFile(
      join(schemaDir, "external-root.schema.json"),
      JSON.stringify({
        $id: "https://schemas.example.test/external/root.schema.json",
        $ref: "https://schemas.example.test/external/leaf.schema.json",
      }),
    );
    await writeFile(
      join(refDir, "leaf.schema.json"),
      JSON.stringify({
        $id: "https://schemas.example.test/external/leaf.schema.json",
        type: "string",
        const: "external",
      }),
    );

    expect(
      (
        await validateInstanceWithSchemaFile(
          join(schemaDir, "external-root.schema.json"),
          "external",
          { refDirs: [refDir] },
        )
      ).valid,
    ).toBe(true);
  });

  it("rejects an in-memory relative external ref without consulting cwd", async () => {
    const existingSchema = join(dir, "cwd-visible.schema.json");
    await writeFile(existingSchema, '{"type":"string","const":"should-not-load"}');
    const relativeRef = relative(process.cwd(), existingSchema).replaceAll("\\", "/");

    await expect(
      validateInstance({ $ref: relativeRef }, "should-not-load", { refDirs: [dir] }),
    ).rejects.toThrow(/relative external \$ref requires validateInstanceWithSchemaFile/i);
  });

  it("resolves a contained local file URL", async () => {
    const schemaPath = join(dir, "file-url.schema.json");
    await writeFile(
      schemaPath,
      JSON.stringify({
        type: "object",
        properties: {
          widget: { $ref: pathToFileURL(join(dir, "widget.schema.json")).href },
        },
      }),
    );
    expect(
      (
        await validateInstanceWithSchemaFile(
          schemaPath,
          { widget: { $id: "widget-1", kind: "ok" } },
          { refDirs: [dir] },
        )
      ).valid,
    ).toBe(true);
  });

  it("rejects traversal, unsupported schemes, and non-local file hosts as compile failures", async () => {
    const cases = [
      "../outside.schema.json",
      "ftp://example.test/schema.json",
      "file://example.test/tmp/schema.json",
    ];
    for (const ref of cases) {
      const schemaPath = join(dir, `invalid-${cases.indexOf(ref)}.schema.json`);
      await writeFile(
        schemaPath,
        JSON.stringify({ type: "object", properties: { x: { $ref: ref } } }),
      );
      await expect(
        validateInstanceWithSchemaFile(schemaPath, {}, { refDirs: [dir] }),
      ).rejects.toBeInstanceOf(SchemaValidationError);
    }
  });

  it("does not rebind an escaping relative ref to a contained basename match", async () => {
    await writeFile(
      join(dir, "escape.schema.json"),
      JSON.stringify({
        $id: "https://schemas.example.test/escape.schema.json",
        type: "string",
        const: "decoy",
      }),
    );
    const schemaPath = join(dir, "escape-root.schema.json");
    await writeFile(
      schemaPath,
      JSON.stringify({
        $id: "https://schemas.example.test/catalog/escape-root.schema.json",
        $ref: "../escape.schema.json",
      }),
    );

    await expect(
      validateInstanceWithSchemaFile(schemaPath, "decoy", { refDirs: [dir] }),
    ).rejects.toThrow(/not contained in catalog roots/i);
  });

  itPosix("rejects a symlink outside the catalog", async () => {
    const outside = join(tmpdir(), `tsfulmen-outside-${Date.now()}.schema.json`);
    await writeFile(outside, '{"type":"string"}');
    await symlink(outside, join(dir, "escape.schema.json"));
    await expect(
      validateInstanceWithSchemaFile(join(dir, "root.schema.json"), {}, { refDirs: [dir] }),
    ).rejects.toThrow(/symlink/i);
    rmSync(outside, { force: true });
  });

  it("rejects duplicate schema ids", async () => {
    const widget = await readFile(join(dir, "widget.schema.json"), "utf8");
    await writeFile(join(dir, "duplicate.schema.json"), widget);
    await expect(
      validateInstanceWithSchemaFile(join(dir, "root.schema.json"), {}, { refDirs: [dir] }),
    ).rejects.toThrow(/duplicate schema \$id/i);
  });

  it("rejects ambiguous path suffixes in path-only mode", async () => {
    await mkdir(join(dir, "a"), { recursive: true });
    await mkdir(join(dir, "b"), { recursive: true });
    await writeFile(join(dir, "a", "shared.schema.json"), '{"type":"string"}');
    await writeFile(join(dir, "b", "shared.schema.json"), '{"type":"number"}');
    const schemaPath = join(dir, "path-only.schema.json");
    await writeFile(
      schemaPath,
      JSON.stringify({
        $id: "https://schemas.example.test/catalog/path-only.schema.json",
        type: "object",
        properties: { value: { $ref: "shared.schema.json" } },
      }),
    );
    await expect(
      validateInstanceWithSchemaFile(
        schemaPath,
        {},
        {
          refDirs: [dir],
          resolution: "path-only",
        },
      ),
    ).rejects.toThrow(/ambiguous schema path suffix/i);
  });
});
