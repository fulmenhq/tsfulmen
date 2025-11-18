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

## HTTP Metrics Helpers

TSFulmen provides type-safe helpers for instrumenting HTTP servers with Crucible v0.2.18 metrics.

### Quick Start

```typescript
import {
  recordHttpRequest,
  trackActiveRequest,
} from "@fulmenhq/tsfulmen/telemetry/http";

// Manual instrumentation
const start = performance.now();
const release = trackActiveRequest("api-server");

try {
  await handleRequest();
  recordHttpRequest({
    method: "GET",
    route: "/users/:id", // Pre-normalized!
    status: 200,
    durationMs: performance.now() - start,
    requestBytes: 512, // Optional
    responseBytes: 2048, // Optional
  });
} finally {
  release();
}
```

### API Reference

#### `recordHttpRequest(options)`

Records all applicable HTTP metrics from Crucible v0.2.18 taxonomy:

- `http_requests_total` (counter)
- `http_request_duration_seconds` (histogram, **auto-converts ms → seconds**)
- `http_request_size_bytes` (histogram, if `requestBytes` provided)
- `http_response_size_bytes` (histogram, if `responseBytes` provided)

**Options**:

| Field           | Type   | Required | Description                                        |
| --------------- | ------ | -------- | -------------------------------------------------- |
| `method`        | string | ✅       | HTTP method (GET, POST, etc.)                      |
| `route`         | string | ✅       | **Normalized** route template (e.g., `/users/:id`) |
| `status`        | number | ✅       | HTTP status code (200, 404, etc.)                  |
| `durationMs`    | number | ✅       | Request duration in milliseconds                   |
| `requestBytes`  | number | ❌       | Request body size in bytes                         |
| `responseBytes` | number | ❌       | Response body size in bytes                        |
| `service`       | string | ❌       | Service name (defaults to AppIdentity binary_name) |

**⚠️ CRITICAL**: The `route` parameter MUST be normalized. Use `normalizeRoute()` or framework route templates.

#### `trackActiveRequest(service?)`

Increments `http_active_requests` gauge and returns a release function.

```typescript
const release = trackActiveRequest("api-server");
try {
  await handleRequest();
} finally {
  release(); // Always decrement, even on error
}
```

### Framework Integration

#### Express / Connect

Use the provided middleware for automatic instrumentation:

```typescript
import express from "express";
import { createHttpMetricsMiddleware } from "@fulmenhq/tsfulmen/telemetry/http";

const app = express();

// Basic usage
app.use(
  createHttpMetricsMiddleware({
    serviceName: "api-server",
  }),
);

// Custom configuration
app.use(
  createHttpMetricsMiddleware({
    serviceName: "api-server",
    // Use route template when available (RECOMMENDED)
    routeNormalizer: (req) => req.route?.path || normalizeRoute(req.path),
    trackBodySizes: true, // Enable request/response size tracking
  }),
);

app.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});
```

**⚠️ Express Route Notes**:

- `req.route.path` is only available when a route matched
- If no route matches (404), fallback to `req.path` or `normalizeRoute(req.path)`
- Default normalizer: `req.route?.path || req.path || "unknown"`
- **Recommendation**: Always use explicit `routeNormalizer` to avoid "unknown" routes

#### Fastify

Use the Fastify plugin:

```typescript
import Fastify from "fastify";
import { createFastifyMetricsPlugin } from "@fulmenhq/tsfulmen/telemetry/http";

const fastify = Fastify();

fastify.register(
  createFastifyMetricsPlugin({
    serviceName: "fastify-api",
    // Use route template (RECOMMENDED)
    routeNormalizer: (req) => req.routeOptions?.url || req.url,
  }),
);

fastify.get("/posts/:slug", async (request, reply) => {
  return { slug: request.params.slug };
});
```

**⚠️ Fastify Route Notes**:

- `req.routeOptions.url` contains the route template (e.g., `/posts/:slug`)
- Available in Fastify v3+ when route is matched
- If no route matches, fallback to `req.url` or `normalizeRoute(req.url)`
- Default normalizer: `req.routeOptions?.url || req.url || "unknown"`
- **Recommendation**: Always normalize fallback with `normalizeRoute(req.url)`

#### Bun.serve

Wrap your fetch handler:

```typescript
import {
  createBunMetricsHandler,
  normalizeRoute,
} from "@fulmenhq/tsfulmen/telemetry/http";

Bun.serve({
  fetch: createBunMetricsHandler(
    async (req) => {
      const url = new URL(req.url);
      // Your handler logic
      return new Response("Hello World");
    },
    {
      serviceName: "bun-api",
      routeNormalizer: (req) => normalizeRoute(new URL(req.url).pathname),
    },
  ),
});
```

**⚠️ Bun Route Notes**:

- No built-in routing, must normalize manually
- **Always use** `normalizeRoute()` for pathname
- Default normalizer: `new URL(req.url).pathname` (NOT normalized - high cardinality risk!)

#### Node.js HTTP

Manual instrumentation with Node.js HTTP server:

```typescript
import http from "node:http";
import {
  recordHttpRequest,
  trackActiveRequest,
  normalizeRoute,
} from "@fulmenhq/tsfulmen/telemetry/http";

const server = http.createServer((req, res) => {
  const start = performance.now();
  const release = trackActiveRequest("http-server");

  res.on("finish", () => {
    recordHttpRequest({
      method: req.method || "UNKNOWN",
      route: normalizeRoute(req.url?.split("?")[0] || "/"), // Normalize!
      status: res.statusCode,
      durationMs: performance.now() - start,
    });
    release();
  });

  // Your handler logic
  res.writeHead(200);
  res.end("OK");
});
```

