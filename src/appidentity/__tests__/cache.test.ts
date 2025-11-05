/**
 * Cache Tests
 *
 * Test caching behavior for identity objects
 */

import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearIdentityCache, getCachedIdentity, loadIdentity } from '../loader.js';
import type { Identity } from '../types.js';

describe('identity caching', () => {
  const fixturesDir = join(__dirname, '../__fixtures__/valid');
  const minimalFixture = join(fixturesDir, 'minimal.yaml');

  beforeEach(() => {
    clearIdentityCache();
  });

  afterEach(() => {
    clearIdentityCache();
  });

  describe('getCachedIdentity', () => {
    it('should return null when cache is empty', () => {
      const cached = getCachedIdentity();
      expect(cached).toBeNull();
    });

    it('should return cached identity after load', async () => {
      await loadIdentity({ path: minimalFixture });

      const cached = getCachedIdentity();
      expect(cached).not.toBeNull();
      expect(cached?.app.binary_name).toBe('testapp');
    });
  });

  describe('clearIdentityCache', () => {
    it('should clear cached identity', async () => {
      await loadIdentity({ path: minimalFixture });
      expect(getCachedIdentity()).not.toBeNull();

      clearIdentityCache();

      expect(getCachedIdentity()).toBeNull();
    });
  });

  describe('cache behavior', () => {
    it('should cache identity after first load', async () => {
      const id1 = await loadIdentity({ path: minimalFixture });
      const id2 = await loadIdentity({ path: minimalFixture });

      // Same object reference (cached)
      expect(id1).toBe(id2);
    });

    it('should return same frozen object on cache hits', async () => {
      const id1 = await loadIdentity({ path: minimalFixture });
      const id2 = await loadIdentity({ path: minimalFixture });

      expect(Object.isFrozen(id1)).toBe(true);
      expect(Object.isFrozen(id2)).toBe(true);
      expect(id1).toBe(id2);
    });

    it('should not cache test injections', async () => {
      const fixture: Identity = {
        app: {
          binary_name: 'testapp',
          vendor: 'testvendor',
          env_prefix: 'TESTAPP_',
          config_name: 'testapp',
          description: 'Test application',
        },
      };

      const id1 = await loadIdentity({ identity: fixture });
      const id2 = await loadIdentity({ identity: fixture });

      // Different objects (not cached)
      expect(id1).not.toBe(id2);
      expect(getCachedIdentity()).toBeNull();
    });

    it('should bypass cache when skipCache is true', async () => {
      const id1 = await loadIdentity({ path: minimalFixture });
      const id2 = await loadIdentity({ path: minimalFixture, skipCache: true });

      // Different objects (cache bypassed)
      expect(id1).not.toBe(id2);
    });

    it('should update cache after skipCache load', async () => {
      const id1 = await loadIdentity({ path: minimalFixture });
      const id2 = await loadIdentity({ path: minimalFixture, skipCache: true });

      // Cache now contains id2
      const cached = getCachedIdentity();
      expect(cached).toBe(id2);
      expect(cached).not.toBe(id1);
    });
  });

  describe('immutability', () => {
    it('should freeze cached identity', async () => {
      const identity = await loadIdentity({ path: minimalFixture });

      expect(Object.isFrozen(identity)).toBe(true);
      expect(Object.isFrozen(identity.app)).toBe(true);
    });

    it('should freeze test injections', async () => {
      const fixture: Identity = {
        app: {
          binary_name: 'testapp',
          vendor: 'testvendor',
          env_prefix: 'TESTAPP_',
          config_name: 'testapp',
          description: 'Test application',
        },
      };

      const identity = await loadIdentity({ identity: fixture });

      expect(Object.isFrozen(identity)).toBe(true);
      expect(Object.isFrozen(identity.app)).toBe(true);
    });

    it('should prevent modification of cached identity', async () => {
      const identity = await loadIdentity({ path: minimalFixture });
      const originalValue = identity.app.binary_name;

      // Attempt to modify (fails silently in non-strict mode)
      try {
        // @ts-expect-error Testing immutability
        identity.app.binary_name = 'modified';
      } catch {
        // Throws in strict mode
      }

      // Value should remain unchanged
      expect(identity.app.binary_name).toBe(originalValue);
    });
  });
});
