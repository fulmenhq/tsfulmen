import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MS_BUCKETS,
  getDefaultBuckets,
  getDefaultUnit,
  getMetric,
  getTaxonomy,
  isValidMetricName,
  TaxonomyLoader,
} from "../taxonomy.js";
import type { MetricName } from "../types.js";

describe("Taxonomy", () => {
  beforeEach(() => {
    TaxonomyLoader._reset();
  });

  describe("getTaxonomy", () => {
    it("loads taxonomy from YAML file", async () => {
      const taxonomy = await getTaxonomy();

      expect(taxonomy).toBeDefined();
      expect(taxonomy.version).toBeDefined();
      expect(taxonomy.metrics).toBeInstanceOf(Array);
      expect(taxonomy.defaults).toBeDefined();
    });

    it("caches loaded taxonomy", async () => {
      const taxonomy1 = await getTaxonomy();
      const taxonomy2 = await getTaxonomy();

      expect(taxonomy1).toBe(taxonomy2);
    });

    it("includes default histogram buckets", async () => {
      const taxonomy = await getTaxonomy();

      expect(taxonomy.defaults.histogram_buckets.ms_metrics).toBeDefined();
      expect(taxonomy.defaults.histogram_buckets.ms_metrics).toEqual(DEFAULT_MS_BUCKETS);
    });
  });

  describe("getMetric", () => {
    it("returns metric definition by name", async () => {
      const metric = await getMetric("schema_validations");

      expect(metric).toBeDefined();
      expect(metric?.name).toBe("schema_validations");
      expect(metric?.unit).toBeDefined();
      expect(metric?.description).toBeDefined();
    });

    it("returns undefined for unknown metric", async () => {
      const metric = await getMetric("unknown_metric" as unknown as MetricName);

      expect(metric).toBeUndefined();
    });

    it("handles _ms metric lookup", async () => {
      const metric = await getMetric("config_load_ms");

      expect(metric).toBeDefined();
      expect(metric?.name).toBe("config_load_ms");
      expect(metric?.unit).toBe("ms");
    });
  });

  describe("getDefaultUnit", () => {
    it("returns unit for known metric", async () => {
      const unit = await getDefaultUnit("schema_validations");

      expect(unit).toBeDefined();
    });

    it("returns undefined for unknown metric", async () => {
      const unit = await getDefaultUnit("unknown_metric" as unknown as MetricName);

      expect(unit).toBeUndefined();
    });

    it("returns ms for _ms metrics", async () => {
      const unit = await getDefaultUnit("config_load_ms");

      expect(unit).toBe("ms");
    });
  });

  describe("getDefaultBuckets", () => {
    it("returns ADR-0007 buckets for _ms metrics", async () => {
      const buckets = await getDefaultBuckets("config_load_ms");

      expect(buckets).toEqual(DEFAULT_MS_BUCKETS);
      expect(buckets).toEqual([1, 5, 10, 50, 100, 500, 1000, 5000, 10000]);
    });

    it("returns undefined for non-_ms metrics", async () => {
      const buckets = await getDefaultBuckets("schema_validations");

      expect(buckets).toBeUndefined();
    });

    it("handles pathfinder_find_ms", async () => {
      const buckets = await getDefaultBuckets("pathfinder_find_ms");

      expect(buckets).toEqual(DEFAULT_MS_BUCKETS);
    });

    it("handles logging_emit_latency_ms", async () => {
      const buckets = await getDefaultBuckets("logging_emit_latency_ms");

      expect(buckets).toEqual(DEFAULT_MS_BUCKETS);
    });
  });

  describe("isValidMetricName", () => {
    it("returns true for valid metric names", async () => {
      expect(await isValidMetricName("schema_validations")).toBe(true);
      expect(await isValidMetricName("config_load_ms")).toBe(true);
      expect(await isValidMetricName("foundry_lookup_count")).toBe(true);
    });

    it("returns false for invalid metric names", async () => {
      expect(await isValidMetricName("unknown_metric")).toBe(false);
      expect(await isValidMetricName("invalid")).toBe(false);
      expect(await isValidMetricName("")).toBe(false);
    });

    it("handles successful validation", async () => {
      expect(await isValidMetricName("schema_validations")).toBe(true);
    });
  });

  describe("DEFAULT_MS_BUCKETS", () => {
    it("matches ADR-0007 specification", () => {
      expect(DEFAULT_MS_BUCKETS).toEqual([1, 5, 10, 50, 100, 500, 1000, 5000, 10000]);
    });

    it("is sorted in ascending order", () => {
      const sorted = [...DEFAULT_MS_BUCKETS].sort((a, b) => a - b);
      expect(DEFAULT_MS_BUCKETS).toEqual(sorted);
    });

    it("contains exactly 9 buckets", () => {
      expect(DEFAULT_MS_BUCKETS).toHaveLength(9);
    });
  });
});
