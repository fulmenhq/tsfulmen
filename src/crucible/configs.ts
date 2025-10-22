import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { listAssets } from './discovery.js';
import { AssetNotFoundError } from './errors.js';
import { assetIdToPath, extractConfigCategory, extractVersion } from './normalize.js';
import type { ConfigSummary } from './types.js';

export async function listConfigDefaults(category?: string): Promise<readonly ConfigSummary[]> {
  const assets = await listAssets('config');

  const summaries: ConfigSummary[] = assets.map((asset) => ({
    ...asset,
    configCategory: extractConfigCategory(asset.id),
    version: extractVersion(asset.id) ?? 'unknown',
  }));

  if (!category) {
    return summaries;
  }

  return summaries.filter((s) => s.configCategory === category);
}

export async function getConfigDefaults(category: string, version: string): Promise<unknown> {
  const assets = await listAssets('config');

  const normalizedRequestedVersion = version.startsWith('v') ? version.slice(1) : version;

  const matchingAsset = assets.find((asset) => {
    const assetCategory = extractConfigCategory(asset.id);
    const assetVersion = extractVersion(asset.id);

    if (assetCategory !== category) {
      return false;
    }

    if (!assetVersion) {
      return normalizedRequestedVersion === 'unknown';
    }

    const normalizedAssetVersion = assetVersion.startsWith('v')
      ? assetVersion.slice(1)
      : assetVersion;

    return normalizedAssetVersion === normalizedRequestedVersion;
  });

  if (!matchingAsset) {
    const availableIds = assets.map((a) => a.id);
    const messageVersion =
      normalizedRequestedVersion === 'unknown' ? 'unknown' : `v${normalizedRequestedVersion}`;
    throw new AssetNotFoundError(`${category}/${messageVersion}`, 'config', availableIds);
  }

  const path = assetIdToPath(matchingAsset.id, 'config');
  const fullPath = join(process.cwd(), path);

  try {
    const content = await readFile(fullPath, 'utf-8');
    return parseYaml(content);
  } catch (_error) {
    const availableIds = assets.map((a) => a.id);
    throw new AssetNotFoundError(matchingAsset.id, 'config', availableIds);
  }
}
