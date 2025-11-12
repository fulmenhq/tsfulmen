import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { metrics } from "../telemetry/index.js";
import { listAssets } from "./discovery.js";
import { AssetNotFoundError } from "./errors.js";
import { assetIdToPath, extractSchemaKind, extractVersion } from "./normalize.js";
import type { SchemaKind, SchemaSummary } from "./types.js";

export async function listSchemas(kind?: SchemaKind): Promise<readonly SchemaSummary[]> {
  const assets = await listAssets("schemas");

  const summaries: SchemaSummary[] = assets.map((asset) => ({
    ...asset,
    kind: extractSchemaKind(asset.id),
    version: extractVersion(asset.id) ?? "unknown",
  }));

  if (!kind) {
    return summaries;
  }

  return summaries.filter((s) => s.kind === kind);
}

export async function loadSchemaById(id: string): Promise<unknown> {
  const path = assetIdToPath(id, "schemas");
  const fullPath = join(process.cwd(), path);

  try {
    const content = await readFile(fullPath, "utf-8");

    if (fullPath.endsWith(".json")) {
      metrics.counter("foundry_lookup_count").inc();
      return JSON.parse(content);
    }

    if (fullPath.endsWith(".yaml") || fullPath.endsWith(".yml")) {
      metrics.counter("foundry_lookup_count").inc();
      return parseYaml(content);
    }

    metrics.counter("foundry_lookup_count").inc();
    return JSON.parse(content);
  } catch (_error) {
    const allAssets = await listAssets("schemas");
    const availableIds = allAssets.map((a) => a.id);
    throw new AssetNotFoundError(id, "schemas", availableIds);
  }
}
