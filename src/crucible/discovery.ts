import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToAssetId } from "./normalize.js";
import type { AssetCategory, AssetListOptions, AssetSummary } from "./types.js";

const CATEGORIES: readonly AssetCategory[] = ["docs", "schemas", "config", "templates"];

const CATEGORY_BASE_PATHS: Record<AssetCategory, string> = {
  docs: "docs/crucible-ts",
  schemas: "schemas/crucible-ts",
  config: "config/crucible-ts",
  templates: "templates/crucible-ts",
};

export function listCategories(): readonly AssetCategory[] {
  return CATEGORIES;
}

async function scanDirectory(
  baseDir: string,
  category: AssetCategory,
  prefix?: string,
): Promise<AssetSummary[]> {
  const results: AssetSummary[] = [];

  async function scan(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile()) {
          const relativePath = fullPath.slice(process.cwd().length + 1);
          const id = pathToAssetId(relativePath, category);

          if (prefix && !id.startsWith(prefix)) {
            continue;
          }

          const stats = await stat(fullPath);

          results.push({
            id,
            category,
            path: relativePath,
            size: stats.size,
            modified: stats.mtime,
          });
        }
      }
    } catch (_error) {
      return;
    }
  }

  await scan(baseDir);
  return results;
}

export async function listAssets(
  category: AssetCategory,
  options?: AssetListOptions,
): Promise<readonly AssetSummary[]> {
  const basePath = CATEGORY_BASE_PATHS[category];
  const fullPath = join(process.cwd(), basePath);

  const assets = await scanDirectory(fullPath, category, options?.prefix);

  assets.sort((a, b) => a.id.localeCompare(b.id));

  if (options?.limit !== undefined) {
    if (options.limit === 0) {
      return [];
    }
    if (options.limit > 0) {
      return assets.slice(0, options.limit);
    }
  }

  return assets;
}
