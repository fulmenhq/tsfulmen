/**
 * Foundry HTTP Status Catalog - implements HTTP status code access and helpers
 */

import { loadHttpStatusCatalog } from './loader.js';
import type { HttpStatusCatalog, HttpStatusCode, HttpStatusGroupId } from './types.js';

let catalogCache: HttpStatusCatalog | null = null;
const statusCodeIndex = new Map<number, HttpStatusCode>();

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

  catalogCache = await loadHttpStatusCatalog();

  for (const group of catalogCache.groups) {
    const groupId = group.id as HttpStatusGroupId;
    for (const code of group.codes) {
      statusCodeIndex.set(code.value, {
        value: code.value,
        reason: code.reason,
        group: groupId,
      });
    }
  }
}

export async function getHttpStatus(code: number): Promise<Readonly<HttpStatusCode> | null> {
  await ensureCatalogLoaded();
  const status = statusCodeIndex.get(code);
  return status ? deepFreeze(deepClone(status)) : null;
}

export function isInformational(code: number): boolean {
  return code >= 100 && code < 200;
}

export function isSuccess(code: number): boolean {
  return code >= 200 && code < 300;
}

export function isRedirection(code: number): boolean {
  return code >= 300 && code < 400;
}

export function isClientError(code: number): boolean {
  return code >= 400 && code < 500;
}

export function isServerError(code: number): boolean {
  return code >= 500 && code < 600;
}

export async function listHttpStatuses(): Promise<ReadonlyArray<Readonly<HttpStatusCode>>> {
  await ensureCatalogLoaded();
  return Array.from(statusCodeIndex.values()).map((s) => deepFreeze(deepClone(s)));
}

export async function getStatusReason(code: number): Promise<string | null> {
  const status = await getHttpStatus(code);
  return status?.reason ?? null;
}

export function clearHttpStatusCache(): void {
  catalogCache = null;
  statusCodeIndex.clear();
}
