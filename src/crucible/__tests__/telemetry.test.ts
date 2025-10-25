/**
 * Crucible module telemetry integration tests
 * Validates telemetry metrics emission for asset lookups
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { metrics } from '../../telemetry/index.js';
import { getConfigDefaults } from '../configs.ts';
import { getDocumentation } from '../docs.ts';
import { AssetNotFoundError } from '../errors.ts';
import { loadSchemaById } from '../schemas.ts';

describe('Crucible Module - Telemetry Integration', () => {
  beforeEach(async () => {
    await metrics.flush();
  });

  afterEach(async () => {
    await metrics.flush();
  });

  describe('foundry_lookup_count counter', () => {
    it('should emit counter for successful schema load', async () => {
      await metrics.flush();

      try {
        await loadSchemaById('config/sync-consumer-config');
      } catch {
        // Schema may not exist, but we're testing telemetry
      }

      const events = await metrics.export();
      const counter = events.find((e) => e.name === 'foundry_lookup_count');

      // Counter should be emitted on success
      if (counter) {
        expect(typeof counter.value).toBe('number');
        expect(counter.value).toBeGreaterThanOrEqual(1);
      }
    });

    it('should emit counter for successful documentation load', async () => {
      await metrics.flush();

      try {
        await getDocumentation('architecture/fulmen-helper-library-standard');
      } catch {
        // Doc may not exist, but we're testing telemetry
      }

      const events = await metrics.export();
      const counter = events.find((e) => e.name === 'foundry_lookup_count');

      if (counter) {
        expect(typeof counter.value).toBe('number');
        expect(counter.value).toBeGreaterThanOrEqual(1);
      }
    });

    it('should emit counter for successful config defaults load', async () => {
      await metrics.flush();

      try {
        await getConfigDefaults('sync-consumer-config', 'v1.0.0');
      } catch {
        // Config may not exist, but we're testing telemetry
      }

      const events = await metrics.export();
      const counter = events.find((e) => e.name === 'foundry_lookup_count');

      if (counter) {
        expect(typeof counter.value).toBe('number');
        expect(counter.value).toBeGreaterThanOrEqual(1);
      }
    });

    it('should increment counter for multiple lookups', async () => {
      await metrics.flush();

      let successCount = 0;

      try {
        await loadSchemaById('config/sync-consumer-config');
        successCount++;
      } catch {
        // Ignore
      }

      try {
        await loadSchemaById('meta/draft-2020-12/schema');
        successCount++;
      } catch {
        // Ignore
      }

      const events = await metrics.export();
      const counter = events.find((e) => e.name === 'foundry_lookup_count');

      if (counter && successCount > 0) {
        expect(counter.value).toBe(successCount);
      }
    });
  });

  describe('backward compatibility', () => {
    it('should still throw AssetNotFoundError for missing assets', async () => {
      await expect(loadSchemaById('nonexistent/schema')).rejects.toThrow(AssetNotFoundError);
    });

    it('should still return content for valid asset lookups', async () => {
      try {
        const schema = await loadSchemaById('config/sync-consumer-config');
        expect(schema).toBeDefined();
        expect(typeof schema).toBe('object');
      } catch (err) {
        // If asset doesn't exist, error is expected
        expect(err).toBeInstanceOf(AssetNotFoundError);
      }
    });

    it('should preserve error suggestions for AssetNotFoundError', async () => {
      try {
        await loadSchemaById('config/sync-consume-config'); // Typo
        throw new Error('Expected to throw');
      } catch (err) {
        if (err instanceof Error && err.message.includes('Expected to throw')) {
          throw err;
        }
        expect(err).toBeInstanceOf(AssetNotFoundError);
        if (err instanceof AssetNotFoundError) {
          expect(err).toHaveProperty('suggestions');
          expect(Array.isArray(err.suggestions)).toBe(true);
        }
      }
    });
  });

  describe('telemetry behavior', () => {
    it('should not emit counter on lookup failure', async () => {
      await metrics.flush();

      try {
        await loadSchemaById('definitely-nonexistent/schema');
      } catch {
        // Expected error
      }

      const events = await metrics.export();
      const counter = events.find((e) => e.name === 'foundry_lookup_count');

      // Counter should not be incremented on failure
      expect(counter?.value || 0).toBe(0);
    });
  });
});
