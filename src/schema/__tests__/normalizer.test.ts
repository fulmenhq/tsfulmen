/**
 * Schema normalizer tests
 */

import { describe, expect, it } from 'vitest';
import { SchemaValidationError } from '../errors.js';
import { compareSchemas, normalizeSchema } from '../normalizer.js';

describe('Schema Normalizer', () => {
  describe('normalizeSchema', () => {
    it('should normalize JSON input', () => {
      const input = {
        title: 'Test Schema',
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      const result = normalizeSchema(input);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual(input);
      expect(result).toContain('  '); // Pretty-printed with indentation
    });

    it('should normalize YAML input', () => {
      const yaml = `
title: Test Schema
type: object
properties:
  name:
    type: string
  age:
    type: number
`;

      const result = normalizeSchema(yaml);
      const parsed = JSON.parse(result);

      expect(parsed.title).toBe('Test Schema');
      expect(parsed.type).toBe('object');
      expect(parsed.properties.name.type).toBe('string');
    });

    it('should strip YAML comments', () => {
      const yaml = `
# This is a comment
title: Test Schema
type: object # inline comment
properties:
  name:
    type: string # another comment
`;

      const result = normalizeSchema(yaml);
      expect(result).not.toContain('#');
      expect(result).not.toContain('comment');

      const parsed = JSON.parse(result);
      expect(parsed.title).toBe('Test Schema');
    });

    it('should sort keys lexicographically', () => {
      const input = {
        zebra: 1,
        apple: 2,
        middle: 3,
        banana: 4,
      };

      const result = normalizeSchema(input);
      const keys = Object.keys(JSON.parse(result));

      expect(keys).toEqual(['apple', 'banana', 'middle', 'zebra']);
    });

    it('should sort nested object keys', () => {
      const input = {
        outer: {
          zebra: 1,
          apple: 2,
        },
        inner: {
          banana: 3,
          middle: 4,
        },
      };

      const result = normalizeSchema(input);
      const parsed = JSON.parse(result);

      expect(Object.keys(parsed)).toEqual(['inner', 'outer']);
      expect(Object.keys(parsed.outer)).toEqual(['apple', 'zebra']);
      expect(Object.keys(parsed.inner)).toEqual(['banana', 'middle']);
    });

    it('should preserve arrays', () => {
      const input = {
        items: [
          { name: 'third', value: 3 },
          { name: 'first', value: 1 },
          { name: 'second', value: 2 },
        ],
      };

      const result = normalizeSchema(input);
      const parsed = JSON.parse(result);

      expect(parsed.items).toHaveLength(3);
      expect(parsed.items[0].name).toBe('third');
      expect(parsed.items[1].name).toBe('first');
      expect(parsed.items[2].name).toBe('second');
    });

    it('should support compact mode', () => {
      const input = {
        title: 'Test',
        type: 'object',
      };

      const result = normalizeSchema(input, { compact: true });

      expect(result).not.toContain('\n');
      expect(result).not.toContain('  ');
      expect(JSON.parse(result)).toEqual(input);
    });

    it('should handle empty input error', () => {
      expect(() => normalizeSchema('')).toThrow(SchemaValidationError);
      expect(() => normalizeSchema('')).toThrow('schema content is empty');
    });

    it('should handle invalid YAML/JSON', () => {
      expect(() => normalizeSchema('{ invalid json')).toThrow(SchemaValidationError);
    });

    it('should handle Buffer input', () => {
      const json = JSON.stringify({ title: 'Test', type: 'object' });
      const buffer = Buffer.from(json);

      const result = normalizeSchema(buffer);
      const parsed = JSON.parse(result);

      expect(parsed.title).toBe('Test');
      expect(parsed.type).toBe('object');
    });
  });

  describe('compareSchemas', () => {
    it('should return equal for identical schemas', () => {
      const schemaA = { title: 'Test', type: 'object' };
      const schemaB = { title: 'Test', type: 'object' };

      const result = compareSchemas(schemaA, schemaB);

      expect(result.equal).toBe(true);
      expect(result.normalizedA).toBe(result.normalizedB);
    });

    it('should return equal for schemas with different key order', () => {
      const schemaA = { type: 'object', title: 'Test' };
      const schemaB = { title: 'Test', type: 'object' };

      const result = compareSchemas(schemaA, schemaB);

      expect(result.equal).toBe(true);
    });

    it('should return not equal for different schemas', () => {
      const schemaA = { title: 'Test A', type: 'object' };
      const schemaB = { title: 'Test B', type: 'object' };

      const result = compareSchemas(schemaA, schemaB);

      expect(result.equal).toBe(false);
      expect(result.normalizedA).not.toBe(result.normalizedB);
    });

    it('should compare YAML and JSON equivalents as equal', () => {
      const json = JSON.stringify({ title: 'Test', type: 'object' });
      const yaml = 'title: Test\ntype: object';

      const result = compareSchemas(json, yaml);

      expect(result.equal).toBe(true);
    });

    it('should strip comments before comparison', () => {
      const yamlWithComments = `
# Comment
title: Test
type: object # inline
`;
      const yamlWithoutComments = 'title: Test\ntype: object';

      const result = compareSchemas(yamlWithComments, yamlWithoutComments);

      expect(result.equal).toBe(true);
    });

    it('should return normalized versions for debugging', () => {
      const schemaA = { type: 'object', title: 'A' };
      const schemaB = { type: 'object', title: 'B' };

      const result = compareSchemas(schemaA, schemaB);

      expect(result.normalizedA).toContain('"title": "A"');
      expect(result.normalizedB).toContain('"title": "B"');
      expect(JSON.parse(result.normalizedA)).toEqual({
        title: 'A',
        type: 'object',
      });
      expect(JSON.parse(result.normalizedB)).toEqual({
        title: 'B',
        type: 'object',
      });
    });

    it('should support compact option', () => {
      const schemaA = { title: 'Test', type: 'object' };
      const schemaB = { type: 'object', title: 'Test' };

      const result = compareSchemas(schemaA, schemaB, { compact: true });

      expect(result.equal).toBe(true);
      expect(result.normalizedA).not.toContain('\n');
      expect(result.normalizedB).not.toContain('\n');
    });
  });
});
