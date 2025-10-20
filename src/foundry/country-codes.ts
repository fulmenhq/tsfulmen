/**
 * Foundry Country Code Catalog - implements ISO 3166 country code lookups
 *
 * Provides case-insensitive alpha-2/alpha-3 lookups and normalized numeric lookups
 * with proper padding (76 → "076", "76" → "076", "076" → "076")
 */

import { loadCountryCodeCatalog } from './loader.js';
import type { Country, CountryCatalog } from './types.js';

let catalogCache: CountryCatalog | null = null;
const alpha2Index = new Map<string, Country>();
const alpha3Index = new Map<string, Country>();
const numericIndex = new Map<string, Country>();

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

function normalizeNumeric(code: string | number): string {
  const str = typeof code === 'number' ? code.toString() : code;
  return str.padStart(3, '0');
}

async function ensureCatalogLoaded(): Promise<void> {
  if (catalogCache !== null) {
    return;
  }

  catalogCache = await loadCountryCodeCatalog();

  for (const country of catalogCache.countries) {
    // Alpha-2 index (case-insensitive, uppercase keys)
    alpha2Index.set(country.alpha2.toUpperCase(), country);

    // Alpha-3 index (case-insensitive, uppercase keys)
    alpha3Index.set(country.alpha3.toUpperCase(), country);

    // Numeric index (normalized to 3 digits with leading zeros)
    const normalized = normalizeNumeric(country.numeric);
    numericIndex.set(normalized, country);
  }
}

export async function getCountryByAlpha2(code: string): Promise<Readonly<Country> | null> {
  await ensureCatalogLoaded();
  const normalized = code.toUpperCase();
  const country = alpha2Index.get(normalized);
  return country ? deepFreeze(deepClone(country)) : null;
}

export async function getCountryByAlpha3(code: string): Promise<Readonly<Country> | null> {
  await ensureCatalogLoaded();
  const normalized = code.toUpperCase();
  const country = alpha3Index.get(normalized);
  return country ? deepFreeze(deepClone(country)) : null;
}

export async function getCountryByNumeric(
  code: string | number,
): Promise<Readonly<Country> | null> {
  await ensureCatalogLoaded();
  const normalized = normalizeNumeric(code);
  const country = numericIndex.get(normalized);
  return country ? deepFreeze(deepClone(country)) : null;
}

export async function listCountries(): Promise<ReadonlyArray<Readonly<Country>>> {
  await ensureCatalogLoaded();
  return Array.from(alpha2Index.values()).map((c) => deepFreeze(deepClone(c)));
}

export function clearCountryCodeCache(): void {
  catalogCache = null;
  alpha2Index.clear();
  alpha3Index.clear();
  numericIndex.clear();
}