### Middleware Options Reference

All middleware factories accept these options:

```typescript
interface MiddlewareOptions {
  serviceName?: string; // Service name (defaults to AppIdentity)
  routeNormalizer?: (req) => string; // Custom route extractor
  methodExtractor?: (req) => string; // Custom method extractor (default: req.method)
  statusExtractor?: (res) => number; // Custom status extractor (default: res.statusCode)
  trackBodySizes?: boolean; // Enable body size tracking (default: false)
}
```

**⚠️ Body Size Tracking**:

- Disabled by default for performance
- When enabled, reads `content-length` headers
- If `trackBodySizes: false`, size histograms **will not emit** labeled events
- Only enable if you need `http_request_size_bytes` and `http_response_size_bytes` metrics

## Troubleshooting

### High Cardinality Warning

**Symptom**: Prometheus running out of memory, slow queries, "too many time series" errors

**Cause**: Recording metrics with non-normalized routes

```typescript
// ❌ WRONG - Each user creates unique series
recordHttpRequest({
  route: "/users/123", // Should be /users/:userId
  // ...
});
```

**Solution**: Always normalize routes

```typescript
// ✅ CORRECT
import { normalizeRoute } from "@fulmenhq/tsfulmen/telemetry/http";

recordHttpRequest({
  route: normalizeRoute(req.path), // or req.route?.path
  // ...
});
```

### "unknown" Routes in Metrics

**Symptom**: Seeing `route="unknown"` in Prometheus

**Cause**: Middleware fallback when route normalization fails

**Common Scenarios**:

1. **Express**: No route matched (404), and `req.path` is undefined
2. **Fastify**: No route matched, and `req.url` fallback not normalized
3. **Bun**: Pathname extraction failed

**Solution**: Provide explicit `routeNormalizer`

```typescript
// Express
createHttpMetricsMiddleware({
  routeNormalizer: (req) => {
    if (req.route?.path) return req.route.path; // Matched route
    if (req.path) return normalizeRoute(req.path); // Normalize path
    return "/404"; // Explicit 404 route
  },
});
```

### Missing Size Metrics

**Symptom**: `http_request_size_bytes` and `http_response_size_bytes` not appearing in metrics

**Cause**: Body size tracking not enabled

**Solution**: Enable `trackBodySizes` option

```typescript
createHttpMetricsMiddleware({
  trackBodySizes: true, // ← Enable this
});
```

**Note**: Size metrics are only recorded when:

1. `trackBodySizes: true` AND
2. Request has `content-length` header OR response sets `content-length`

### Unit Conversion Issues

**Symptom**: Duration metrics 1000x too large in Prometheus

**Cause**: Not using `recordHttpRequest()` (which auto-converts ms → seconds)

```typescript
// ❌ WRONG - Recording milliseconds directly
metrics.histogram("http_request_duration_seconds").observe(150); // Wrong!
```

**Solution**: Use `recordHttpRequest()` helper

```typescript
// ✅ CORRECT - Auto-converts 150ms → 0.150s
recordHttpRequest({
  durationMs: 150, // Milliseconds
  // ... helper converts to seconds automatically
});
```

### Service Label Missing

**Symptom**: Metrics missing `service` label or showing `service="unknown"`

**Cause**: AppIdentity not loaded and `serviceName` not provided

**Solution**: Provide explicit `serviceName`

```typescript
createHttpMetricsMiddleware({
  serviceName: "my-api", // ← Explicit service name
});
```

Or ensure AppIdentity is loaded:

```typescript
import { loadIdentity } from "@fulmenhq/tsfulmen/appidentity";

await loadIdentity(); // Load before starting server
```

### Fastify Version Compatibility

**Symptom**: `req.routeOptions` is undefined

**Cause**: Using older Fastify version or accessing before route matching

**Solution**: Defensive access with fallback

```typescript
createFastifyMetricsPlugin({
  routeNormalizer: (req) => {
    // Fastify v3+: req.routeOptions.url
    // Fallback: normalize req.url
    return req.routeOptions?.url || normalizeRoute(req.url);
  },
});
```

## Production Recommendations

### 1. Always Normalize Routes

```typescript
// ✅ Best practice
const route = req.route?.path || normalizeRoute(req.path);
```

### 2. Monitor Cardinality

Set up alerts for high cardinality:

```promql
# Alert if unique routes > 1000
count(count by (route) (http_requests_total)) > 1000
```

### 3. Use Service Names

Always set explicit service names for multi-service deployments:

```typescript
createHttpMetricsMiddleware({
  serviceName: "user-api", // Distinguish services
});
```

### 4. Enable Body Sizes Selectively

Only enable for critical routes to minimize overhead:

```typescript
app.use(
  "/api/upload",
  createHttpMetricsMiddleware({
    trackBodySizes: true, // Only for upload routes
  }),
);
```

### 5. Test Route Normalization

Validate normalization in tests:

```typescript
import {
  normalizeRoute,
  hasCardinalityRisk,
} from "@fulmenhq/tsfulmen/telemetry/http";

test("routes are normalized", () => {
  const route = normalizeRoute("/users/123");
  expect(route).toBe("/users/:userId");
  expect(hasCardinalityRisk(route)).toBe(false);
});
```

---

**Phase 2 Deliverable**: Route normalization utilities for cardinality-safe HTTP metrics
**Phase 3 Deliverable**: HTTP metrics helpers with automatic instrumentation
**Phase 4 Deliverable**: Comprehensive documentation and framework examples
