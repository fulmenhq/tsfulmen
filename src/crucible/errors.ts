import { suggest } from '../foundry/similarity/index.js';
import type { AssetCategory } from './types.js';

export class AssetNotFoundError extends Error {
  public readonly assetId: string;
  public readonly category: AssetCategory;
  public readonly suggestions: readonly string[];

  constructor(id: string, category: AssetCategory, availableIds: string[]) {
    const suggestions = suggest(id, availableIds, {
      maxSuggestions: 3,
      minScore: 0.6,
      normalize: true,
    });

    const suggestionText =
      suggestions.length > 0
        ? `\n\nDid you mean:\n${suggestions.map((s) => `  - ${s.value} (${(s.score * 100).toFixed(0)}% match)`).join('\n')}`
        : '';

    super(`Asset not found: ${category}/${id}${suggestionText}`);
    this.name = 'AssetNotFoundError';
    this.assetId = id;
    this.category = category;
    this.suggestions = suggestions.map((s) => s.value);
  }
}

export class InvalidAssetIdError extends Error {
  public readonly assetId: string;
  public readonly category: AssetCategory;

  constructor(id: string, category: AssetCategory, reason: string) {
    super(`Invalid asset ID for category '${category}': ${id}\nReason: ${reason}`);
    this.name = 'InvalidAssetIdError';
    this.assetId = id;
    this.category = category;
  }
}
