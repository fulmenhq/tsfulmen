import { beforeEach, describe, expect, it } from "vitest";
import { MetricsRegistry } from "../registry.js";
import type { MetricsEvent } from "../types.js";

describe("MetricsRegistry", () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
  });

  describe("factory methods", () => {
    it("creates and returns counter", () => {
      const counter1 = registry.counter("schema_validations");
      const counter2 = registry.counter("schema_validations");

      expect(counter1).toBe(counter2);
    });

    it("creates and returns gauge", () => {
      const gauge1 = registry.gauge("foundry_lookup_count");
      const gauge2 = registry.gauge("foundry_lookup_count");

      expect(gauge1).toBe(gauge2);
    });

    it("creates and returns histogram", () => {
      const hist1 = registry.histogram("config_load_ms");
      const hist2 = registry.histogram("config_load_ms");

      expect(hist1).toBe(hist2);
    });
  });

  describe("export", () => {
    it("exports all metrics as events", async () => {
      const counter = registry.counter("schema_validations");
      counter.inc(5);

      const gauge = registry.gauge("foundry_lookup_count");
      gauge.set(42);

      const histogram = registry.histogram("config_load_ms");
      histogram.observe(100);

      const events = await registry.export();

      expect(events).toHaveLength(3);
      expect(events[0]).toMatchObject({
        name: "schema_validations",
        value: 5,
      });
      expect(events[1]).toMatchObject({
        name: "foundry_lookup_count",
        value: 42,
      });
      expect(events[2]).toMatchObject({
        name: "config_load_ms",
      });
      expect(events[2].value).toHaveProperty("count", 1);
      expect(events[2].value).toHaveProperty("sum", 100);
    });

    it("includes timestamp in exported events", async () => {
      const counter = registry.counter("schema_validations");
      counter.inc();

      const events = await registry.export();

      expect(events[0]).toHaveProperty("timestamp");
      expect(typeof events[0].timestamp).toBe("string");
      expect(new Date(events[0].timestamp).toISOString()).toBe(events[0].timestamp);
    });

    it("includes unit from taxonomy", async () => {
      const counter = registry.counter("schema_validations");
      counter.inc();

      const events = await registry.export();

      expect(events[0]).toHaveProperty("unit");
    });

    it("does not clear metrics on export", async () => {
      const counter = registry.counter("schema_validations");
      counter.inc(5);

      await registry.export();
      const events = await registry.export();

      expect(events[0].value).toBe(5);
    });
  });

  describe("flush", () => {
    it("exports and clears metrics", async () => {
      const counter = registry.counter("schema_validations");
      counter.inc(5);

      const events = await registry.flush();

      expect(events).toHaveLength(1);
      expect(events[0].value).toBe(5);

      const eventsAfter = await registry.export();
      expect(eventsAfter[0].value).toBe(0);
    });

    it("calls emit callback if provided", async () => {
      const counter = registry.counter("schema_validations");
      counter.inc(5);

      let emittedEvents: MetricsEvent[] = [];
      const events = await registry.flush({
        emit: (e) => {
          emittedEvents = e;
        },
      });

      expect(emittedEvents).toEqual(events);
      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].value).toBe(5);
    });

    it("clears even if emit throws", async () => {
      const counter = registry.counter("schema_validations");
      counter.inc(5);

      await expect(async () => {
        await registry.flush({
          emit: () => {
            throw new Error("emit failed");
          },
        });
      }).rejects.toThrow("emit failed");

      const events = await registry.export();
      expect(events[0].value).toBe(0);
    });
  });

  describe("clear", () => {
    it("resets all metrics to zero", async () => {
      const counter = registry.counter("schema_validations");
      counter.inc(5);

      const gauge = registry.gauge("foundry_lookup_count");
      gauge.set(42);

      const histogram = registry.histogram("config_load_ms");
      histogram.observe(100);

      registry.clear();

      const events = await registry.export();
      expect(events[0].value).toBe(0);
      expect(events[1].value).toBe(0);
      expect(events[2].value).toMatchObject({
        count: 0,
        sum: 0,
      });
    });
  });

  describe("metric tracking", () => {
    it("getMetricNames returns all registered metrics", () => {
      registry.counter("schema_validations");
      registry.gauge("foundry_lookup_count");
      registry.histogram("config_load_ms");

      const names = registry.getMetricNames();

      expect(names).toHaveLength(3);
      expect(names).toContain("schema_validations");
      expect(names).toContain("foundry_lookup_count");
      expect(names).toContain("config_load_ms");
    });

    it("getMetricCount returns total metric count", () => {
      expect(registry.getMetricCount()).toBe(0);

      registry.counter("schema_validations");
      expect(registry.getMetricCount()).toBe(1);

      registry.gauge("foundry_lookup_count");
      expect(registry.getMetricCount()).toBe(2);

      registry.histogram("config_load_ms");
      expect(registry.getMetricCount()).toBe(3);
    });

    it("handles duplicate metric type access", () => {
      registry.counter("schema_validations");
      registry.counter("schema_validations");
      registry.counter("schema_validations");

      expect(registry.getMetricCount()).toBe(1);
    });
  });
});
