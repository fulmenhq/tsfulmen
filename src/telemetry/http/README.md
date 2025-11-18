# HTTP Metrics for TSFulmen

TypeScript helpers for instrumenting HTTP servers with Crucible v0.2.18 HTTP metrics.

## ⚠️ Critical: Cardinality Risk

**High cardinality routes will overwhelm Prometheus and break monitoring.**

### The Problem

Recording metrics with actual path values creates unbounded cardinality:

```typescript
// ❌ WRONG - Creates millions of unique metric series
recordMetric("http_requests_total", {
  route: "/users/123", // Unique for every user!
  route: "/orders/abc-def", // Unique for every order!
});
```

**Impact**: Each unique route creates a new time series in Prometheus. With 1M users, you'd have 1M series just for `/users/:id` routes, overwhelming your monitoring system.

### The Solution

**Always normalize routes to templates** before recording metrics:

```typescript
// ✅ CORRECT - Bounded cardinality
recordMetric("http_requests_total", {
  route: "/users/:userId", // Same for all users
  route: "/orders/:orderId", // Same for all orders
});
```

## Route Normalization

The `normalizeRoute()` function converts actual paths to templates automatically:

```typescript
import { normalizeRoute } from "@fulmenhq/tsfulmen/telemetry/http";

normalizeRoute("/users/123"); // "/users/:userId"
normalizeRoute("/posts/my-article-title"); // "/posts/:slug"
normalizeRoute("/api/v1/orders/abc/items/xyz"); // "/api/v1/orders/:id/items/:id"
```

### Supported ID Patterns

| Pattern            | Example                | Normalized       | Notes                      |
| ------------------ | ---------------------- | ---------------- | -------------------------- |
| Numeric            | `/users/123`           | `/users/:userId` | Context-aware placeholders |
| UUID               | `/orders/550e8400-...` | `/orders/:id`    | UUID v4 format             |
| MongoDB ObjectId   | `/docs/507f1f77bcf...` | `/docs/:id`      | 24-char hex                |
| Slug               | `/posts/my-article`    | `/posts/:slug`   | Hyphenated strings         |
| Nanoid/CUID        | `/items/cjld2cjxh...`  | `/items/:id`     | 20-30 char IDs             |
| Base64             | `/auth/YWJjZGVm...`    | `/auth/:token`   | 16+ char encoded           |
| Short alphanumeric | `/items/abc123`        | `/items/:itemId` | 3-12 mixed chars           |

### Context-Aware Placeholders

The normalizer infers meaningful placeholder names from context:

```typescript
normalizeRoute("/users/123"); // "/users/:userId" (not :id)
normalizeRoute("/posts/456"); // "/posts/:postId"
normalizeRoute("/orders/789"); // "/orders/:orderId"
normalizeRoute("/items/abc"); // "/items/:itemId"
normalizeRoute("/products/xyz"); // "/products/:itemId"
```

### Static Segment Detection

Common API terms are never normalized:

```typescript
normalizeRoute("/users/settings"); // "/users/settings" (not :id)
normalizeRoute("/api/v1/health"); // "/api/v1/health"
normalizeRoute("/users/123/notifications"); // "/users/:userId/notifications"
```

## Cardinality Risk Detection

Check if a route needs normalization:

```typescript
import { hasCardinalityRisk } from "@fulmenhq/tsfulmen/telemetry/http";

hasCardinalityRisk("/users/123"); // true - needs normalization!
hasCardinalityRisk("/users/:userId"); // false - already normalized
hasCardinalityRisk("/api/health"); // false - static route
```

## Best Practices

### 1. Normalize Before Recording

```typescript
import { normalizeRoute } from "@fulmenhq/tsfulmen/telemetry/http";

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const route = normalizeRoute(req.path); // ← Normalize here!
    recordHttpRequest({
      method: req.method,
      route: route, // Use normalized route
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
});
```

### 2. Use Framework Route Templates

Most frameworks provide route templates - use them directly:

```typescript
// Express
app.get("/users/:id", (req, res) => {
  const route = req.route.path; // Already "/users/:id"
  // Record metrics with route template
});

// Fastify
fastify.get("/posts/:slug", (req, reply) => {
  const route = req.routerPath; // Already "/posts/:slug"
});
```

### 3. Manual Normalization for Edge Cases

```typescript
import { normalizeRoute } from "@fulmenhq/tsfulmen/telemetry/http";

// Complex nested routes
const route = normalizeRoute("/api/v2/users/123/orders/abc/items/xyz");
// → "/api/v2/users/:userId/orders/:orderId/items/:itemId"

// With explicit template
const route = normalizeRoute("/complex/path/123", {
  template: "/complex/path/:id",
});

// With custom segment replacements
const route = normalizeRoute("/api/custom/foo/bar/baz", {
  segmentReplacements: {
    2: "customId", // Index 2 → :customId
    3: "resourceType",
  },
});
```

### 4. Monitor Cardinality

```typescript
import { estimateCardinality } from "@fulmenhq/tsfulmen/telemetry/http";

const cardinality = estimateCardinality("/users/:userId/posts/:postId");
// Returns: 1,000,000 (1000 users × 1000 posts per user)

if (cardinality > 10000) {
  console.warn(`High cardinality route: ${route} (estimated: ${cardinality})`);
}
```

## Common Mistakes

### ❌ DON'T: Use Raw Paths

```typescript
// WRONG - Creates unbounded cardinality
recordMetric("http_requests_total", {
  route: req.url, // "/users/123?page=2"
});
```

### ❌ DON'T: Normalize After Recording

```typescript
// WRONG - Metric already recorded with bad route
recordMetric("http_requests_total", {
  route: "/users/123", // Cardinality explosion!
});
const normalized = normalizeRoute("/users/123"); // Too late!
```

### ❌ DON'T: Over-Normalize

```typescript
// WRONG - Loses useful information
const route = "/api/v1/users/:id"; // Good
const route = "/api/*"; // Too generic!
```

### ✅ DO: Normalize Early

```typescript
// CORRECT - Normalize before recording
const route = normalizeRoute(req.path);
recordMetric("http_requests_total", { route });
```

### ✅ DO: Use Framework Templates

```typescript
// CORRECT - Use provided templates
const route = req.route?.path || normalizeRoute(req.path);
```

### ✅ DO: Preserve Static Segments

```typescript
// CORRECT - Static segments preserved
normalizeRoute("/api/v1/users/123"); // "/api/v1/users/:userId"
```

## Performance

Route normalization is optimized for request-path usage:

- **Simple routes**: <0.001ms average (tested with 1000 iterations)
- **Complex nested routes**: <0.001ms average
- **Batch processing**: <0.5ms per route for 100 routes

Safe to use in hot paths without performance impact.

## Label Requirements (from Crucible)

Each HTTP metric has specific required labels:

| Metric                          | Required Labels                |
| ------------------------------- | ------------------------------ |
| `http_requests_total`           | method, route, status, service |
| `http_request_duration_seconds` | method, route, status, service |
| `http_request_size_bytes`       | method, route, service         |
| `http_response_size_bytes`      | method, route, status, service |
| `http_active_requests`          | service                        |

**CRITICAL**: `route` label MUST be normalized to prevent cardinality explosion.

## Examples

See Phase 3 implementation for complete HTTP metrics helpers with automatic normalization.

---

**Phase 2 Deliverable**: Route normalization utilities for cardinality-safe HTTP metrics
