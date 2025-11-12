/**
 * Taxonomy loader for metrics definitions
 *
 * Loads and caches metrics taxonomy from config/crucible-ts/taxonomy/metrics.yaml
 * Provides default histogram buckets per ADR-0007
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { MetricName, MetricUnit } from "./types.js";

/**
 * Metric definition from taxonomy
 */
export interface MetricDefinition {
  name: MetricName;
  unit: MetricUnit;
  description: string;
}

/**
 * Taxonomy structure
 */
export interface MetricsTaxonomy {
  version: string;
  defaults: {
    histogram_buckets: {
      ms_metrics: number[];
    };
  };
  metrics: MetricDefinition[];
}

/**
 * Default histogram buckets for _ms metrics (ADR-0007)
 * [1, 5, 10, 50, 100, 500, 1000, 5000, 10000] milliseconds
 */
export const DEFAULT_MS_BUCKETS = [1, 5, 10, 50, 100, 500, 1000, 5000, 10000];

/**
 * Singleton taxonomy loader
 */
class TaxonomyLoader {
  private static instance: TaxonomyLoader;
  private taxonomy: MetricsTaxonomy | null = null;
  private loadPromise: Promise<MetricsTaxonomy> | null = null;
  private loadError: Error | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TaxonomyLoader {
    if (!TaxonomyLoader.instance) {
      TaxonomyLoader.instance = new TaxonomyLoader();
    }
    return TaxonomyLoader.instance;
  }

  /**
   * Load taxonomy from YAML file
   */
  private async load(): Promise<MetricsTaxonomy> {
    if (this.taxonomy !== null) {
      return this.taxonomy;
    }

    if (this.loadError !== null) {
      throw this.loadError;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      try {
        // Resolve path to taxonomy file
        // From src/telemetry/ → ../../config/crucible-ts/taxonomy/metrics.yaml
        const taxonomyPath = join(
          __dirname,
          "..",
          "..",
          "config",
          "crucible-ts",
          "taxonomy",
          "metrics.yaml",
        );

        const content = await readFile(taxonomyPath, "utf-8");
        this.taxonomy = parseYaml(content) as MetricsTaxonomy;

        return this.taxonomy;
      } catch (err) {
        this.loadError = err instanceof Error ? err : new Error(String(err));
        throw new Error(`Failed to load metrics taxonomy: ${this.loadError.message}`);
      }
    })();

    return this.loadPromise;
  }

  /**
   * Get taxonomy (async)
   */
  async getTaxonomy(): Promise<MetricsTaxonomy> {
    return this.load();
  }

  /**
   * Get metric definition by name
   */
  async getMetric(name: MetricName): Promise<MetricDefinition | undefined> {
    const taxonomy = await this.load();
    return taxonomy.metrics.find((m) => m.name === name);
  }

  /**
   * Get default unit for metric
   */
  async getDefaultUnit(name: MetricName): Promise<MetricUnit | undefined> {
    const metric = await this.getMetric(name);
    return metric?.unit;
  }

  /**
   * Get default histogram buckets for metric
   * Returns ADR-0007 buckets for _ms metrics, undefined for others
   */
  async getDefaultBuckets(name: MetricName): Promise<number[] | undefined> {
    // Check if metric name ends with _ms
    if (name.endsWith("_ms")) {
      const taxonomy = await this.load();
      return taxonomy.defaults.histogram_buckets.ms_metrics;
    }
    return undefined;
  }

  /**
   * Check if metric name is valid (exists in taxonomy)
   */
  async isValidMetricName(name: string): Promise<boolean> {
    try {
      const taxonomy = await this.load();
      return taxonomy.metrics.some((m) => m.name === name);
    } catch {
      return false;
    }
  }

  /**
   * Reset loader state (for testing)
   * @internal
   */
  static _reset(): void {
    TaxonomyLoader.instance = new TaxonomyLoader();
  }
}

/**
 * Get metrics taxonomy
 *
 * @returns Promise resolving to taxonomy
 */
export async function getTaxonomy(): Promise<MetricsTaxonomy> {
  return TaxonomyLoader.getInstance().getTaxonomy();
}

/**
 * Get metric definition by name
 *
 * @param name - Metric name
 * @returns Promise resolving to metric definition or undefined
 */
export async function getMetric(name: MetricName): Promise<MetricDefinition | undefined> {
  return TaxonomyLoader.getInstance().getMetric(name);
}

/**
 * Get default unit for metric from taxonomy
 *
 * @param name - Metric name
 * @returns Promise resolving to unit or undefined
 */
export async function getDefaultUnit(name: MetricName): Promise<MetricUnit | undefined> {
  return TaxonomyLoader.getInstance().getDefaultUnit(name);
}

/**
 * Get default histogram buckets for metric
 *
 * Returns ADR-0007 buckets ([1, 5, 10, 50, 100, 500, 1000, 5000, 10000]) for
 * metrics ending with _ms, undefined for others.
 *
 * @param name - Metric name
 * @returns Promise resolving to bucket array or undefined
 *
 * @example
 * ```typescript
 * const buckets = await getDefaultBuckets('config_load_ms');
 * // Returns [1, 5, 10, 50, 100, 500, 1000, 5000, 10000]
 * ```
 */
export async function getDefaultBuckets(name: MetricName): Promise<number[] | undefined> {
  return TaxonomyLoader.getInstance().getDefaultBuckets(name);
}

/**
 * Check if metric name is valid (exists in taxonomy)
 *
 * @param name - Metric name to check
 * @returns Promise resolving to true if valid
 */
export async function isValidMetricName(name: string): Promise<boolean> {
  return TaxonomyLoader.getInstance().isValidMetricName(name);
}

// Export for testing
export { TaxonomyLoader };
