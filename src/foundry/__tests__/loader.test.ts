/**
 * Foundry loader tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FoundryCatalogError } from '../errors.js';
import {
  loadAllCatalogs,
  loadCountryCodeCatalog,
  loadHttpStatusCatalog,
  loadMimeTypeCatalog,
  loadPatternCatalog,
} from '../loader.js';

// Mock the file system operations
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('yaml', () => ({
  parse: vi.fn((content: string) => {
    // Simple YAML parser mock for testing - return appropriate structure based on content
    if (content.includes('patterns:') || content.includes('test-pattern')) {
      return {
        version: 'v0.1.0',
        description: 'Test patterns',
        patterns: [
          {
            id: 'test-pattern',
            name: 'Test Pattern',
            kind: 'regex' as const,
            pattern: '^test$',
            description: 'A test pattern',
          },
        ],
      };
    }
    if (content.includes('groups:') || content.includes('success')) {
      return {
        version: 'v0.1.0',
        description: 'Test HTTP statuses',
        groups: [
          {
            id: 'success',
            name: 'Success',
            description: 'Success responses',
            codes: [{ value: 200, reason: 'OK' }],
          },
        ],
      };
    }
    if (content.includes('types:') || content.includes('json')) {
      return {
        version: 'v0.1.0',
        description: 'Test MIME types',
        types: [
          {
            id: 'json',
            mime: 'application/json',
            name: 'JSON',
            extensions: ['json'],
          },
        ],
      };
    }
    if (content.includes('countries:') || content.includes('US')) {
      return {
        version: 'v0.1.0',
        description: 'Test countries',
        countries: [
          {
            alpha2: 'US',
            alpha3: 'USA',
            numeric: '840',
            name: 'United States',
          },
        ],
      };
    }
    return { version: 'v0.1.0', description: 'Test catalog' };
  }),
}));

describe('Foundry Loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadPatternCatalog', () => {
    it('should load and validate pattern catalog', async () => {
      const { readFile } = await import('node:fs/promises');
      const mockReadFile = vi.mocked(readFile);
      mockReadFile.mockResolvedValue('patterns:\n  - id: test-pattern');

      const catalog = await loadPatternCatalog();

      expect(catalog.version).toBe('v0.1.0');
      expect(catalog.description).toBe('Test patterns');
      expect(catalog.patterns).toHaveLength(1);
      expect(catalog.patterns[0].id).toBe('test-pattern');
    });

    it('should throw FoundryCatalogError for missing file', async () => {
      const { readFile } = await import('node:fs/promises');
      const mockReadFile = vi.mocked(readFile);
      mockReadFile.mockRejectedValue({ code: 'ENOENT' });

      await expect(loadPatternCatalog()).rejects.toThrow(FoundryCatalogError);
      await expect(loadPatternCatalog()).rejects.toThrow('Catalog patterns not found');
    });

    it('should throw FoundryCatalogError for invalid schema', async () => {
      const { readFile } = await import('node:fs/promises');
      const mockReadFile = vi.mocked(readFile);
      mockReadFile.mockResolvedValue('invalid: content');

      // Mock YAML parse to return invalid structure
      const { parse } = await import('yaml');
      const mockParse = vi.mocked(parse);
      mockParse.mockReturnValue({ version: 'v0.1.0' }); // Missing patterns array

      await expect(loadPatternCatalog()).rejects.toThrow(FoundryCatalogError);
      await expect(loadPatternCatalog()).rejects.toThrow(
        'Patterns catalog must have patterns array',
      );
    });
  });

  describe('loadHttpStatusCatalog', () => {
    it('should load and validate HTTP status catalog', async () => {
      const { readFile } = await import('node:fs/promises');
      const mockReadFile = vi.mocked(readFile);
      mockReadFile.mockResolvedValue('groups:\n  - id: success');

      const catalog = await loadHttpStatusCatalog();

      expect(catalog.version).toBe('v0.1.0');
      expect(catalog.description).toBe('Test HTTP statuses');
      expect(catalog.groups).toHaveLength(1);
      expect(catalog.groups[0].id).toBe('success');
    });
  });

  describe('loadMimeTypeCatalog', () => {
    it('should load and validate MIME type catalog', async () => {
      const { readFile } = await import('node:fs/promises');
      const mockReadFile = vi.mocked(readFile);
      mockReadFile.mockResolvedValue('types:\n  - id: json');

      const catalog = await loadMimeTypeCatalog();

      expect(catalog.version).toBe('v0.1.0');
      expect(catalog.description).toBe('Test MIME types');
      expect(catalog.types).toHaveLength(1);
      expect(catalog.types[0].id).toBe('json');
    });
  });

  describe('loadCountryCodeCatalog', () => {
    it('should load and validate country code catalog', async () => {
      const { readFile } = await import('node:fs/promises');
      const mockReadFile = vi.mocked(readFile);
      mockReadFile.mockResolvedValue('countries:\n  - alpha2: US');

      const catalog = await loadCountryCodeCatalog();

      expect(catalog.version).toBe('v0.1.0');
      expect(catalog.description).toBe('Test countries');
      expect(catalog.countries).toHaveLength(1);
      expect(catalog.countries[0].alpha2).toBe('US');
    });
  });

  describe('loadAllCatalogs', () => {
    it('should load all catalogs in parallel', async () => {
      const { readFile } = await import('node:fs/promises');
      const mockReadFile = vi.mocked(readFile);

      // Mock different responses based on file path
      mockReadFile.mockImplementation(async (path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes('patterns')) return 'patterns:\n  - id: test';
        if (pathStr.includes('http-statuses')) return 'groups:\n  - id: success';
        if (pathStr.includes('mime-types')) return 'types:\n  - id: json';
        if (pathStr.includes('country-codes')) return 'countries:\n  - alpha2: US';
        return '';
      });

      const catalogs = await loadAllCatalogs();

      expect(catalogs.patterns.version).toBe('v0.1.0');
      expect(catalogs.httpStatuses.version).toBe('v0.1.0');
      expect(catalogs.mimeTypes.version).toBe('v0.1.0');
      expect(catalogs.countryCodes.version).toBe('v0.1.0');

      // Verify parallel loading
      expect(mockReadFile).toHaveBeenCalledTimes(4);
    });
  });

  describe('Bun integration', () => {
    it('should use Bun.file() when available', async () => {
      // Mock Bun global
      const mockBun = {
        file: vi.fn((_path: string) => ({
          exists: vi.fn().mockResolvedValue(true),
          text: vi.fn().mockResolvedValue('patterns:\n  - id: bun-test'),
        })),
      };

      const originalBun = (global as any).Bun;
      (global as any).Bun = mockBun;

      try {
        const { parse } = await import('yaml');
        const mockParse = vi.mocked(parse);
        mockParse.mockReturnValue({
          version: 'v0.1.0',
          description: 'Bun test patterns',
          patterns: [
            {
              id: 'bun-test',
              name: 'Bun Test',
              kind: 'regex' as const,
              pattern: '^bun$',
            },
          ],
        });

        const catalog = await loadPatternCatalog();

        expect(mockBun.file).toHaveBeenCalledWith(
          'config/crucible-ts/library/foundry/patterns.yaml',
        );
        expect(catalog.patterns[0].id).toBe('bun-test');
      } finally {
        // Restore original Bun
        (global as any).Bun = originalBun;
      }
    });
  });
});
