/**
 * Loader Tests
 *
 * Test loading, parsing, and validation logic
 */

import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppIdentityError } from '../errors.js';
import { clearIdentityCache, loadIdentity } from '../loader.js';
import type { Identity } from '../types.js';

describe('loadIdentity', () => {
  const fixturesDir = join(__dirname, '../__fixtures__');
  const validDir = join(fixturesDir, 'valid');
  const invalidDir = join(fixturesDir, 'invalid');

  beforeEach(() => {
    clearIdentityCache();
  });

  afterEach(() => {
    clearIdentityCache();
  });

  describe('valid identities', () => {
    it('should load minimal valid identity', async () => {
      const identity = await loadIdentity({
        path: join(validDir, 'minimal.yaml'),
      });

      expect(identity).toBeDefined();
      expect(identity.app.binary_name).toBe('testapp');
      expect(identity.app.vendor).toBe('testvendor');
      expect(identity.app.env_prefix).toBe('TESTAPP_');
      expect(identity.app.config_name).toBe('testapp');
      expect(identity.app.description).toBe('Test application for unit testing');
      expect(identity.metadata).toBeUndefined();
    });

    it('should load complete identity with metadata', async () => {
      const identity = await loadIdentity({
        path: join(validDir, 'complete.yaml'),
      });

      expect(identity).toBeDefined();
      expect(identity.app.binary_name).toBe('myapp');
      expect(identity.metadata).toBeDefined();
      expect(identity.metadata?.project_url).toBe('https://github.com/acmecorp/myapp');
      expect(identity.metadata?.license).toBe('MIT');
      expect(identity.metadata?.repository_category).toBe('cli');
      expect(identity.metadata?.telemetry_namespace).toBe('acmecorp_myapp');
    });
  });

  describe('test injection', () => {
    it('should accept test injection', async () => {
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

      expect(identity).toBeDefined();
      expect(identity.app.binary_name).toBe('testapp');
    });

    it('should clone test injection to prevent mutation', async () => {
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

      // Should be different objects
      expect(identity).not.toBe(fixture);
      expect(identity.app).not.toBe(fixture.app);
    });
  });

  describe('validation', () => {
    it('should validate against schema by default', async () => {
      await expect(
        loadIdentity({
          path: join(invalidDir, 'missing-required.yaml'),
        }),
      ).rejects.toThrow(AppIdentityError);
    });

    it('should throw on invalid field patterns', async () => {
      await expect(
        loadIdentity({
          path: join(invalidDir, 'invalid-patterns.yaml'),
        }),
      ).rejects.toThrow(AppIdentityError);
    });

    it('should skip validation when skipValidation is true', async () => {
      // This would normally fail validation but should succeed with skipValidation
      const identity = await loadIdentity({
        path: join(invalidDir, 'missing-required.yaml'),
        skipValidation: true,
      });

      expect(identity).toBeDefined();
    });
  });

  describe('parsing errors', () => {
    it('should throw on malformed YAML', async () => {
      await expect(
        loadIdentity({
          path: join(invalidDir, 'malformed.yaml'),
        }),
      ).rejects.toThrow(AppIdentityError);
    });

    it('should throw on missing file', async () => {
      await expect(
        loadIdentity({
          path: join(fixturesDir, 'does-not-exist.yaml'),
        }),
      ).rejects.toThrow(AppIdentityError);
    });
  });

  describe('immutability', () => {
    it('should freeze returned identity object', async () => {
      const identity = await loadIdentity({
        path: join(validDir, 'minimal.yaml'),
      });

      expect(Object.isFrozen(identity)).toBe(true);
    });

    it('should freeze nested objects', async () => {
      const identity = await loadIdentity({
        path: join(validDir, 'complete.yaml'),
      });

      expect(Object.isFrozen(identity.app)).toBe(true);
      expect(Object.isFrozen(identity.metadata)).toBe(true);
    });

    it('should prevent modification attempts', async () => {
      const identity = await loadIdentity({
        path: join(validDir, 'minimal.yaml'),
      });
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

  describe('error details', () => {
    it('should include path in validation errors', async () => {
      try {
        await loadIdentity({
          path: join(invalidDir, 'missing-required.yaml'),
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppIdentityError);
        expect((error as AppIdentityError).identityPath).toContain('missing-required.yaml');
      }
    });

    it('should include diagnostics in validation errors', async () => {
      try {
        await loadIdentity({
          path: join(invalidDir, 'missing-required.yaml'),
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppIdentityError);
        expect((error as Error).message).toContain('error(s)');
      }
    });
  });
});
