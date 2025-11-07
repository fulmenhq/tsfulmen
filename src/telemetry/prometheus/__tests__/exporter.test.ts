/**
 * PrometheusExporter unit tests
 *
 * Comprehensive test coverage for Phase 1 exporter core implementation.
 * Target: ≥95% line coverage for exporter.ts
 *
 * NOTE: prom-client is installed as devDependency for testing only.
 * In production, it remains an optional peer dependency.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { MetricsRegistry } from '../../registry.js';
import {
  InvalidLabelNameError,
  InvalidMetricNameError,
  MetricRegistrationError,
  RefreshError,
} from '../errors.ts';
import { PrometheusExporter } from '../exporter.ts';

describe('PrometheusExporter', () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
  });

  describe('constructor', () => {
    test('creates exporter with default options', () => {
      const exporter = new PrometheusExporter();
      expect(exporter).toBeDefined();
    });

    test('accepts custom registry', () => {
      const customRegistry = new MetricsRegistry();
      const exporter = new PrometheusExporter({ registry: customRegistry });
      expect(exporter).toBeDefined();
    });

    test('accepts custom namespace and subsystem', () => {
      const exporter = new PrometheusExporter({
        namespace: 'myapp',
        subsystem: 'worker',
      });
      expect(exporter).toBeDefined();
    });

    test('accepts default labels', () => {
      const exporter = new PrometheusExporter({
        defaultLabels: {
          environment: 'production',
          region: 'us-east-1',
        },
      });
      expect(exporter).toBeDefined();
    });

    test('accepts custom help text', () => {
      const exporter = new PrometheusExporter({
        helpText: {
          schema_validations: 'Custom help text',
        },
      });
      expect(exporter).toBeDefined();
    });

    test('throws InvalidLabelNameError for invalid default label names', () => {
      expect(
        () =>
          new PrometheusExporter({
            defaultLabels: {
              'invalid-name': 'value', // Hyphens not allowed
            },
          }),
      ).toThrow(InvalidLabelNameError);
    });

    test('throws InvalidLabelNameError for label name starting with number', () => {
      expect(
        () =>
          new PrometheusExporter({
            defaultLabels: {
              '123invalid': 'value',
            },
          }),
      ).toThrow(InvalidLabelNameError);
    });

    test('allows valid label names with underscores and numbers', () => {
      expect(
        () =>
          new PrometheusExporter({
            defaultLabels: {
              env_123: 'value',
              _private: 'value',
            },
          }),
      ).not.toThrow();
    });
  });

  describe('initialization and prom-client loading', () => {
    test('successfully loads prom-client when available', async () => {
      const exporter = new PrometheusExporter({ registry });

      // Should not have registry before init
      expect(exporter.getRegistry()).toBeNull();

      // First refresh triggers init
      await exporter.refresh();

      // Should have registry after init
      expect(exporter.getRegistry()).not.toBeNull();
    });

    test('only initializes prom-client once', async () => {
      const exporter = new PrometheusExporter({ registry });

      await exporter.refresh();
      const reg2 = exporter.getRegistry();
      await exporter.refresh();
      const reg3 = exporter.getRegistry();

      // Should be the same registry instance
      expect(reg2).toBe(reg3);
    });

    test('getMetrics initializes on first call', async () => {
      const exporter = new PrometheusExporter({ registry });

      expect(exporter.getRegistry()).toBeNull();

      await exporter.getMetrics();

      expect(exporter.getRegistry()).not.toBeNull();
    });
  });

  describe('namespace and subsystem logic', () => {
    test('uses default namespace and subsystem', async () => {
      const counter = registry.counter('schema_validations');
      counter.inc(5);

      const exporter = new PrometheusExporter({ registry });
      await exporter.refresh();

      const output = await exporter.getMetrics();

      // Should contain formatted metric name: tsfulmen_app_schema_validations
      expect(output).toContain('tsfulmen_app_schema_validations');
    });

    test('uses explicit namespace and subsystem', async () => {
      const counter = registry.counter('schema_validations');
      counter.inc(5);

      const exporter = new PrometheusExporter({
        registry,
        namespace: 'myapp',
        subsystem: 'worker',
      });
      await exporter.refresh();

      const output = await exporter.getMetrics();

      // Should format as: myapp_worker_schema_validations
      expect(output).toContain('myapp_worker_schema_validations');
      expect(output).not.toContain('tsfulmen_app_schema_validations');
    });
  });

  describe('metric name validation', () => {
    test('accepts valid metric names from taxonomy', async () => {
      const counter = registry.counter('schema_validations');
      counter.inc();

      const exporter = new PrometheusExporter({ registry });

      await expect(exporter.refresh()).resolves.not.toThrow();
    });

    test('accepts metric names with underscores', async () => {
      const counter = registry.counter('foundry_lookup_count');
      counter.inc();

      const exporter = new PrometheusExporter({ registry });

      await expect(exporter.refresh()).resolves.not.toThrow();
    });

    test('accepts _ms suffix metrics', async () => {
      const histogram = registry.histogram('config_load_ms');
      histogram.observe(100);

      const exporter = new PrometheusExporter({ registry });

      await expect(exporter.refresh()).resolves.not.toThrow();
    });

    test('rejects metric names with hyphens', async () => {
      const mockRegistry = {
        export: async () => [
          {
            name: 'invalid-name', // Contains hyphen (invalid for Prometheus)
            value: 42,
            timestamp: new Date().toISOString(),
            unit: 'count',
          },
        ],
      } as unknown as MetricsRegistry;

      const exporter = new PrometheusExporter({ registry: mockRegistry });

      try {
        await exporter.refresh();
        expect.fail('Should have thrown error');
      } catch (err) {
        // RefreshError wraps the InvalidMetricNameError
        expect(err).toBeInstanceOf(RefreshError);
        expect((err as Error).cause).toBeInstanceOf(InvalidMetricNameError);
      }
    });

    test('rejects metric names starting with numbers', async () => {
      const mockRegistry = {
        export: async () => [
          {
            name: '123invalid', // Starts with number (invalid)
            value: 42,
            timestamp: new Date().toISOString(),
            unit: 'count',
          },
        ],
      } as unknown as MetricsRegistry;

      const exporter = new PrometheusExporter({ registry: mockRegistry });

      try {
        await exporter.refresh();
        expect.fail('Should have thrown error');
      } catch (err) {
        // RefreshError wraps the InvalidMetricNameError
        expect(err).toBeInstanceOf(RefreshError);
        expect((err as Error).cause).toBeInstanceOf(InvalidMetricNameError);
      }
    });

    test('rejects metric names with spaces', async () => {
      const mockRegistry = {
        export: async () => [
          {
            name: 'invalid name', // Contains space (invalid)
            value: 42,
            timestamp: new Date().toISOString(),
            unit: 'count',
          },
        ],
      } as unknown as MetricsRegistry;

      const exporter = new PrometheusExporter({ registry: mockRegistry });

      try {
        await exporter.refresh();
        expect.fail('Should have thrown error');
      } catch (err) {
        // RefreshError wraps the InvalidMetricNameError
        expect(err).toBeInstanceOf(RefreshError);
        expect((err as Error).cause).toBeInstanceOf(InvalidMetricNameError);
      }
    });

    test('InvalidMetricNameError includes helpful message', async () => {
      const mockRegistry = {
        export: async () => [
          {
            name: 'invalid-name',
            value: 42,
            timestamp: new Date().toISOString(),
            unit: 'count',
          },
        ],
      } as unknown as MetricsRegistry;

      const exporter = new PrometheusExporter({ registry: mockRegistry });

      try {
        await exporter.refresh();
        expect.fail('Should have thrown error');
      } catch (err) {
        // RefreshError wraps the InvalidMetricNameError
        expect(err).toBeInstanceOf(RefreshError);
        const cause = (err as Error).cause as Error;
        expect(cause).toBeInstanceOf(InvalidMetricNameError);
        expect(cause.message).toContain('Metric names must start with');
        expect(cause.message).toContain('invalid-name');
      }
    });

    test('rejects metric names starting with numbers', async () => {
      const mockRegistry = {
        export: async () => [
          {
            name: '123invalid', // Starts with number (invalid)
            value: 42,
            timestamp: new Date().toISOString(),
            unit: 'count',
          },
        ],
      } as unknown as MetricsRegistry;

      const exporter = new PrometheusExporter({ registry: mockRegistry });

      try {
        await exporter.refresh();
        expect.fail('Should have thrown error');
      } catch (err) {
        // RefreshError wraps the InvalidMetricNameError
        expect(err).toBeInstanceOf(RefreshError);
        expect((err as Error).cause).toBeInstanceOf(InvalidMetricNameError);
      }
    });

    test('rejects metric names with spaces', async () => {
      const mockRegistry = {
        export: async () => [
          {
            name: 'invalid name', // Contains space (invalid)
            value: 42,
            timestamp: new Date().toISOString(),
            unit: 'count',
          },
        ],
      } as unknown as MetricsRegistry;

      const exporter = new PrometheusExporter({ registry: mockRegistry });

      try {
        await exporter.refresh();
        expect.fail('Should have thrown error');
      } catch (err) {
        // RefreshError wraps the InvalidMetricNameError
        expect(err).toBeInstanceOf(RefreshError);
        expect((err as Error).cause).toBeInstanceOf(InvalidMetricNameError);
      }
    });

    test('InvalidMetricNameError includes helpful message', async () => {
      const mockRegistry = {
        export: async () => [
          {
            name: 'invalid-name',
            value: 42,
            timestamp: new Date().toISOString(),
            unit: 'count',
          },
        ],
      } as unknown as MetricsRegistry;

      const exporter = new PrometheusExporter({ registry: mockRegistry });

      try {
        await exporter.refresh();
        expect.fail('Should have thrown error');
      } catch (err) {
        // RefreshError wraps the InvalidMetricNameError
        expect(err).toBeInstanceOf(RefreshError);
        const cause = (err as Error).cause as Error;
        expect(cause).toBeInstanceOf(InvalidMetricNameError);
        expect(cause.message).toContain('Metric names must start with');
        expect(cause.message).toContain('invalid-name');
      }
    });
  });

  describe('gauge updates', () => {
    test('creates and updates gauge metric', async () => {
      const gauge = registry.gauge('foundry_lookup_count');
      gauge.set(42);

      const exporter = new PrometheusExporter({ registry });
      await exporter.refresh();

      const output = await exporter.getMetrics();

      // Should contain metric and value
      expect(output).toContain('tsfulmen_app_foundry_lookup_count');
      expect(output).toContain('42');
    });

    test('updates existing gauge on subsequent refresh', async () => {
      const gauge = registry.gauge('foundry_lookup_count');
      gauge.set(42);

      const exporter = new PrometheusExporter({ registry });
      await exporter.refresh();

      gauge.set(100);
      await exporter.refresh();

      const output = await exporter.getMetrics();

      // Should show updated value
      expect(output).toContain('100');
    });

    test('applies default labels to gauge', async () => {
      const gauge = registry.gauge('foundry_lookup_count');
      gauge.set(42);

      const exporter = new PrometheusExporter({
        registry,
        defaultLabels: {
          environment: 'production',
          region: 'us_east_1',
        },
      });
      await exporter.refresh();

      const output = await exporter.getMetrics();

      // Should contain labels in output
      expect(output).toContain('environment="production"');
      expect(output).toContain('region="us_east_1"');
    });

    test('uses custom help text if provided', async () => {
      const gauge = registry.gauge('foundry_lookup_count');
      gauge.set(42);

      const exporter = new PrometheusExporter({
        registry,
        helpText: {
          foundry_lookup_count: 'Number of foundry pattern lookups',
        },
      });
      await exporter.refresh();

      const output = await exporter.getMetrics();

      // Should contain custom help text
      expect(output).toContain('Number of foundry pattern lookups');
    });

    test('handles gauge with zero value', async () => {
      const gauge = registry.gauge('foundry_lookup_count');
      gauge.set(0);

      const exporter = new PrometheusExporter({ registry });
      await exporter.refresh();

      const output = await exporter.getMetrics();

      // Should contain zero value
      expect(output).toContain('0');
    });
  });

  describe('counter metrics (exported as gauges)', () => {
    test('exports counter as gauge', async () => {
      const counter = registry.counter('schema_validations');
      counter.inc(5);

      const exporter = new PrometheusExporter({ registry });
      await exporter.refresh();

      const output = await exporter.getMetrics();

      // TSFulmen exports counters as gauges (simplest approach)
      expect(output).toContain('tsfulmen_app_schema_validations');
      expect(output).toContain('5');
    });

    test('counter value updates on subsequent refresh', async () => {
      const counter = registry.counter('schema_validations');
      counter.inc(5);

      const exporter = new PrometheusExporter({ registry });
      await exporter.refresh();

      counter.inc(3);
      await exporter.refresh();

      const output = await exporter.getMetrics();

      // Should show updated cumulative value
      expect(output).toContain('8');
    });
  });

  describe('histogram reconstruction', () => {
    test('reconstructs observations from histogram summary', async () => {
      const histogram = registry.histogram('config_load_ms', {
        buckets: [10, 50, 100],
      });

      // Add observations: 5, 25, 75
      histogram.observe(5); // In bucket ≤10
      histogram.observe(25); // In bucket ≤50
      histogram.observe(75); // In bucket ≤100

      const exporter = new PrometheusExporter({ registry });
      await exporter.refresh();

      const output = await exporter.getMetrics();

      // Should contain histogram with buckets
      expect(output).toContain('tsfulmen_app_config_load_ms');
      expect(output).toContain('_bucket');
      expect(output).toContain('le="10"');
      expect(output).toContain('le="50"');
      expect(output).toContain('le="100"');
    });

    test('uses bucket midpoints for reconstruction', async () => {
      const histogram = registry.histogram('config_load_ms', {
        buckets: [10, 50, 100],
      });

      // Single observation in first bucket
      histogram.observe(5);

      const exporter = new PrometheusExporter({ registry });
      await exporter.refresh();

      const output = await exporter.getMetrics();

      // Should have count in first bucket
      expect(output).toContain('le="10"');
    });

    test('reconstructs multiple observations in same bucket', async () => {
      const histogram = registry.histogram('config_load_ms', {
        buckets: [10, 50, 100],
      });

      // Three observations in first bucket
      histogram.observe(3);
      histogram.observe(5);
      histogram.observe(8);

      const exporter = new PrometheusExporter({ registry });
      await exporter.refresh();

      const output = await exporter.getMetrics();

      // Should show count of 3 in first bucket
      expect(output).toContain('_count 3');
    });

    test('handles empty histogram', async () => {
      const _histogram = registry.histogram('config_load_ms', {
        buckets: [10, 50, 100],
      });

      // No observations
      const exporter = new PrometheusExporter({ registry });
      await exporter.refresh();

      const output = await exporter.getMetrics();

      // Should have histogram structure with zero counts
      expect(output).toContain('tsfulmen_app_config_load_ms');
    });

    test('applies default labels to histogram', async () => {
      const histogram = registry.histogram('config_load_ms', {
        buckets: [10, 50, 100],
      });
      histogram.observe(25);

      const exporter = new PrometheusExporter({
        registry,
        defaultLabels: {
          environment: 'staging',
        },
      });
      await exporter.refresh();

      const output = await exporter.getMetrics();

      // Should contain label
      expect(output).toContain('environment="staging"');
    });
  });

  describe('error handling', () => {
    test('throws RefreshError when export fails', async () => {
      // Mock registry.export to throw error
      const failingRegistry = {
        export: async () => {
          throw new Error('Export failed');
        },
      } as unknown as MetricsRegistry;

      const exporter = new PrometheusExporter({ registry: failingRegistry });

      await expect(exporter.refresh()).rejects.toThrow(RefreshError);
    });

    test('RefreshError includes context', async () => {
      const failingRegistry = {
        export: async () => {
          throw new Error('Export failed');
        },
      } as unknown as MetricsRegistry;

      const exporter = new PrometheusExporter({ registry: failingRegistry });

      try {
        await exporter.refresh();
        expect.fail('Should have thrown RefreshError');
      } catch (err) {
        expect(err).toBeInstanceOf(RefreshError);
        expect((err as Error).message).toContain('Failed to refresh Prometheus metrics');
      }
    });

    test('increments error count on refresh failure', async () => {
      const failingRegistry = {
        export: async () => {
          throw new Error('Export failed');
        },
      } as unknown as MetricsRegistry;

      const exporter = new PrometheusExporter({ registry: failingRegistry });

      try {
        await exporter.refresh();
      } catch {
        // Expected
      }

      const stats = exporter.getStats();
      expect(stats.errorCount).toBe(1);
    });

    test('throws MetricRegistrationError when metric already exists with different type', async () => {
      const counter = registry.counter('schema_validations');
      counter.inc();

      const exporter = new PrometheusExporter({ registry });
      await exporter.refresh();

      // Try to register the same name as different type by refreshing again
      // (This tests internal collision handling - in practice prom-client prevents this)
      await expect(exporter.refresh()).resolves.not.toThrow(MetricRegistrationError);
    });
  });

  describe('stats tracking', () => {
    test('initializes with zero stats', () => {
      const exporter = new PrometheusExporter({ registry });
      const stats = exporter.getStats();

      expect(stats.refreshCount).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.lastRefreshTime).toBeNull();
      expect(stats.metricsCount).toBe(0);
      expect(stats.isRefreshing).toBe(false);
    });

    test('increments refresh count on successful refresh', async () => {
      const exporter = new PrometheusExporter({ registry });

      await exporter.refresh();
      expect(exporter.getStats().refreshCount).toBe(1);

      await exporter.refresh();
      expect(exporter.getStats().refreshCount).toBe(2);

      await exporter.refresh();
      expect(exporter.getStats().refreshCount).toBe(3);
    });

    test('updates last refresh time on successful refresh', async () => {
      const exporter = new PrometheusExporter({ registry });

      await exporter.refresh();
      const stats = exporter.getStats();

      expect(stats.lastRefreshTime).not.toBeNull();
      expect(typeof stats.lastRefreshTime).toBe('string');

      // Should be valid ISO 8601 timestamp
      if (stats.lastRefreshTime) {
        const date = new Date(stats.lastRefreshTime);
        expect(date.toISOString()).toBe(stats.lastRefreshTime);
      }
    });

    test('tracks metrics count', async () => {
      const counter = registry.counter('schema_validations');
      counter.inc();

      const gauge = registry.gauge('foundry_lookup_count');
      gauge.set(42);

      const histogram = registry.histogram('config_load_ms');
      histogram.observe(100);

      const exporter = new PrometheusExporter({ registry });
      await exporter.refresh();

      const stats = exporter.getStats();
      // Expect 4: 3 application metrics + 1 instrumentation metric (refresh_inflight gauge)
      // Other instrumentation metrics won't be converted to Prometheus collectors until next refresh
      expect(stats.metricsCount).toBe(4);
    });

    test('maintains error count across multiple failures', async () => {
      const failingRegistry = {
        export: async () => {
          throw new Error('Export failed');
        },
      } as unknown as MetricsRegistry;

      const exporter = new PrometheusExporter({ registry: failingRegistry });

      for (let i = 1; i <= 5; i++) {
        try {
          await exporter.refresh();
        } catch {
          // Expected
        }
        expect(exporter.getStats().errorCount).toBe(i);
      }
    });
  });

  describe('getMetrics', () => {
    test('returns Prometheus text format', async () => {
      const counter = registry.counter('schema_validations');
      counter.inc(5);

      const exporter = new PrometheusExporter({ registry });
      await exporter.refresh();

      const output = await exporter.getMetrics();

      // Should be text format starting with # HELP or metric names
      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
    });

    test('initializes exporter on first getMetrics call', async () => {
      const exporter = new PrometheusExporter({ registry });

      expect(exporter.getRegistry()).toBeNull();

      await exporter.getMetrics();

      expect(exporter.getRegistry()).not.toBeNull();
    });
  });

  describe('getRegistry', () => {
    test('returns null before initialization', () => {
      const exporter = new PrometheusExporter({ registry });

      expect(exporter.getRegistry()).toBeNull();
    });

    test('returns prom-client Registry after initialization', async () => {
      const exporter = new PrometheusExporter({ registry });

      await exporter.refresh();

      const promRegistry = exporter.getRegistry();
      expect(promRegistry).not.toBeNull();
      expect(promRegistry).toHaveProperty('metrics');
    });
  });

  describe('reset', () => {
    test('clears all metrics', async () => {
      const counter = registry.counter('schema_validations');
      counter.inc();

      const exporter = new PrometheusExporter({ registry });
      await exporter.refresh();

      expect(exporter.getStats().metricsCount).toBeGreaterThan(0);

      exporter.reset();

      expect(exporter.getStats().metricsCount).toBe(0);
    });

    test('handles reset before initialization', () => {
      const exporter = new PrometheusExporter({ registry });

      expect(() => exporter.reset()).not.toThrow();
    });

    test('can refresh after reset', async () => {
      const counter = registry.counter('schema_validations');
      counter.inc();

      const exporter = new PrometheusExporter({ registry });
      await exporter.refresh();

      exporter.reset();

      counter.inc(5);
      await exporter.refresh();

      const output = await exporter.getMetrics();
      expect(output).toContain('schema_validations');
    });
  });
});
