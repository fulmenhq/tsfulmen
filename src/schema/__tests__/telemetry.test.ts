/**
 * Schema module telemetry integration tests
 * Validates telemetry metrics emission for schema validation operations
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { metrics } from '../../telemetry/index.js';
import { SchemaValidationError } from '../errors.js';
import { compileSchemaById, validateData, validateDataBySchemaId } from '../validator.js';

describe('Schema Module - Telemetry Integration', () => {
  beforeEach(async () => {
    await metrics.flush();
  });

  afterEach(async () => {
    await metrics.flush();
  });

  describe('schema_validations counter', () => {
    it('should emit counter for successful validation', async () => {
      await metrics.flush();

      const testSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      };

      const validator = await import('ajv').then((Ajv) => {
        const ajv = new Ajv.default();
        return ajv.compile(testSchema);
      });

      const validData = { name: 'test' };
      const result = validateData(validData, validator);

      expect(result.valid).toBe(true);

      const events = await metrics.export();
      const counter = events.find((e) => e.name === 'schema_validations');

      expect(counter).toBeDefined();
      expect(typeof counter?.value).toBe('number');
      expect(counter?.value).toBeGreaterThanOrEqual(1);
    });

    it('should emit counter for multiple successful validations', async () => {
      await metrics.flush();

      const testSchema = {
        type: 'object',
        properties: {
          id: { type: 'number' },
        },
      };

      const validator = await import('ajv').then((Ajv) => {
        const ajv = new Ajv.default();
        return ajv.compile(testSchema);
      });

      validateData({ id: 1 }, validator);
      validateData({ id: 2 }, validator);

      const events = await metrics.export();
      const counter = events.find((e) => e.name === 'schema_validations');

      expect(counter).toBeDefined();
      expect(typeof counter?.value).toBe('number');
      expect(counter?.value).toBe(2);
    });
  });

  describe('schema_validation_errors counter', () => {
    it('should emit counter for validation failure', async () => {
      await metrics.flush();

      const testSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      };

      const validator = await import('ajv').then((Ajv) => {
        const ajv = new Ajv.default();
        return ajv.compile(testSchema);
      });

      const invalidData = { age: 42 };
      const result = validateData(invalidData, validator);

      expect(result.valid).toBe(false);

      const events = await metrics.export();
      const counter = events.find((e) => e.name === 'schema_validation_errors');

      expect(counter).toBeDefined();
      expect(typeof counter?.value).toBe('number');
      expect(counter?.value).toBeGreaterThanOrEqual(1);
    });

    it('should emit counter for schema not found error', async () => {
      await metrics.flush();

      try {
        await validateDataBySchemaId({}, 'nonexistent/schema');
        throw new Error('Expected validation to throw');
      } catch (err) {
        if (err instanceof Error && err.message.includes('Expected validation')) {
          throw err;
        }
        expect(err).toBeInstanceOf(SchemaValidationError);
      }

      const events = await metrics.export();
      const counter = events.find((e) => e.name === 'schema_validation_errors');

      expect(counter).toBeDefined();
      expect(typeof counter?.value).toBe('number');
      expect(counter?.value).toBeGreaterThanOrEqual(1);
    });

    it('should emit counter for compilation errors', async () => {
      await metrics.flush();

      try {
        await compileSchemaById('nonexistent/schema-id');
        throw new Error('Expected compilation to throw');
      } catch (err) {
        if (err instanceof Error && err.message.includes('Expected compilation')) {
          throw err;
        }
        expect(err).toBeInstanceOf(SchemaValidationError);
      }

      const events = await metrics.export();
      const counter = events.find((e) => e.name === 'schema_validation_errors');

      expect(counter).toBeDefined();
      expect(counter?.value).toBeGreaterThanOrEqual(1);
    });
  });

  describe('backward compatibility', () => {
    it('should still throw SchemaValidationError on errors', async () => {
      await expect(validateDataBySchemaId({}, 'nonexistent/schema')).rejects.toThrow(
        SchemaValidationError,
      );
    });

    it('should return validation result with diagnostics', async () => {
      const testSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      };

      const validator = await import('ajv').then((Ajv) => {
        const ajv = new Ajv.default();
        return ajv.compile(testSchema);
      });

      const invalidData = {};
      const result = validateData(invalidData, validator);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toBeDefined();
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });

    it('should preserve existing validation result structure', async () => {
      const testSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const validator = await import('ajv').then((Ajv) => {
        const ajv = new Ajv.default();
        return ajv.compile(testSchema);
      });

      const result = validateData({ name: 'test' }, validator);

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('diagnostics');
      expect(result).toHaveProperty('source');
      expect(result.valid).toBe(true);
      expect(result.source).toBe('ajv');
    });
  });

  describe('metric accuracy', () => {
    it('should increment counters correctly for multiple validations', async () => {
      await metrics.flush();

      const testSchema = {
        type: 'object',
        properties: {
          value: { type: 'number' },
        },
      };

      const validator = await import('ajv').then((Ajv) => {
        const ajv = new Ajv.default();
        return ajv.compile(testSchema);
      });

      validateData({ value: 1 }, validator);
      validateData({ value: 2 }, validator);
      validateData({ value: 'invalid' }, validator);

      const events = await metrics.export();
      const validations = events.find((e) => e.name === 'schema_validations');
      const errors = events.find((e) => e.name === 'schema_validation_errors');

      expect(validations?.value).toBe(2);
      expect(errors?.value).toBe(1);
    });
  });
});
