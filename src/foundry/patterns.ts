/**
 * Foundry Pattern Catalog - implements pattern access and matching
 */

import picomatch from 'picomatch';
import { FoundryCatalogError } from './errors.js';
import { loadPatternCatalog } from './loader.js';
import type { Pattern, PatternCatalog } from './types.js';

let catalogCache: PatternCatalog | null = null;
const patternIndex = new Map<string, Pattern>();
const compiledRegexCache = new Map<string, RegExp>();
const compiledGlobCache = new Map<string, ReturnType<typeof picomatch>>();

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

  catalogCache = await loadPatternCatalog();

  for (const pattern of catalogCache.patterns) {
    patternIndex.set(pattern.id, pattern);
  }
}

export async function getPattern(id: string): Promise<Readonly<Pattern> | null> {
  await ensureCatalogLoaded();
  const pattern = patternIndex.get(id);
  return pattern ? deepFreeze(deepClone(pattern)) : null;
}

export async function getPatternRegex(id: string): Promise<RegExp | null> {
  await ensureCatalogLoaded();
  const pattern = patternIndex.get(id);

  if (!pattern) {
    return null;
  }

  if (pattern.kind !== 'regex') {
    throw FoundryCatalogError.invalidSchema(
      'patterns',
      `Pattern '${id}' is not a regex pattern (kind: ${pattern.kind})`,
    );
  }

  if (compiledRegexCache.has(id)) {
    return compiledRegexCache.get(id)!;
  }

  let flags = '';
  if (pattern.flags?.typescript?.ignoreCase) {
    flags += 'i';
  }

  const hasUnicodePropertyEscapes = /\\p\{/.test(pattern.pattern);
  if (pattern.flags?.typescript?.unicode || hasUnicodePropertyEscapes) {
    flags += 'u';
  }

  const regex = new RegExp(pattern.pattern, flags);
  compiledRegexCache.set(id, regex);
  return regex;
}

function getCompiledGlob(id: string, pattern: string): ReturnType<typeof picomatch> {
  if (compiledGlobCache.has(id)) {
    return compiledGlobCache.get(id)!;
  }

  const matcher = picomatch(pattern);
  compiledGlobCache.set(id, matcher);
  return matcher;
}

export async function matchPattern(id: string, value: string): Promise<boolean> {
  await ensureCatalogLoaded();
  const pattern = patternIndex.get(id);

  if (!pattern) {
    throw FoundryCatalogError.missingCatalog(`Pattern '${id}' not found`);
  }

  if (pattern.kind === 'regex') {
    const regex = await getPatternRegex(id);
    return regex ? regex.test(value) : false;
  }

  if (pattern.kind === 'glob') {
    const matcher = getCompiledGlob(id, pattern.pattern);
    return matcher(value);
  }

  if (pattern.kind === 'literal') {
    return pattern.pattern === value;
  }

  throw FoundryCatalogError.invalidSchema('patterns', `Unknown pattern kind: ${pattern.kind}`);
}

export async function listPatterns(): Promise<ReadonlyArray<Readonly<Pattern>>> {
  await ensureCatalogLoaded();
  return Array.from(patternIndex.values()).map((p) => deepFreeze(deepClone(p)));
}

export async function describePattern(id: string): Promise<string | null> {
  const pattern = await getPattern(id);
  return pattern?.description ?? null;
}

export function clearPatternCache(): void {
  catalogCache = null;
  patternIndex.clear();
  compiledRegexCache.clear();
  compiledGlobCache.clear();
}
