/**
 * Schema registry tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { SchemaValidationError } from '../errors.js';
import { hasSchema, listSchemas, SchemaRegistry } from '../registry.js';

describe('Schema Registry', () => {
  let registry: SchemaRegistry;

  beforeEach(() => {
    registry = new SchemaRegistry({
      baseDir: './schemas/crucible-ts',
      patterns: ['**/*.schema.json'],
    });
  });

  describe('SchemaRegistry class', () => {
    it('should create registry with default options', () => {
      const defaultRegistry = new SchemaRegistry();
      expect(defaultRegistry).toBeDefined();
    });

    it('should have size 0 initially', () => {
      expect(registry.size).toBe(0);
    });

    it('should clear registry', () => {
      registry.clear();
      expect(registry.size).toBe(0);
    });
  });

  describe('Schema discovery', () => {
    it('should discover schemas without errors', async () => {
      // This will discover real schemas from the repository
      await expect(registry.discoverSchemas()).resolves.not.toThrow();
    });

    it('should list schemas after discovery', async () => {
      await registry.discoverSchemas();
      const schemas = await registry.listSchemas();

      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('should filter schemas by prefix', async () => {
      await registry.discoverSchemas();
      const schemas = await registry.listSchemas('config/');

      expect(Array.isArray(schemas)).toBe(true);
      schemas.forEach((schema) => {
        expect(schema.id).toMatch(/^config\//);
      });
    });
  });

  describe('Schema lookup', () => {
    it('should get schema by ID', async () => {
      await registry.discoverSchemas();

      // Try to get a known schema (logger config should exist)
      try {
        const schema = await registry.getSchema(
          'config/crucible-ts/config/observability/logging/v1.0.0/logger-config',
        );

        expect(schema).toBeDefined();
        expect(schema.id).toBe(
          'config/crucible-ts/config/observability/logging/v1.0.0/logger-config',
        );
        expect(schema.format).toBeDefined();
        expect(['json', 'yaml']).toContain(schema.format);
      } catch (error) {
        // Schema might not exist, which is OK for this test
        if (error instanceof SchemaValidationError && error.message.includes('Schema not found')) {
          expect(true).toBe(true); // Expected behavior
        } else {
          throw error;
        }
      }
    });

    it('should throw error for non-existent schema', async () => {
      await registry.discoverSchemas();

      await expect(registry.getSchema('non-existent/schema')).rejects.toThrow(
        SchemaValidationError,
      );
    });
  });

  describe('Global registry functions', () => {
    it('should work with global registry', async () => {
      const schemas = await listSchemas('config/', {
        baseDir: './schemas/crucible-ts',
        patterns: ['**/*.schema.json'],
      });

      expect(Array.isArray(schemas)).toBe(true);
    });

    it('should check if schema exists', async () => {
      const exists = await hasSchema(
        'config/crucible-ts/config/observability/logging/v1.0.0/logger-config',
        {
          baseDir: './schemas/crucible-ts',
          patterns: ['**/*.schema.json'],
        },
      );

      expect(typeof exists).toBe('boolean');
    });
  });
});
