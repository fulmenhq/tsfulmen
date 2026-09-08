/**
 * File-backed JSON Schema instance validation with offline catalog resolution.
 */

import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv, { type AnySchemaObject } from "ajv";
import Ajv2019 from "ajv/dist/2019.js";
import Ajv2020 from "ajv/dist/2020.js";
import AjvDraft04 from "ajv-draft-04";
import { parse as parseYAML } from "yaml";
import { applyFulmenAjvFormats } from "./ajv-formats.js";
import { SchemaValidationError } from "./errors.js";
import type { CompiledValidator, SchemaInput, SchemaValidationResult } from "./types.js";
import { initializeAjvMetaSchemas, type JsonSchemaDialect, validateData } from "./validator.js";

export interface FileSchemaOptions {
  /** Additional directories searched for referenced schemas. */
  refDirs?: string[];
  /** Prefer exact `$id` matches, or resolve only by path suffix. */
  resolution?: "prefer-id" | "path-only";
}

interface CatalogEntry {
  path: string;
  schema: Record<string, unknown> | boolean;
}

interface Catalog {
  entries: CatalogEntry[];
  ids: Map<string, CatalogEntry>;
  relativeRefs: Map<string, CatalogEntry>;
  roots: string[];
  resolution: NonNullable<FileSchemaOptions["resolution"]>;
}

function stripFragment(value: string): string {
  const index = value.indexOf("#");
  return index === -1 ? value : value.slice(0, index);
}

function detectDialect(schema: unknown): JsonSchemaDialect {
  if (schema && typeof schema === "object" && !Array.isArray(schema)) {
    const declared = (schema as { $schema?: unknown }).$schema;
    if (typeof declared === "string") {
      if (declared.includes("draft-04")) return "draft-04";
      if (declared.includes("draft-06")) return "draft-06";
      if (declared.includes("draft-07")) return "draft-07";
      if (declared.includes("draft/2019-09")) return "draft-2019-09";
    }
  }
  return "draft-2020-12";
}

function parseDocument(content: string | Buffer, label: string): Record<string, unknown> | boolean {
  const text = Buffer.isBuffer(content) ? content.toString("utf8") : content;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "boolean" || (parsed !== null && typeof parsed === "object")) {
      return parsed as Record<string, unknown> | boolean;
    }
  } catch {
    try {
      const parsed = parseYAML(text) as unknown;
      if (typeof parsed === "boolean" || (parsed !== null && typeof parsed === "object")) {
        return parsed as Record<string, unknown> | boolean;
      }
    } catch (error) {
      throw SchemaValidationError.compileFailed(label, error as Error);
    }
  }
  throw SchemaValidationError.compileFailed(
    label,
    new Error("schema must be an object or boolean"),
  );
}

function parseInstance(content: string | Buffer, label: string): unknown {
  const text = Buffer.isBuffer(content) ? content.toString("utf8") : content;
  try {
    return JSON.parse(text);
  } catch {
    try {
      return parseYAML(text);
    } catch (error) {
      throw SchemaValidationError.invalidSchemaInput(
        { type: "file", id: label, content: text },
        `failed to parse instance: ${(error as Error).message}`,
      );
    }
  }
}

function assertInMemoryReferenceBoundary(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertInMemoryReferenceBoundary(item);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref" && typeof child === "string" && !child.startsWith("#")) {
      let protocol: string | undefined;
      try {
        protocol = new URL(child).protocol;
      } catch {
        // A URI without a scheme is relative to a schema file, which this API does not have.
      }
      if (protocol !== "http:" && protocol !== "https:") {
        throw new Error(`relative external $ref requires validateInstanceWithSchemaFile: ${child}`);
      }
    }
    assertInMemoryReferenceBoundary(child);
  }
}

function isContained(path: string, root: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function canonicalPath(path: string, label: string): Promise<string> {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) {
      throw new Error(`symlink is not allowed for ${label}: ${path}`);
    }
    return await realpath(path);
  } catch (error) {
    if (error instanceof SchemaValidationError) throw error;
    throw SchemaValidationError.compileFailed(label, error as Error);
  }
}

