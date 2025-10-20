/**
 * Foundry MIME Type Catalog - implements MIME type detection and lookup
 *
 * v0.1.1: Extension-based detection
 * v0.1.2: Magic number detection (deferred per foundry-mvp.md)
 */

import { loadMimeTypeCatalog } from './loader.js';
import type { MimeType, MimeTypeCatalog } from './types.js';

let catalogCache: MimeTypeCatalog | null = null;
const mimeStringIndex = new Map<string, MimeType>();
const extensionIndex = new Map<string, MimeType>();

function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T;
  }

  const cloned: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
    }
  }
  return cloned as T;
}

function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);

  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      const value = obj[key];
      if (value !== null && typeof value === 'object') {
        deepFreeze(value);
      }
    }
  }

  return obj;
}

async function ensureCatalogLoaded(): Promise<void> {
  if (catalogCache !== null) {
    return;
  }

  catalogCache = await loadMimeTypeCatalog();

  for (const mimeType of catalogCache.types) {
    // Index by MIME string (case-insensitive)
    mimeStringIndex.set(mimeType.mime.toLowerCase(), mimeType);

    // Index by extensions (case-insensitive, with and without leading dot)
    for (const ext of mimeType.extensions) {
      const normalized = ext.toLowerCase().replace(/^\./, '');
      extensionIndex.set(normalized, mimeType);
    }
  }
}

export async function getMimeType(mimeString: string): Promise<Readonly<MimeType> | null> {
  await ensureCatalogLoaded();
  const normalized = mimeString.toLowerCase();
  const mimeType = mimeStringIndex.get(normalized);
  return mimeType ? deepFreeze(deepClone(mimeType)) : null;
}

export async function getMimeTypeByExtension(
  extension: string,
): Promise<Readonly<MimeType> | null> {
  await ensureCatalogLoaded();
  const normalized = extension.toLowerCase().replace(/^\./, '');
  const mimeType = extensionIndex.get(normalized);
  return mimeType ? deepFreeze(deepClone(mimeType)) : null;
}

/**
 * Check if a MIME type is supported in the catalog
 *
 * Note: Must be async to ensure catalog is loaded on cold calls.
 * Without ensureCatalogLoaded(), mimeStringIndex would be empty
 * and return false even for valid types.
 */
export async function isSupportedMimeType(mime: string): Promise<boolean> {
  await ensureCatalogLoaded();
  return mimeStringIndex.has(mime.toLowerCase());
}

export async function detectMimeType(_input: Buffer): Promise<Readonly<MimeType> | null> {
  await ensureCatalogLoaded();

  // v0.1.1: Basic detection stub
  // Magic number detection will be implemented in v0.1.2 per foundry-mvp.md line 206
  // For now, return null (unknown type)
  return null;
}

export async function listMimeTypes(): Promise<ReadonlyArray<Readonly<MimeType>>> {
  await ensureCatalogLoaded();
  return Array.from(mimeStringIndex.values()).map((m) => deepFreeze(deepClone(m)));
}

export function clearMimeTypeCache(): void {
  catalogCache = null;
  mimeStringIndex.clear();
  extensionIndex.clear();
}
