/**
 * Foundry MIME Type Catalog - implements MIME type detection and lookup
 *
 * v0.1.1: Extension-based detection
 * v0.1.2: Magic number detection with streaming support
 */

import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createDetector, type DetectionOptions } from './detector.js';
import { loadMimeTypeCatalog } from './loader.js';
import type { MimeType, MimeTypeCatalog } from './types.js';

let catalogCache: MimeTypeCatalog | null = null;
const mimeStringIndex = new Map<string, MimeType>();
const extensionIndex = new Map<string, MimeType>();
let detectorInstance: ReturnType<typeof createDetector> | null = null;

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

  // Initialize detector
  detectorInstance = createDetector(mimeStringIndex);
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

/**
 * Detect MIME type from content using magic number analysis.
 *
 * Supports multiple input types:
 * - Buffer: Direct content analysis
 * - string (file path): Read and analyze file
 * - ReadableStream: Stream first N bytes for analysis
 * - Readable: Node.js stream first N bytes for analysis
 *
 * @param input - Content to analyze
 * @param options - Detection options
 * @returns Detected MIME type or null if unknown
 */
export async function detectMimeType(
  input: Buffer | ReadableStream | Readable | string,
  options?: DetectionOptions,
): Promise<Readonly<MimeType> | null> {
  await ensureCatalogLoaded();

  if (!detectorInstance) {
    throw new Error('Detector not initialized');
  }

  // Handle different input types
  if (typeof input === 'string') {
    return detectMimeTypeFromFile(input, options);
  }

  if (Buffer.isBuffer(input)) {
    return detectMimeTypeFromBuffer(input, options);
  }

  return detectMimeTypeFromStream(input, options);
}

/**
 * Detect MIME type from file path
 */
export async function detectMimeTypeFromFile(
  filePath: string,
  options: DetectionOptions = {},
): Promise<Readonly<MimeType> | null> {
  await ensureCatalogLoaded();

  if (!detectorInstance) {
    throw new Error('Detector not initialized');
  }

  const bytesToRead = options.bytesToRead || 512;

  // Use Bun.file() when available for better performance
  if (typeof Bun !== 'undefined') {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return null;
    }
    const slice = file.slice(0, bytesToRead);
    const arrayBuffer = await slice.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return detectMimeTypeFromBuffer(buffer, options);
  }

  // Node.js fallback
  try {
    const buffer = await readFile(filePath, { encoding: null });
    const sample = buffer.subarray(0, Math.min(buffer.length, bytesToRead));
    return detectMimeTypeFromBuffer(sample, options);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Detect MIME type from Buffer
 */
export function detectMimeTypeFromBuffer(
  buffer: Buffer,
  options: DetectionOptions = {},
): Readonly<MimeType> | null {
  if (!detectorInstance) {
    throw new Error('Detector not initialized');
  }

  const result = detectorInstance.detect(buffer, options);
  return result ? deepFreeze(deepClone(result)) : null;
}

/**
 * Detect MIME type from stream (ReadableStream or Node.js Readable)
 */
export async function detectMimeTypeFromStream(
  stream: ReadableStream | Readable,
  options: DetectionOptions = {},
): Promise<Readonly<MimeType> | null> {
  await ensureCatalogLoaded();

  const bytesToRead = options.bytesToRead || 512;
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  // Convert Node.js Readable to Web ReadableStream if needed
  const webStream: ReadableStream =
    typeof (stream as ReadableStream).getReader === 'function'
      ? (stream as ReadableStream)
      : Readable.toWeb(stream as Readable);

  const reader = webStream.getReader();

  try {
    while (totalBytes < bytesToRead) {
      const { value, done } = await reader.read();
      if (done) break;

      chunks.push(value);
      totalBytes += value.length;
    }

    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const sample = buffer.subarray(0, Math.min(buffer.length, bytesToRead));

    return detectMimeTypeFromBuffer(sample, options);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Check if buffer matches a known magic number pattern
 */
export function matchMagicNumber(buffer: Buffer, mimeType: string): boolean {
  if (!detectorInstance) {
    throw new Error('Detector not initialized');
  }

  const result = detectorInstance.detect(buffer);
  return result?.mime === mimeType;
}

export async function listMimeTypes(): Promise<ReadonlyArray<Readonly<MimeType>>> {
  await ensureCatalogLoaded();
  return Array.from(mimeStringIndex.values()).map((m) => deepFreeze(deepClone(m)));
}

export function clearMimeTypeCache(): void {
  catalogCache = null;
  mimeStringIndex.clear();
  extensionIndex.clear();
  detectorInstance = null;
}
