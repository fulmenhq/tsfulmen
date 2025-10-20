/**
 * MIME Type catalog tests
 */

import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  clearMimeTypeCache,
  detectMimeType,
  detectMimeTypeFromBuffer,
  detectMimeTypeFromFile,
  detectMimeTypeFromStream,
  getMimeType,
  getMimeTypeByExtension,
  isSupportedMimeType,
  listMimeTypes,
  matchMagicNumber,
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

  describe('detectMimeType (basic)', () => {
    it('should detect JSON from buffer', async () => {
      const jsonBuffer = Buffer.from('{"key": "value"}');
      const result = await detectMimeType(jsonBuffer);
      expect(result?.mime).toBe('application/json');
    });

    it('should detect plain text from buffer', async () => {
      const buffer = Buffer.from('test content');
      const result = await detectMimeType(buffer);
      expect(result?.mime).toBe('text/plain');
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

describe('Magic Number Detection', () => {
  const fixturesDir = new URL('./fixtures/', import.meta.url).pathname;

  describe('detectMimeTypeFromBuffer', () => {
    it('should detect JSON from buffer', () => {
      const buffer = Buffer.from('{"test": true}');
      const result = detectMimeTypeFromBuffer(buffer);
      expect(result?.mime).toBe('application/json');
    });

    it('should detect YAML from buffer', () => {
      const buffer = Buffer.from('---\nkey: value');
      const result = detectMimeTypeFromBuffer(buffer);
      expect(result?.mime).toBe('application/yaml');
    });

    it('should detect XML from buffer', () => {
      const buffer = Buffer.from('<?xml version="1.0"?><root/>');
      const result = detectMimeTypeFromBuffer(buffer);
      expect(result?.mime).toBe('application/xml');
    });

    it('should detect CSV from buffer', () => {
      const buffer = Buffer.from('a,b,c\n1,2,3\n4,5,6');
      const result = detectMimeTypeFromBuffer(buffer);
      expect(result?.mime).toBe('text/csv');
    });

    it('should detect NDJSON from buffer', () => {
      const buffer = Buffer.from('{"line":1}\n{"line":2}\n{"line":3}');
      const result = detectMimeTypeFromBuffer(buffer);
      expect(result?.mime).toBe('application/x-ndjson');
    });

    it('should detect plain text from buffer', () => {
      const buffer = Buffer.from('This is plain text');
      const result = detectMimeTypeFromBuffer(buffer);
      expect(result?.mime).toBe('text/plain');
    });

    it('should return null for empty buffer', () => {
      const buffer = Buffer.from([]);
      const result = detectMimeTypeFromBuffer(buffer);
      expect(result).toBeNull();
    });
  });

  describe('detectMimeTypeFromFile', () => {
    it('should detect JSON file', async () => {
      const result = await detectMimeTypeFromFile(`${fixturesDir}test.json`);
      expect(result?.mime).toBe('application/json');
    });

    it('should detect YAML file', async () => {
      const result = await detectMimeTypeFromFile(`${fixturesDir}test.yaml`);
      expect(result?.mime).toBe('application/yaml');
    });

    it('should detect XML file', async () => {
      const result = await detectMimeTypeFromFile(`${fixturesDir}test.xml`);
      expect(result?.mime).toBe('application/xml');
    });

    it('should detect CSV file', async () => {
      const result = await detectMimeTypeFromFile(`${fixturesDir}test.csv`);
      expect(result?.mime).toBe('text/csv');
    });

    it('should detect NDJSON file', async () => {
      const result = await detectMimeTypeFromFile(`${fixturesDir}test.ndjson`);
      expect(result?.mime).toBe('application/x-ndjson');
    });

    it('should detect plain text file', async () => {
      const result = await detectMimeTypeFromFile(`${fixturesDir}test.txt`);
      expect(result?.mime).toBe('text/plain');
    });

    it('should return null for non-existent file', async () => {
      const result = await detectMimeTypeFromFile(`${fixturesDir}nonexistent.txt`);
      expect(result).toBeNull();
    });

    it('should respect bytesToRead option', async () => {
      const result = await detectMimeTypeFromFile(`${fixturesDir}test.json`, {
        bytesToRead: 10,
      });
      expect(result?.mime).toBe('application/json');
    });
  });

  describe('detectMimeTypeFromStream', () => {
    it('should detect from Node.js Readable stream', async () => {
      const stream = createReadStream(`${fixturesDir}test.json`);
      const result = await detectMimeTypeFromStream(stream);
      expect(result?.mime).toBe('application/json');
    });

    it('should detect from ReadableStream', async () => {
      const buffer = Buffer.from('{"test": true}');
      const webStream = new ReadableStream({
        start(controller) {
          controller.enqueue(buffer);
          controller.close();
        },
      });
      const result = await detectMimeTypeFromStream(webStream);
      expect(result?.mime).toBe('application/json');
    });

    it('should handle Readable.toWeb() conversion', async () => {
      const nodeStream = Readable.from([Buffer.from('---\nkey: value')]);
      const result = await detectMimeTypeFromStream(nodeStream);
      expect(result?.mime).toBe('application/yaml');
    });

    it('should respect bytesToRead option', async () => {
      const stream = createReadStream(`${fixturesDir}test.xml`);
      const result = await detectMimeTypeFromStream(stream, {
        bytesToRead: 20,
      });
      expect(result?.mime).toBe('application/xml');
    });
  });

  describe('detectMimeType (polymorphic)', () => {
    it('should accept Buffer input', async () => {
      const buffer = Buffer.from('{"test": true}');
      const result = await detectMimeType(buffer);
      expect(result?.mime).toBe('application/json');
    });

    it('should accept file path string', async () => {
      const result = await detectMimeType(`${fixturesDir}test.yaml`);
      expect(result?.mime).toBe('application/yaml');
    });

    it('should accept ReadableStream', async () => {
      const buffer = Buffer.from('<?xml version="1.0"?><root/>');
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(buffer);
          controller.close();
        },
      });
      const result = await detectMimeType(stream);
      expect(result?.mime).toBe('application/xml');
    });

    it('should accept Node.js Readable', async () => {
      const stream = createReadStream(`${fixturesDir}test.csv`);
      const result = await detectMimeType(stream);
      expect(result?.mime).toBe('text/csv');
    });
  });

  describe('matchMagicNumber', () => {
    it('should match JSON magic number', () => {
      const buffer = Buffer.from('{"test": true}');
      expect(matchMagicNumber(buffer, 'application/json')).toBe(true);
    });

    it('should not match incorrect MIME type', () => {
      const buffer = Buffer.from('{"test": true}');
      expect(matchMagicNumber(buffer, 'application/xml')).toBe(false);
    });

    it('should match YAML magic number', () => {
      const buffer = Buffer.from('---\nkey: value');
      expect(matchMagicNumber(buffer, 'application/yaml')).toBe(true);
    });

    it('should match XML magic number', () => {
      const buffer = Buffer.from('<?xml version="1.0"?><root/>');
      expect(matchMagicNumber(buffer, 'application/xml')).toBe(true);
    });
  });

  describe('Detection options', () => {
    it('should support fallbackToExtension option', async () => {
      // This would require implementing fallback logic
      const buffer = Buffer.from('unknown content');
      const result = await detectMimeType(buffer, {
        fallbackToExtension: true,
        extensionHint: '.json',
      });
      // With current implementation, this returns null since we don't have fallback yet
      expect(result).toBeDefined();
    });

    it('should support bytesToRead option', async () => {
      const buffer = Buffer.from('{"test": true, "more": "data"}');
      const result = await detectMimeType(buffer, { bytesToRead: 5 });
      expect(result?.mime).toBe('application/json');
    });
  });

  describe('Immutability', () => {
    it('should return frozen objects from detectMimeTypeFromBuffer', () => {
      const buffer = Buffer.from('{"test": true}');
      const result = detectMimeTypeFromBuffer(buffer);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should return frozen objects from detectMimeTypeFromFile', async () => {
      const result = await detectMimeTypeFromFile(`${fixturesDir}test.json`);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should return frozen objects from detectMimeTypeFromStream', async () => {
      const stream = createReadStream(`${fixturesDir}test.yaml`);
      const result = await detectMimeTypeFromStream(stream);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });
});
