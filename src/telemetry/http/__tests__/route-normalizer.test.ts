import { describe, expect, it } from "vitest";
import {
  estimateCardinality,
  hasCardinalityRisk,
  normalizeRoute,
  normalizeRoutes,
} from "../route-normalizer.js";

describe("Route Normalizer", () => {
  describe("normalizeRoute - Basic ID Patterns", () => {
    it("normalizes numeric IDs with context-aware placeholders", () => {
      expect(normalizeRoute("/users/123")).toBe("/users/:userId");
      expect(normalizeRoute("/posts/456789")).toBe("/posts/:postId");
      expect(normalizeRoute("/items/0")).toBe("/items/:itemId");
    });

    it("normalizes UUIDs", () => {
      expect(normalizeRoute("/users/550e8400-e29b-41d4-a716-446655440000")).toBe("/users/:id");
      expect(normalizeRoute("/orders/f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe("/orders/:id");
    });

    it("normalizes MongoDB ObjectIds", () => {
      expect(normalizeRoute("/posts/507f1f77bcf86cd799439011")).toBe("/posts/:id");
      expect(normalizeRoute("/docs/6123456789abcdef01234567")).toBe("/docs/:id");
    });

    it("normalizes slugs", () => {
      expect(normalizeRoute("/blog/my-article-title")).toBe("/blog/:slug");
      expect(normalizeRoute("/wiki/how-to-use-metrics")).toBe("/wiki/:slug");
      expect(normalizeRoute("/guides/getting-started-2024")).toBe("/guides/:slug");
    });

    it("normalizes nanoid/CUID identifiers", () => {
      expect(normalizeRoute("/items/cjld2cjxh0000qzrmn831i7rn")).toBe("/items/:id");
      expect(normalizeRoute("/users/v1StGXR8_Z5jdHi6B-myT")).toBe("/users/:id");
    });

    it("normalizes base64-like tokens", () => {
      expect(normalizeRoute("/auth/YWJjZGVmZ2hpamtsbW5v")).toBe("/auth/:token");
      expect(normalizeRoute("/verify/dGVzdC1kYXRhLWxvbmdlcg")).toBe("/verify/:token");
    });
  });

  describe("normalizeRoute - Context-Aware Placeholders", () => {
    it("uses userId for user-related paths", () => {
      expect(normalizeRoute("/users/123")).toBe("/users/:userId");
      expect(normalizeRoute("/accounts/456")).toBe("/accounts/:userId");
      expect(normalizeRoute("/profiles/789")).toBe("/profiles/:userId");
    });

    it("uses postId for post-related paths", () => {
      expect(normalizeRoute("/posts/123")).toBe("/posts/:postId");
      expect(normalizeRoute("/articles/456")).toBe("/articles/:postId");
    });

    it("uses orderId for order-related paths", () => {
      expect(normalizeRoute("/orders/789")).toBe("/orders/:orderId");
    });

    it("uses itemId for item/product paths", () => {
      expect(normalizeRoute("/items/111")).toBe("/items/:itemId");
      expect(normalizeRoute("/products/222")).toBe("/products/:itemId");
    });
  });

  describe("normalizeRoute - Multiple Parameters", () => {
    it("normalizes multiple IDs in single path", () => {
      expect(normalizeRoute("/users/123/posts/456")).toBe("/users/:userId/posts/:postId");
      expect(normalizeRoute("/orders/abc123/items/xyz456")).toBe("/orders/:orderId/items/:itemId");
    });

    it("normalizes complex nested paths", () => {
      expect(normalizeRoute("/api/v1/users/123/orders/456/items/789")).toBe(
        "/api/v1/users/:userId/orders/:orderId/items/:itemId",
      );
    });

    it("preserves static segments between dynamic ones", () => {
      expect(normalizeRoute("/users/123/settings/notifications")).toBe(
        "/users/:userId/settings/notifications",
      );
      expect(normalizeRoute("/api/v2/products/abc123/reviews/xyz456")).toBe(
        "/api/v2/products/:itemId/reviews/:id",
      );
    });
  });

  describe("normalizeRoute - Edge Cases", () => {
    it("handles root path", () => {
      expect(normalizeRoute("/")).toBe("/");
      expect(normalizeRoute("")).toBe("/");
    });

    it("handles paths without dynamic segments", () => {
      expect(normalizeRoute("/api/health")).toBe("/api/health");
      expect(normalizeRoute("/metrics")).toBe("/metrics");
      expect(normalizeRoute("/api/v1/status")).toBe("/api/v1/status");
    });

    it("strips trailing slashes by default", () => {
      expect(normalizeRoute("/users/123/")).toBe("/users/:userId");
      expect(normalizeRoute("/api/status/")).toBe("/api/status");
    });

    it("preserves trailing slashes when requested", () => {
      expect(normalizeRoute("/users/123/", { preserveTrailingSlash: true })).toBe(
        "/users/:userId/",
      );
      expect(normalizeRoute("/api/status/", { preserveTrailingSlash: true })).toBe("/api/status/");
    });

    it("strips query parameters", () => {
      expect(normalizeRoute("/users/123?page=2&limit=10")).toBe("/users/:userId");
      expect(normalizeRoute("/search?q=test")).toBe("/search");
    });

    it("strips URL fragments", () => {
      expect(normalizeRoute("/docs/guide#section-1")).toBe("/docs/guide");
      expect(normalizeRoute("/users/123#profile")).toBe("/users/:userId");
    });

    it("handles both query params and fragments", () => {
      expect(normalizeRoute("/users/123?tab=posts#recent")).toBe("/users/:userId");
    });

    it("handles already-normalized routes", () => {
      expect(normalizeRoute("/users/:id")).toBe("/users/:id");
      expect(normalizeRoute("/api/v1/items/:itemId")).toBe("/api/v1/items/:itemId");
      expect(normalizeRoute("/files/*")).toBe("/files/*");
    });
  });

  describe("normalizeRoute - Explicit Template", () => {
    it("uses provided template exactly", () => {
      expect(normalizeRoute("/users/123", { template: "/users/:userId" })).toBe("/users/:userId");
      expect(
        normalizeRoute("/complex/path/123/456", {
          template: "/complex/path/:id/:otherId",
        }),
      ).toBe("/complex/path/:id/:otherId");
    });

    it("ignores auto-detection when template provided", () => {
      expect(normalizeRoute("/orders/abc-def-ghi", { template: "/orders/:slug" })).toBe(
        "/orders/:slug",
      );
    });
  });

  describe("normalizeRoute - Context-Aware Toggle", () => {
    it("uses context-aware placeholders by default", () => {
      expect(normalizeRoute("/users/123")).toBe("/users/:userId");
      expect(normalizeRoute("/posts/456")).toBe("/posts/:postId");
      expect(normalizeRoute("/orders/abc123")).toBe("/orders/:orderId");
    });

    it("uses generic :id when context-aware disabled", () => {
      expect(normalizeRoute("/users/123", { useContextAwarePlaceholders: false })).toBe(
        "/users/:id",
      );
      expect(normalizeRoute("/posts/456", { useContextAwarePlaceholders: false })).toBe(
        "/posts/:id",
      );
      expect(
        normalizeRoute("/orders/abc123", {
          useContextAwarePlaceholders: false,
        }),
      ).toBe("/orders/:id");
    });

    it("still detects special types even when context-aware disabled", () => {
      // UUIDs, slugs, etc. keep their specific types
      expect(
        normalizeRoute("/posts/my-article-slug", {
          useContextAwarePlaceholders: false,
        }),
      ).toBe("/posts/:slug");
      expect(
        normalizeRoute("/auth/YWJjZGVmZ2hpamtsbW5v", {
          useContextAwarePlaceholders: false,
        }),
      ).toBe("/auth/:token");
    });
  });

  describe("normalizeRoute - Segment Replacements", () => {
    it("replaces specific segments by index", () => {
      expect(
        normalizeRoute("/api/v1/users/123/items/456", {
          segmentReplacements: { 3: "userId", 5: "itemId" },
        }),
      ).toBe("/api/v1/users/:userId/items/:itemId");
    });

    it("combines segment replacements with auto-detection", () => {
      // Segment 2 explicit, others auto-detected
      expect(
        normalizeRoute("/api/custom/789/items/abc123", {
          segmentReplacements: { 2: "customId" },
        }),
      ).toBe("/api/custom/:customId/items/:itemId");
    });
  });

  describe("normalizeRoutes - Batch Processing", () => {
    it("normalizes multiple routes at once", () => {
      const paths = ["/users/123", "/posts/456", "/orders/789"];
      const normalized = normalizeRoutes(paths);

      expect(normalized).toEqual(["/users/:userId", "/posts/:postId", "/orders/:orderId"]);
    });

    it("applies consistent options to all routes", () => {
      const paths = ["/users/123/", "/posts/456/"];
      const normalized = normalizeRoutes(paths, {
        preserveTrailingSlash: true,
      });

      expect(normalized).toEqual(["/users/:userId/", "/posts/:postId/"]);
    });
  });

  describe("hasCardinalityRisk", () => {
    it("detects unnormalized dynamic segments", () => {
      expect(hasCardinalityRisk("/users/123")).toBe(true);
      expect(hasCardinalityRisk("/orders/550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(hasCardinalityRisk("/articles/my-slug-here")).toBe(true);
    });

    it("returns false for normalized routes", () => {
      expect(hasCardinalityRisk("/users/:id")).toBe(false);
      expect(hasCardinalityRisk("/api/v1/items/:itemId")).toBe(false);
      expect(hasCardinalityRisk("/files/*")).toBe(false);
    });

    it("returns false for static routes", () => {
      expect(hasCardinalityRisk("/api/health")).toBe(false);
      expect(hasCardinalityRisk("/metrics")).toBe(false);
      expect(hasCardinalityRisk("/")).toBe(false);
    });

    it("handles mixed normalized and unnormalized", () => {
      expect(hasCardinalityRisk("/users/:userId/posts/123")).toBe(true);
      expect(hasCardinalityRisk("/api/v1/items/abc123")).toBe(true);
    });
  });

  describe("estimateCardinality", () => {
    it("returns 1 for static routes", () => {
      expect(estimateCardinality("/api/health")).toBe(1);
      expect(estimateCardinality("/metrics")).toBe(1);
      expect(estimateCardinality("/")).toBe(1);
    });

    it("estimates high cardinality for parametric routes", () => {
      expect(estimateCardinality("/users/:id")).toBe(1000);
      expect(estimateCardinality("/users/:userId/posts/:postId")).toBe(1_000_000);
    });

    it("estimates very high cardinality for wildcards", () => {
      expect(estimateCardinality("/files/*")).toBe(100);
      expect(estimateCardinality("/api/*/users/:id")).toBe(100_000);
    });

    it("handles mixed static and dynamic segments", () => {
      expect(estimateCardinality("/api/v1/users/:userId")).toBe(1000);
      expect(estimateCardinality("/static/path/to/resource")).toBe(1);
    });
  });

  describe("Performance", () => {
    it("normalizes simple routes in <1ms", () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        normalizeRoute("/users/123");
      }
      const duration = performance.now() - start;
      const avgDuration = duration / 1000;

      expect(avgDuration).toBeLessThan(1);
    });

    it("normalizes complex routes in <1ms", () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        normalizeRoute("/api/v1/users/123/orders/456/items/789");
      }
      const duration = performance.now() - start;
      const avgDuration = duration / 1000;

      expect(avgDuration).toBeLessThan(1);
    });

    it("batch processes efficiently", () => {
      const paths = Array.from({ length: 100 }, (_, i) => `/users/${i}`);

      const start = performance.now();
      normalizeRoutes(paths);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50); // <0.5ms per route
    });
  });
});
