/**
 * MIME Type catalog tests
 */

import { describe, expect, it } from 'vitest';
import {
  clearMimeTypeCache,
  detectMimeType,
  getMimeType,
  getMimeTypeByExtension,
  isSupportedMimeType,
  listMimeTypes,
} from '../mime-types.js';

describe('MIME Type Catalog', () => {
  describe('getMimeType', () => {
    it('should return MIME type by string', async () => {
      const mimeType = await getMimeType('application/json');
      expect(mimeType).toBeDefined();
      expect(mimeType?.id).toBe('json');
      expect(mimeType?.mime).toBe('application/json');
      expect(mimeType?.name).toBe('JSON');
    });

    it('should be case-insensitive', async () => {
      const lower = await getMimeType('application/json');
      const upper = await getMimeType('APPLICATION/JSON');
      const mixed = await getMimeType('Application/Json');

      expect(lower).toEqual(upper);
      expect(lower).toEqual(mixed);
    });

    it('should return null for unknown MIME type', async () => {
      const mimeType = await getMimeType('application/unknown');
      expect(mimeType).toBeNull();
    });

    it('should return frozen immutable object', async () => {
      const mimeType = await getMimeType('application/json');
      expect(Object.isFrozen(mimeType)).toBe(true);
      expect(Object.isFrozen(mimeType?.extensions)).toBe(true);
    });

    it('should return defensive copy', async () => {
      const mimeType1 = await getMimeType('application/json');
      const mimeType2 = await getMimeType('application/json');
      expect(mimeType1).not.toBe(mimeType2);
      expect(mimeType1).toEqual(mimeType2);
    });
  });

  describe('getMimeTypeByExtension', () => {
    it('should return MIME type by extension', async () => {
      const mimeType = await getMimeTypeByExtension('json');
      expect(mimeType?.id).toBe('json');
      expect(mimeType?.mime).toBe('application/json');
    });

    it('should handle extension with leading dot', async () => {
      const withDot = await getMimeTypeByExtension('.json');
      const withoutDot = await getMimeTypeByExtension('json');
      expect(withDot).toEqual(withoutDot);
    });

    it('should be case-insensitive', async () => {
      const lower = await getMimeTypeByExtension('json');
      const upper = await getMimeTypeByExtension('JSON');
      const mixed = await getMimeTypeByExtension('Json');

      expect(lower).toEqual(upper);
      expect(lower).toEqual(mixed);
    });

    it('should handle multiple extensions for same type', async () => {
      const yaml1 = await getMimeTypeByExtension('yaml');
      const yaml2 = await getMimeTypeByExtension('yml');

      expect(yaml1?.id).toBe('yaml');
      expect(yaml2?.id).toBe('yaml');
      expect(yaml1).toEqual(yaml2);
    });

    it('should return null for unknown extension', async () => {
      const mimeType = await getMimeTypeByExtension('unknown');
      expect(mimeType).toBeNull();
    });
  });

  describe('isSupportedMimeType', () => {
    it('should return true for supported MIME types', async () => {
      expect(await isSupportedMimeType('application/json')).toBe(true);
      expect(await isSupportedMimeType('application/yaml')).toBe(true);
      expect(await isSupportedMimeType('text/csv')).toBe(true);
    });

    it('should return false for unsupported MIME types', async () => {
      expect(await isSupportedMimeType('application/unknown')).toBe(false);
      expect(await isSupportedMimeType('text/html')).toBe(false);
    });

    it('should be case-insensitive', async () => {
      expect(await isSupportedMimeType('APPLICATION/JSON')).toBe(true);
      expect(await isSupportedMimeType('Application/Json')).toBe(true);
    });

    it('should work on cold call before catalog loaded', async () => {
      clearMimeTypeCache();
      // First call should load catalog and return correct result
      const result = await isSupportedMimeType('application/json');
      expect(result).toBe(true);
    });
  });

  describe('detectMimeType', () => {
    it('should return null for v0.1.1 (magic number detection deferred)', async () => {
      const jsonBuffer = Buffer.from('{"key": "value"}');
      const result = await detectMimeType(jsonBuffer);
      expect(result).toBeNull();
    });

    it('should accept Buffer input', async () => {
      const buffer = Buffer.from('test content');
      const result = await detectMimeType(buffer);
      // v0.1.1: Always returns null (magic number detection in v0.1.2)
      expect(result).toBeNull();
    });
  });

  describe('listMimeTypes', () => {
    it('should return all MIME types', async () => {
      const mimeTypes = await listMimeTypes();
      expect(mimeTypes.length).toBeGreaterThan(5);
      expect(mimeTypes.every((m) => m.id && m.mime && m.name)).toBe(true);
    });

    it('should return frozen immutable array', async () => {
      const mimeTypes = await listMimeTypes();
      expect(mimeTypes.every((m) => Object.isFrozen(m))).toBe(true);
      expect(mimeTypes.every((m) => Object.isFrozen(m.extensions))).toBe(true);
    });

    it('should include common types', async () => {
      const mimeTypes = await listMimeTypes();
      const ids = mimeTypes.map((m) => m.id);

      expect(ids).toContain('json');
      expect(ids).toContain('yaml');
      expect(ids).toContain('csv');
      expect(ids).toContain('xml');
    });
  });

  describe('clearMimeTypeCache', () => {
    it('should clear cache and reload', async () => {
      const mimeType1 = await getMimeType('application/json');
      clearMimeTypeCache();
      const mimeType2 = await getMimeType('application/json');

      expect(mimeType1).toEqual(mimeType2);
      expect(mimeType1).not.toBe(mimeType2);
    });
  });

  describe('Common MIME Types', () => {
    it('should have JSON type', async () => {
      const json = await getMimeType('application/json');
      expect(json?.id).toBe('json');
      expect(json?.extensions).toContain('json');
    });

    it('should have YAML type', async () => {
      const yaml = await getMimeType('application/yaml');
      expect(yaml?.id).toBe('yaml');
      expect(yaml?.extensions).toContain('yaml');
      expect(yaml?.extensions).toContain('yml');
    });

    it('should have CSV type', async () => {
      const csv = await getMimeType('text/csv');
      expect(csv?.id).toBe('csv');
      expect(csv?.extensions).toContain('csv');
    });

    it('should have XML type', async () => {
      const xml = await getMimeType('application/xml');
      expect(xml?.id).toBe('xml');
      expect(xml?.extensions).toContain('xml');
    });

    it('should have plain text type', async () => {
      const text = await getMimeType('text/plain');
      expect(text?.id).toBe('plain-text');
      expect(text?.extensions).toContain('txt');
    });
  });

  describe('Extension Mapping', () => {
    it('should map .json to application/json', async () => {
      const mimeType = await getMimeTypeByExtension('.json');
      expect(mimeType?.mime).toBe('application/json');
    });

    it('should map .yaml and .yml to application/yaml', async () => {
      const yaml = await getMimeTypeByExtension('yaml');
      const yml = await getMimeTypeByExtension('yml');

      expect(yaml?.mime).toBe('application/yaml');
      expect(yml?.mime).toBe('application/yaml');
    });

    it('should map .csv to text/csv', async () => {
      const mimeType = await getMimeTypeByExtension('csv');
      expect(mimeType?.mime).toBe('text/csv');
    });

    it('should map .txt to text/plain', async () => {
      const mimeType = await getMimeTypeByExtension('txt');
      expect(mimeType?.mime).toBe('text/plain');
    });
  });
});