function isSchemaFile(path: string): boolean {
  const ext = extname(path).toLowerCase();
  return ext === ".json" || ext === ".yaml" || ext === ".yml";
}

async function collectSchemaFiles(root: string, output: string[]): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) {
      throw SchemaValidationError.compileFailed(
        path,
        new Error(`symlink in schema catalog: ${path}`),
      );
    }
    if (entry.isDirectory()) {
      await collectSchemaFiles(path, output);
    } else if (entry.isFile() && isSchemaFile(path)) {
      output.push(await realpath(path));
    }
  }
}

function collectRelativeRefs(value: unknown, output: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectRelativeRefs(item, output);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref" && typeof child === "string" && !child.startsWith("#")) {
      try {
        new URL(child);
      } catch {
        output.push(child);
      }
    }
    collectRelativeRefs(child, output);
  }
}

async function indexRelativeRefs(catalog: Catalog): Promise<void> {
  for (const entry of catalog.entries) {
    const refs: string[] = [];
    collectRelativeRefs(entry.schema, refs);
    const declaredId =
      typeof entry.schema !== "boolean" && typeof entry.schema.$id === "string"
        ? entry.schema.$id
        : pathToFileURL(entry.path).href;
    const declaredBase = new URL(declaredId, pathToFileURL(entry.path)).href;

    for (const ref of refs) {
      const physicalPaths = new Set<string>();
      for (const base of [
        entry.path,
        ...catalog.roots.map((root) => join(root, "__catalog_base__.schema.json")),
      ]) {
        const physicalUrl = new URL(ref, pathToFileURL(base));
        if (
          physicalUrl.protocol !== "file:" ||
          (physicalUrl.hostname && physicalUrl.hostname !== "localhost")
        ) {
          throw SchemaValidationError.compileFailed(
            entry.path,
            new Error(`relative schema reference does not resolve to a local file: ${ref}`),
          );
        }
        physicalUrl.hash = "";
        physicalUrl.search = "";
        physicalPaths.add(fileURLToPath(physicalUrl));
      }

      const containedPaths = [...physicalPaths].filter((path) =>
        catalog.roots.some((root) => isContained(path, root)),
      );
      if (containedPaths.length === 0) {
        throw SchemaValidationError.compileFailed(
          entry.path,
          new Error(`schema path not contained in catalog roots: ${[...physicalPaths].join(", ")}`),
        );
      }

      const exactTargets = [
        ...new Map(
          catalog.entries
            .filter((candidate) => containedPaths.includes(candidate.path))
            .map((candidate) => [candidate.path, candidate]),
        ).values(),
      ];
      if (exactTargets.length > 1) {
        throw SchemaValidationError.compileFailed(
          entry.path,
          new Error(
            `ambiguous relative schema reference ${ref}: ${exactTargets
              .map((candidate) => candidate.path)
              .join(", ")}`,
          ),
        );
      }
      let target = exactTargets[0];
      if (
        !target &&
        !stripFragment(ref)
          .replace(/[?#].*$/, "")
          .includes("/")
      ) {
        target = suffixMatches(catalog, new URL(ref, pathToFileURL(entry.path)));
      }
      if (!target) {
        throw SchemaValidationError.compileFailed(
          entry.path,
          new Error(`schema reference is not a catalog file: ${containedPaths.join(", ")}`),
        );
      }
      const canonical = await canonicalPath(target.path, ref);
      if (!catalog.roots.some((root) => isContained(canonical, root))) {
        throw SchemaValidationError.compileFailed(
          entry.path,
          new Error(`schema path not contained in catalog roots: ${canonical}`),
        );
      }

      const resolvedUrl = new URL(ref, declaredBase);
      if (
        resolvedUrl.protocol !== "file:" &&
        resolvedUrl.protocol !== "http:" &&
        resolvedUrl.protocol !== "https:"
      ) {
        throw SchemaValidationError.compileFailed(
          entry.path,
          new Error(`unsupported schema URI scheme: ${resolvedUrl.protocol.replace(":", "")}`),
        );
      }
      const resolvedUri = stripFragment(resolvedUrl.href);
      const previous = catalog.relativeRefs.get(resolvedUri);
      if (previous && previous.path !== target.path) {
        throw SchemaValidationError.compileFailed(
          entry.path,
          new Error(
            `conflicting relative schema reference ${resolvedUri}: ${previous.path}, ${target.path}`,
          ),
        );
      }
      catalog.relativeRefs.set(resolvedUri, target);
    }
  }
}

async function createCatalog(
  rootSchemaPath: string | undefined,
  options: FileSchemaOptions,
): Promise<Catalog> {
  const roots: string[] = [];
  if (rootSchemaPath) {
    const canonicalSchema = await canonicalPath(rootSchemaPath, rootSchemaPath);
    roots.push(await canonicalPath(dirname(canonicalSchema), dirname(canonicalSchema)));
  }
  for (const refDir of options.refDirs ?? []) {
    roots.push(await canonicalPath(refDir, refDir));
  }
  const uniqueRoots = [...new Set(roots)].sort();
  const files: string[] = [];
  for (const root of uniqueRoots) {
    await collectSchemaFiles(root, files);
  }

  const entries: CatalogEntry[] = [];
  const ids = new Map<string, CatalogEntry>();
  for (const path of [...new Set(files)].sort()) {
    const schema = parseDocument(await readFile(path), path);
    const entry = { path, schema };
    entries.push(entry);
    if (typeof schema !== "boolean" && typeof schema.$id === "string") {
      const id = stripFragment(schema.$id);
      const previous = ids.get(id);
      if (previous && previous.path !== path) {
        throw SchemaValidationError.compileFailed(
          path,
          new Error(`duplicate schema $id ${id} in catalog (also ${previous.path})`),
        );
      }
      ids.set(id, entry);
    }
  }

  const catalog: Catalog = {
    entries,
    ids,
    relativeRefs: new Map(),
    roots: uniqueRoots,
    resolution: options.resolution ?? "prefer-id",
  };
  await indexRelativeRefs(catalog);
  return catalog;
}

function suffixMatches(catalog: Catalog, uri: URL): CatalogEntry {
  const suffix = decodeURIComponent(uri.pathname).replace(/^\/+/, "");
  const fileName = basename(suffix);
  const matches = catalog.entries.filter(
    (entry) =>
      entry.path.replaceAll("\\", "/").endsWith(`/${suffix}`) || basename(entry.path) === fileName,
  );
  if (matches.length === 0) {
    throw new Error(`schema reference not found in offline catalog: ${uri.href}`);
  }
  if (matches.length > 1) {
    throw new Error(
      `ambiguous schema path suffix ${suffix}: ${matches.map((entry) => entry.path).join(", ")}`,
    );
  }
  return matches[0];
}

async function resolveCatalogReference(catalog: Catalog, uri: string): Promise<CatalogEntry> {
  const relativeTarget = catalog.relativeRefs.get(stripFragment(uri));
  if (relativeTarget) return relativeTarget;

  const parsed = new URL(uri);
  if (parsed.protocol === "file:") {
    if (parsed.hostname && parsed.hostname !== "localhost") {
      throw new Error(`unsupported non-local file host in schema URI: ${uri}`);
    }
    const canonical = await canonicalPath(fileURLToPath(parsed), uri);
    if (!catalog.roots.some((root) => isContained(canonical, root))) {
      throw new Error(`schema path not contained in catalog roots: ${canonical}`);
    }
    const entry = catalog.entries.find((candidate) => candidate.path === canonical);
    if (!entry) throw new Error(`schema reference is not a catalog file: ${canonical}`);
    return entry;
  }
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    if (catalog.resolution === "prefer-id") {
      const byId = catalog.ids.get(stripFragment(parsed.href));
      if (byId) return byId;
    }
    return suffixMatches(catalog, parsed);
  }
  throw new Error(`unsupported schema URI scheme: ${parsed.protocol.replace(":", "")}`);
}

async function createFileAjv(dialect: JsonSchemaDialect, catalog: Catalog): Promise<Ajv> {
  const AjvCtor =
    dialect === "draft-2020-12"
      ? Ajv2020
      : dialect === "draft-2019-09"
        ? Ajv2019
        : dialect === "draft-04"
          ? (AjvDraft04 as unknown as typeof Ajv)
          : Ajv;
  const ajv = new AjvCtor({
    strict: false,
    allErrors: true,
    verbose: true,
    addUsedSchema: false,
    schemaId: dialect === "draft-04" ? "id" : "$id",
    loadSchema: async (uri: string) =>
      (await resolveCatalogReference(catalog, uri)).schema as AnySchemaObject,
  });
  applyFulmenAjvFormats(ajv);
  await initializeAjvMetaSchemas(ajv, dialect);
  return ajv;
}

async function compileFileSchema(
  schema: SchemaInput,
  schemaPath: string | undefined,
  options: FileSchemaOptions,
): Promise<CompiledValidator> {
  const label = schemaPath ?? "<schema>";
  try {
    const parsed = Buffer.isBuffer(schema)
      ? parseDocument(schema, label)
      : typeof schema === "string"
        ? parseDocument(schema, label)
        : schema;
    if (!schemaPath) assertInMemoryReferenceBoundary(parsed);
    const catalog = await createCatalog(schemaPath, options);
    const root =
      typeof parsed === "boolean"
        ? parsed
        : {
            ...parsed,
            $id:
              typeof parsed.$id === "string"
                ? parsed.$id
                : pathToFileURL(
                    schemaPath
                      ? await realpath(schemaPath)
                      : join(catalog.roots[0] ?? "/", "__root.schema.json"),
                  ).href,
          };
    const ajv = await createFileAjv(detectDialect(root), catalog);
    return (
      typeof root === "boolean" ? ajv.compile(root) : await ajv.compileAsync(root)
    ) as CompiledValidator;
  } catch (error) {
    if (error instanceof SchemaValidationError) throw error;
    throw SchemaValidationError.compileFailed(label, error as Error);
  }
}

/** Validate an in-memory instance against a schema using an offline file catalog. */
export async function validateInstance(
  schema: SchemaInput,
  instance: unknown,
  options: FileSchemaOptions = {},
): Promise<SchemaValidationResult> {
  return validateData(instance, await compileFileSchema(schema, undefined, options));
}

/** Load a schema file and validate an in-memory instance. */
export async function validateInstanceWithSchemaFile(
  schemaPath: string,
  instance: unknown,
  options: FileSchemaOptions = {},
): Promise<SchemaValidationResult> {
  const canonical = await canonicalPath(schemaPath, schemaPath);
  const schema = parseDocument(await readFile(canonical), canonical);
  return validateData(instance, await compileFileSchema(schema, canonical, options));
}

/** Load schema and instance files (JSON or YAML) and validate the instance. */
export async function validateInstanceFile(
  schemaPath: string,
  instancePath: string,
  options: FileSchemaOptions = {},
): Promise<SchemaValidationResult> {
  return validateInstanceWithSchemaFile(
    schemaPath,
    parseInstance(await readFile(instancePath), instancePath),
    options,
  );
}

/** Load a schema file and validate JSON or YAML instance bytes. */
export async function validateInstanceBytes(
  schemaPath: string,
  bytes: Buffer | Uint8Array,
  options: FileSchemaOptions = {},
): Promise<SchemaValidationResult> {
  return validateInstanceWithSchemaFile(
    schemaPath,
    parseInstance(Buffer.from(bytes), "<instance>"),
    options,
  );
}
