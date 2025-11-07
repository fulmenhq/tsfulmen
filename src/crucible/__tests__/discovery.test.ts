import { describe, expect, it } from 'vitest';
import { listAssets, listCategories } from '../discovery.js';

describe('listCategories', () => {
  it('returns all asset categories', () => {
    const categories = listCategories();

    expect(categories).toEqual(['docs', 'schemas', 'config', 'templates']);
  });

  it('returns readonly array', () => {
    const categories = listCategories();
    expect(Array.isArray(categories)).toBe(true);
  });

  it('returns same reference on multiple calls', () => {
    const categories1 = listCategories();
    const categories2 = listCategories();
    expect(categories1).toBe(categories2);
  });
});

describe('listAssets', () => {
  describe('docs category', () => {
    it('discovers documentation assets', async () => {
      const assets = await listAssets('docs');

      expect(assets.length).toBeGreaterThan(0);
      expect(assets.every((a) => a.category === 'docs')).toBe(true);
    });

    it('returns assets with .md extension in IDs', async () => {
      const assets = await listAssets('docs');

      expect(assets.every((a) => a.id.endsWith('.md'))).toBe(true);
    });

    it('includes known documentation files', async () => {
      const assets = await listAssets('docs');
      const ids = assets.map((a) => a.id);

      expect(ids.some((id) => id.includes('standards/') && id.endsWith('.md'))).toBe(true);
    });

    it('returns assets with metadata', async () => {
      const assets = await listAssets('docs');
      const asset = assets[0];

      expect(asset).toBeDefined();
      expect(asset.id).toBeDefined();
      expect(asset.category).toBe('docs');
      expect(asset.path).toBeDefined();
      expect(asset.size).toBeGreaterThan(0);
      expect(asset.modified).toBeInstanceOf(Date);
    });

    it('returns assets sorted lexicographically', async () => {
      const assets = await listAssets('docs');
      const ids = assets.map((a) => a.id);

      const sorted = [...ids].sort((a, b) => a.localeCompare(b));
      expect(ids).toEqual(sorted);
    });
  });

  describe('schemas category', () => {
    it('discovers schema assets', async () => {
      const assets = await listAssets('schemas');

      expect(assets.length).toBeGreaterThan(0);
      expect(assets.every((a) => a.category === 'schemas')).toBe(true);
    });

    it('returns assets without file extensions in IDs', async () => {
      const assets = await listAssets('schemas');

      expect(assets.every((a) => !a.id.endsWith('.json'))).toBe(true);
      expect(assets.every((a) => !a.id.endsWith('.yaml'))).toBe(true);
    });

    it('includes known schema files', async () => {
      const assets = await listAssets('schemas');
      const ids = assets.map((a) => a.id);

      expect(ids.some((id) => id.includes('observability/logging'))).toBe(true);
    });

    it('returns assets with metadata', async () => {
      const assets = await listAssets('schemas');
      const asset = assets[0];

      expect(asset).toBeDefined();
      expect(asset.id).toBeDefined();
      expect(asset.category).toBe('schemas');
      expect(asset.path).toBeDefined();
      expect(asset.size).toBeGreaterThan(0);
      expect(asset.modified).toBeInstanceOf(Date);
    });
  });

  describe('config category', () => {
    it('discovers config assets', async () => {
      const assets = await listAssets('config');

      expect(assets.length).toBeGreaterThan(0);
      expect(assets.every((a) => a.category === 'config')).toBe(true);
    });

    it('returns assets without file extensions in IDs', async () => {
      const assets = await listAssets('config');

      expect(assets.every((a) => !a.id.endsWith('.yaml'))).toBe(true);
      expect(assets.every((a) => !a.id.endsWith('.yml'))).toBe(true);
    });

    it('includes known config files', async () => {
      const assets = await listAssets('config');
      const ids = assets.map((a) => a.id);

      expect(ids.some((id) => id.includes('library/foundry'))).toBe(true);
    });
  });

  describe('templates category', () => {
    it('returns empty array when no templates exist', async () => {
      const assets = await listAssets('templates');

      expect(Array.isArray(assets)).toBe(true);
    });

    it('handles non-existent category gracefully', async () => {
      const assets = await listAssets('templates');
      expect(assets).toEqual([]);
    });
  });

  describe('prefix filtering', () => {
    it('filters assets by prefix', async () => {
      const allAssets = await listAssets('docs');
      const filteredAssets = await listAssets('docs', {
        prefix: 'standards/',
      });

      expect(filteredAssets.length).toBeGreaterThan(0);
      expect(filteredAssets.length).toBeLessThan(allAssets.length);
      expect(filteredAssets.every((a) => a.id.startsWith('standards/'))).toBe(true);
    });

    it('returns empty array when prefix matches nothing', async () => {
      const assets = await listAssets('docs', {
        prefix: 'nonexistent-prefix/',
      });

      expect(assets).toEqual([]);
    });

    it('maintains lexicographic sorting with prefix', async () => {
      const assets = await listAssets('docs', { prefix: 'standards/' });
      const ids = assets.map((a) => a.id);

      const sorted = [...ids].sort((a, b) => a.localeCompare(b));
      expect(ids).toEqual(sorted);
    });
  });

  describe('limit option', () => {
    it('limits number of results', async () => {
      const assets = await listAssets('docs', { limit: 5 });

      expect(assets.length).toBeLessThanOrEqual(5);
    });

    it('returns all assets when limit exceeds count', async () => {
      const allAssets = await listAssets('docs');
      const limitedAssets = await listAssets('docs', { limit: 10000 });

      expect(limitedAssets.length).toBe(allAssets.length);
    });

    it('respects limit with prefix filter', async () => {
      const assets = await listAssets('docs', {
        prefix: 'standards/',
        limit: 3,
      });

      expect(assets.length).toBeLessThanOrEqual(3);
      expect(assets.every((a) => a.id.startsWith('standards/'))).toBe(true);
    });

    it('handles limit of 0 by returning empty array', async () => {
      const assets = await listAssets('docs', { limit: 0 });
      expect(assets).toEqual([]);
    });
  });

  describe('performance', () => {
    it('completes full docs discovery in reasonable time', async () => {
      const start = performance.now();
      await listAssets('docs');
      const duration = performance.now() - start;

      // Allow 100ms headroom for system load, GC, and parallel test execution
      expect(duration).toBeLessThan(100);
    });

    it('completes full schemas discovery in reasonable time', async () => {
      const start = performance.now();
      await listAssets('schemas');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(150);
    });

    it('completes full config discovery in reasonable time', async () => {
      const start = performance.now();
      await listAssets('config');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});
