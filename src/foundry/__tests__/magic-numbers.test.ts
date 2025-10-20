/**
 * Magic number database tests
 */

import { describe, expect, it } from 'vitest';
import {
  getBOMOffset,
  hasBOM,
  MAGIC_NUMBER_DATABASE,
  type MagicNumberSignature,
  UTF8_BOM,
} from '../magic-numbers.js';

describe('Magic Number Database', () => {
  describe('Database structure', () => {
    it('should contain all 7 MIME types', () => {
      expect(MAGIC_NUMBER_DATABASE).toHaveLength(7);
    });

    it('should be ordered by priority (highest first)', () => {
      const priorities = MAGIC_NUMBER_DATABASE.map((sig) => sig.priority);
      const sorted = [...priorities].sort((a, b) => b - a);
      expect(priorities).toEqual(sorted);
    });

    it('should have unique priorities', () => {
      const priorities = MAGIC_NUMBER_DATABASE.map((sig) => sig.priority);
      const unique = new Set(priorities);
      expect(unique.size).toBe(priorities.length);
    });

    it('should have valid MIME types', () => {
      const mimeTypes = MAGIC_NUMBER_DATABASE.map((sig) => sig.mimeType);
      expect(mimeTypes).toContain('application/xml');
      expect(mimeTypes).toContain('application/json');
      expect(mimeTypes).toContain('application/yaml');
      expect(mimeTypes).toContain('application/x-ndjson');
      expect(mimeTypes).toContain('text/csv');
      expect(mimeTypes).toContain('application/x-protobuf');
      expect(mimeTypes).toContain('text/plain');
    });

    it('should have valid match strategies', () => {
      for (const sig of MAGIC_NUMBER_DATABASE) {
        expect(['exact', 'heuristic']).toContain(sig.matchStrategy);
      }
    });
  });

  describe('Pattern definitions', () => {
    function getSignature(mimeType: string): MagicNumberSignature {
      const sig = MAGIC_NUMBER_DATABASE.find((s) => s.mimeType === mimeType);
      if (!sig) throw new Error(`No signature for ${mimeType}`);
      return sig;
    }

    it('should have XML patterns with <?xml signature', () => {
      const xml = getSignature('application/xml');
      expect(xml.patterns.length).toBeGreaterThan(0);
      expect(xml.matchStrategy).toBe('exact');

      const xmlDeclPattern = xml.patterns.find((p) => p.description.includes('<?xml'));
      expect(xmlDeclPattern).toBeDefined();
      expect(xmlDeclPattern?.bytes).toEqual([0x3c, 0x3f, 0x78, 0x6d, 0x6c]); // <?xml
    });

    it('should have JSON patterns for objects and arrays', () => {
      const json = getSignature('application/json');
      expect(json.patterns.length).toBeGreaterThan(0);
      expect(json.matchStrategy).toBe('exact');

      const objectPattern = json.patterns.find((p) => p.description.includes('object start'));
      const arrayPattern = json.patterns.find((p) => p.description.includes('array start'));

      expect(objectPattern?.bytes).toEqual([0x7b]); // {
      expect(arrayPattern?.bytes).toEqual([0x5b]); // [
    });

    it('should have YAML patterns for --- and %YAML', () => {
      const yaml = getSignature('application/yaml');
      expect(yaml.patterns.length).toBeGreaterThan(0);
      expect(yaml.matchStrategy).toBe('exact');

      const dashPattern = yaml.patterns.find((p) => p.description.includes('---'));
      const directivePattern = yaml.patterns.find((p) => p.description.includes('%YAML'));

      expect(dashPattern?.bytes).toEqual([0x2d, 0x2d, 0x2d]); // ---
      expect(directivePattern?.bytes).toEqual([0x25, 0x59, 0x41, 0x4d, 0x4c]); // %YAML
    });

    it('should mark NDJSON as heuristic only', () => {
      const ndjson = getSignature('application/x-ndjson');
      expect(ndjson.matchStrategy).toBe('heuristic');
      expect(ndjson.patterns).toHaveLength(0);
    });

    it('should mark CSV as heuristic only', () => {
      const csv = getSignature('text/csv');
      expect(csv.matchStrategy).toBe('heuristic');
      expect(csv.patterns).toHaveLength(0);
    });

    it('should mark protobuf as heuristic only', () => {
      const protobuf = getSignature('application/x-protobuf');
      expect(protobuf.matchStrategy).toBe('heuristic');
      expect(protobuf.patterns).toHaveLength(0);
    });

    it('should mark plain text as heuristic only', () => {
      const text = getSignature('text/plain');
      expect(text.matchStrategy).toBe('heuristic');
      expect(text.patterns).toHaveLength(0);
    });
  });

  describe('BOM patterns', () => {
    it('should include BOM variants for JSON', () => {
      const json = MAGIC_NUMBER_DATABASE.find((s) => s.mimeType === 'application/json');
      const bomPatterns = json?.patterns.filter((p) => p.description.includes('BOM'));
      expect(bomPatterns).toBeDefined();
      expect(bomPatterns?.length).toBeGreaterThan(0);

      const bomObjectPattern = bomPatterns?.find((p) => p.description.includes('{'));
      expect(bomObjectPattern?.bytes).toEqual([0xef, 0xbb, 0xbf, 0x7b]); // BOM + {
    });

    it('should include BOM variants for XML', () => {
      const xml = MAGIC_NUMBER_DATABASE.find((s) => s.mimeType === 'application/xml');
      const bomPattern = xml?.patterns.find((p) => p.description.includes('BOM'));
      expect(bomPattern).toBeDefined();
      expect(bomPattern?.bytes).toEqual([0xef, 0xbb, 0xbf, 0x3c, 0x3f, 0x78, 0x6d, 0x6c]); // BOM + <?xml
    });
  });

  describe('UTF-8 BOM utilities', () => {
    it('should define UTF-8 BOM correctly', () => {
      expect(UTF8_BOM).toEqual([0xef, 0xbb, 0xbf]);
    });

    it('should detect BOM in buffer', () => {
      const withBOM = Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]); // BOM + {}
      const withoutBOM = Buffer.from([0x7b, 0x7d]); // {}

      expect(hasBOM(withBOM)).toBe(true);
      expect(hasBOM(withoutBOM)).toBe(false);
    });

    it('should handle short buffers without BOM', () => {
      const shortBuffer = Buffer.from([0xef, 0xbb]); // Too short
      expect(hasBOM(shortBuffer)).toBe(false);
    });

    it('should return correct BOM offset', () => {
      const withBOM = Buffer.from([0xef, 0xbb, 0xbf, 0x7b]);
      const withoutBOM = Buffer.from([0x7b, 0x7d]);

      expect(getBOMOffset(withBOM)).toBe(3);
      expect(getBOMOffset(withoutBOM)).toBe(0);
    });

    it('should handle empty buffer', () => {
      const empty = Buffer.from([]);
      expect(hasBOM(empty)).toBe(false);
      expect(getBOMOffset(empty)).toBe(0);
    });
  });

  describe('Priority ordering verification', () => {
    it('should check XML before NDJSON', () => {
      const xmlIdx = MAGIC_NUMBER_DATABASE.findIndex((s) => s.mimeType === 'application/xml');
      const ndjsonIdx = MAGIC_NUMBER_DATABASE.findIndex(
        (s) => s.mimeType === 'application/x-ndjson',
      );
      expect(xmlIdx).toBeLessThan(ndjsonIdx);
    });

    it('should check NDJSON before JSON', () => {
      // NDJSON must be checked first to disambiguate from JSON
      const ndjsonIdx = MAGIC_NUMBER_DATABASE.findIndex(
        (s) => s.mimeType === 'application/x-ndjson',
      );
      const jsonIdx = MAGIC_NUMBER_DATABASE.findIndex((s) => s.mimeType === 'application/json');
      expect(ndjsonIdx).toBeLessThan(jsonIdx);
    });

    it('should check JSON before YAML', () => {
      const jsonIdx = MAGIC_NUMBER_DATABASE.findIndex((s) => s.mimeType === 'application/json');
      const yamlIdx = MAGIC_NUMBER_DATABASE.findIndex((s) => s.mimeType === 'application/yaml');
      expect(jsonIdx).toBeLessThan(yamlIdx);
    });

    it('should check text/plain last', () => {
      const textIdx = MAGIC_NUMBER_DATABASE.findIndex((s) => s.mimeType === 'text/plain');
      expect(textIdx).toBe(MAGIC_NUMBER_DATABASE.length - 1);
    });
  });
});
