import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFrontmatter } from '../docscribe/index.js';
import { metrics } from '../telemetry/index.js';
import { listAssets } from './discovery.js';
import { AssetNotFoundError } from './errors.js';
import { assetIdToPath } from './normalize.js';
import type { DocumentationFilter, DocumentationMetadata, DocumentationSummary } from './types.js';

export async function listDocumentation(
  filters?: DocumentationFilter,
): Promise<readonly DocumentationSummary[]> {
  const assets = await listAssets('docs', {
    prefix: filters?.prefix,
    limit: filters?.limit,
  });

  if (!filters?.status && !filters?.tags) {
    return assets;
  }

  const summariesWithMetadata = await Promise.all(
    assets.map(async (asset) => {
      const metadata = await getDocumentationMetadata(asset.id);
      return { ...asset, metadata: metadata ?? undefined };
    }),
  );

  let filtered = summariesWithMetadata;

  if (filters.status) {
    filtered = filtered.filter((s) => s.metadata?.status === filters.status);
  }

  const filterTags = filters.tags;
  if (filterTags && filterTags.length > 0) {
    filtered = filtered.filter((s) => {
      if (!s.metadata?.tags) return false;
      return filterTags.some((tag) => s.metadata?.tags?.includes(tag) ?? false);
    });
  }

  return filtered;
}

export async function getDocumentation(id: string): Promise<string> {
  const path = assetIdToPath(id, 'docs');
  const fullPath = join(process.cwd(), path);

  try {
    const content = await readFile(fullPath, 'utf-8');
    metrics.counter('foundry_lookup_count').inc();
    return content;
  } catch (_error) {
    const allAssets = await listAssets('docs');
    const availableIds = allAssets.map((a) => a.id);
    throw new AssetNotFoundError(id, 'docs', availableIds);
  }
}

export async function getDocumentationWithMetadata(id: string): Promise<{
  content: string;
  metadata: DocumentationMetadata | null;
}> {
  const fullContent = await getDocumentation(id);

  const result = parseFrontmatter(fullContent);

  if (!result.metadata) {
    return { content: fullContent, metadata: null };
  }

  const metadata: DocumentationMetadata = {
    title: result.metadata.title,
    status: result.metadata.status,
    tags: result.metadata.tags,
    author: result.metadata.author,
    date: result.metadata.date,
    lastUpdated: result.metadata.lastUpdated,
    description: result.metadata.description,
  };

  return { content: result.body, metadata };
}

export async function getDocumentationMetadata(id: string): Promise<DocumentationMetadata | null> {
  try {
    const { metadata } = await getDocumentationWithMetadata(id);
    return metadata;
  } catch (_error) {
    return null;
  }
}
