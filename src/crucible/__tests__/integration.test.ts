import { describe, expect, it } from 'vitest';
import {
  AssetNotFoundError,
  type CrucibleVersion,
  getConfigDefaults,
  getCrucibleVersion,
  getDocumentation,
  getDocumentationWithMetadata,
  listAssets,
  listCategories,
  listConfigDefaults,
  listDocumentation,
  listSchemas,
  loadSchemaById,
} from '../index.js';

describe('crucible module integration', () => {
  describe('module exports', () => {
    it('exports all public APIs', () => {
      expect(getCrucibleVersion).toBeDefined();
      expect(listCategories).toBeDefined();
      expect(listAssets).toBeDefined();
      expect(listDocumentation).toBeDefined();
      expect(getDocumentation).toBeDefined();
      expect(getDocumentationWithMetadata).toBeDefined();
      expect(listSchemas).toBeDefined();
      expect(loadSchemaById).toBeDefined();
      expect(listConfigDefaults).toBeDefined();
      expect(getConfigDefaults).toBeDefined();
      expect(AssetNotFoundError).toBeDefined();
    });

    it('exports version metadata type', () => {
      const version: CrucibleVersion = {
        version: '2025.10.0',
        commit: 'abc123',
        syncedAt: '2025-10-22T00:00:00Z',
        dirty: false,
        syncMethod: 'git-tag',
      };
      expect(version).toBeDefined();
    });
  });

  describe('end-to-end workflows', () => {
    it('discovers and loads documentation', async () => {
      const docs = await listDocumentation({ limit: 1 });
      expect(docs.length).toBeGreaterThan(0);

      const firstDoc = docs[0];
      const content = await getDocumentation(firstDoc.id);
      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
    });

    it('discovers and loads schemas', async () => {
      const schemas = await listSchemas();
      expect(schemas.length).toBeGreaterThan(0);

      const firstSchema = schemas[0];
      const schema = await loadSchemaById(firstSchema.id);
      expect(schema).toBeDefined();
    });

    it('discovers and loads configs', async () => {
      const configs = await listConfigDefaults();
      expect(configs.length).toBeGreaterThan(0);
    });

    it('extracts metadata from documentation', async () => {
      const docs = await listDocumentation({
        prefix: 'standards/agentic-attribution.md',
      });
      if (docs.length > 0) {
        const result = await getDocumentationWithMetadata(docs[0].id);
        expect(result.content).toBeDefined();
        expect(result.metadata).toBeDefined();
      }
    });
  });

  describe('version and discovery integration', () => {
    it('provides version metadata', () => {
      const version = getCrucibleVersion();
      expect(version.version).toBeDefined();
      expect(version.commit).toBeDefined();
      expect(version.dirty).toBeDefined();
      expect(version.syncMethod).toBeDefined();
    });

    it('lists all asset categories', () => {
      const categories = listCategories();
      expect(categories).toContain('docs');
      expect(categories).toContain('schemas');
      expect(categories).toContain('config');
    });

    it('discovers assets across categories', async () => {
      const docs = await listAssets('docs', { limit: 5 });
      const schemas = await listAssets('schemas', { limit: 5 });
      const configs = await listAssets('config', { limit: 5 });

      expect(docs.length).toBeGreaterThan(0);
      expect(schemas.length).toBeGreaterThan(0);
      expect(configs.length).toBeGreaterThan(0);
    });
  });

  describe('error handling integration', () => {
    it('throws AssetNotFoundError with suggestions', async () => {
      try {
        await getDocumentation('standards/READM.md');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AssetNotFoundError);
        const notFoundError = error as AssetNotFoundError;
        expect(notFoundError.suggestions.length).toBeGreaterThan(0);
      }
    });

    it('provides helpful suggestions across asset types', async () => {
      try {
        await loadSchemaById('observability/logging/v1.0.0/loger-config');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AssetNotFoundError);
        const notFoundError = error as AssetNotFoundError;
        expect(notFoundError.suggestions).toContain('observability/logging/v1.0.0/logger-config');
      }
    });
  });

  describe('filtering and options', () => {
    it('filters documentation by prefix', async () => {
      const standardsDocs = await listDocumentation({ prefix: 'standards/' });
      expect(standardsDocs.every((d) => d.id.startsWith('standards/'))).toBe(true);
    });

    it('filters schemas by kind', async () => {
      const loggingSchemas = await listSchemas('observability');
      if (loggingSchemas.length > 0) {
        expect(loggingSchemas.every((s) => s.kind === 'observability')).toBe(true);
      }
    });

    it('filters configs by category', async () => {
      const terminalConfigs = await listConfigDefaults('terminal');
      if (terminalConfigs.length > 0) {
        expect(terminalConfigs.every((c) => c.configCategory === 'terminal')).toBe(true);
      }
    });

    it('respects limit option across functions', async () => {
      const limitedDocs = await listDocumentation({ limit: 3 });
      expect(limitedDocs.length).toBeLessThanOrEqual(3);

      const limitedAssets = await listAssets('docs', { limit: 3 });
      expect(limitedAssets.length).toBeLessThanOrEqual(3);
    });
  });

  describe('real-world use cases', () => {
    it('finds logging standard documentation', async () => {
      const docs = await listDocumentation({
        prefix: 'standards/observability/',
      });
      const loggingDoc = docs.find((d) => d.id.includes('logging'));
      if (loggingDoc) {
        const content = await getDocumentation(loggingDoc.id);
        expect(content).toContain('logging');
      }
    });

    it('loads logger config schema', async () => {
      const schema = await loadSchemaById('observability/logging/v1.0.0/logger-config');
      const schemaObj = schema as Record<string, unknown>;
      expect(schemaObj.$schema).toBeDefined();
    });

    it('validates schema structure', async () => {
      const schema = await loadSchemaById('observability/logging/v1.0.0/logger-config');
      const schemaObj = schema as Record<string, unknown>;
      expect(schemaObj.type).toBeDefined();
      expect(schemaObj.properties).toBeDefined();
    });
  });

  describe('performance', () => {
    it('discovers assets quickly', async () => {
      const start = performance.now();
      await Promise.all([listDocumentation({ limit: 10 }), listSchemas(), listConfigDefaults()]);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(250);
    });

    it('loads assets efficiently', async () => {
      const docs = await listDocumentation({ limit: 1 });
      if (docs.length > 0) {
        const start = performance.now();
        await getDocumentation(docs[0].id);
        const duration = performance.now() - start;
        expect(duration).toBeLessThan(50);
      }
    });
  });
});
