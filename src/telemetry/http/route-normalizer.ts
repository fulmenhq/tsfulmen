/**
 * Route normalization utilities for HTTP metrics
 *
 * Prevents cardinality explosion by converting actual paths to templated routes.
 * Example: /users/123 → /users/:id
 *
 * CRITICAL: High cardinality routes will overwhelm Prometheus and break monitoring.
 * Always normalize routes before recording HTTP metrics.
 */

/**
 * Route normalization options
 */
export interface NormalizeOptions {
  /**
   * Optional explicit template to use instead of auto-detection
   * Example: "/api/v1/orders/:orderId/items/:itemId"
   */
  template?: string;

  /**
   * Whether to preserve trailing slashes (default: false, strips them)
   */
  preserveTrailingSlash?: boolean;

  /**
   * Custom segment replacements (segment index → placeholder name)
   * Example: { 2: "userId", 4: "itemId" } for /api/v1/users/:userId/items/:itemId
   */
  segmentReplacements?: Record<number, string>;

  /**
   * Use context-aware placeholder names (default: true)
   * When true: /users/123 → /users/:userId
   * When false: /users/123 → /users/:id
   */
  useContextAwarePlaceholders?: boolean;
}

/**
 * Common static route segments that should never be normalized
 * (API resources, actions, settings pages, etc.)
 */
const STATIC_SEGMENTS = new Set([
  // Common API resources/collections
  "api",
  "users",
  "posts",
  "articles",
  "items",
  "products",
  "orders",
  "accounts",
  "profiles",
  "comments",
  "reviews",
  "files",
  "docs",
  "auth",
  "admin",
  "settings",
  "config",
  "metrics",
  "health",
  "status",
  "search",
  "upload",
  "download",
  // Common actions
  "create",
  "update",
  "delete",
  "list",
  "show",
  "edit",
  "new",
  // Common settings/config sections
  "notifications",
  "preferences",
  "billing",
  "security",
  "privacy",
  "profile",
  "account",
  "dashboard",
  // API versioning
  "v1",
  "v2",
  "v3",
  "v4",
  // Content sections
  "blog",
  "wiki",
  "guides",
  "guide",
  "help",
  "faq",
  "about",
  "contact",
  "terms",
  "custom",
  "verify",
]);

/**
 * Pattern matchers for common ID formats
 */
const ID_PATTERNS = {
  /** UUID v4: 550e8400-e29b-41d4-a716-446655440000 */
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,

  /** Numeric ID: 123, 456789 */
  numeric: /^\d+$/,

  /** MongoDB ObjectId: 507f1f77bcf86cd799439011 */
  objectId: /^[0-9a-f]{24}$/i,

  /** Nanoid/CUID: cjld2cjxh0000qzrmn831i7rn */
  nanoid: /^[0-9a-z_-]{20,30}$/i,

  /** Alphanumeric slug with hyphens: my-article-title, user-profile-2024 */
  slug: /^[a-z0-9]+(-[a-z0-9]+)+$/i,

  /** Base64-like (16+ chars, mixed case OR padding): YWJjZGVmZ2hpamtsbW5v or dGVzdA== */
  base64: /^(?=.*[A-Z])(?=.*[a-z])[A-Za-z0-9+/]{16,}={0,2}$|^[A-Za-z0-9+/]{16,}={1,2}$/,

  /** Short alphanumeric IDs with mixed chars: abc123, xyz789 (must contain both letters AND numbers) */
  shortId: /^(?=.*[a-z])(?=.*[0-9])[a-z0-9]{3,12}$/i,
};

/**
 * Detect if a path segment looks like a dynamic parameter
 */
function isDynamicSegment(segment: string): boolean {
  // Already a parameter placeholder
  if (segment.startsWith(":") || segment === "*") {
    return true;
  }

  // Empty segment
  if (!segment) {
    return false;
  }

  // Check if it's a known static segment
  if (STATIC_SEGMENTS.has(segment.toLowerCase())) {
    return false;
  }

  // Check against known ID patterns
  // Order matters: check more specific patterns first
  return (
    ID_PATTERNS.uuid.test(segment) ||
    ID_PATTERNS.numeric.test(segment) ||
    ID_PATTERNS.objectId.test(segment) ||
    ID_PATTERNS.slug.test(segment) ||
    ID_PATTERNS.base64.test(segment) || // Check before nanoid (more specific)
    ID_PATTERNS.nanoid.test(segment) ||
    ID_PATTERNS.shortId.test(segment) // Check last (most permissive)
  );
}

/**
 * Infer placeholder name from context
 */
function inferPlaceholderName(
  segment: string,
  index: number,
  segments: string[],
  useContextAware = true,
): string {
  // UUID → :id
  if (ID_PATTERNS.uuid.test(segment)) {
    return "id";
  }

  // MongoDB ObjectId → :id
  if (ID_PATTERNS.objectId.test(segment)) {
    return "id";
  }

  // Numeric → :id (context-aware if enabled)
  if (ID_PATTERNS.numeric.test(segment)) {
    if (!useContextAware) {
      return "id";
    }
    // Look at previous segment for context
    const prev = segments[index - 1]?.toLowerCase();
    if (prev === "users" || prev === "accounts" || prev === "profiles") {
      return "userId";
    }
    if (prev === "posts" || prev === "articles") {
      return "postId";
    }
    if (prev === "orders") {
      return "orderId";
    }
    if (prev === "items" || prev === "products") {
      return "itemId";
    }
    return "id";
  }

  // Slug pattern → :slug
  if (ID_PATTERNS.slug.test(segment)) {
    return "slug";
  }

  // Base64 → :token (check BEFORE nanoid which is less specific)
  if (ID_PATTERNS.base64.test(segment)) {
    return "token";
  }

  // Nanoid/CUID → :id
  if (ID_PATTERNS.nanoid.test(segment)) {
    return "id";
  }

  // Short alphanumeric ID → context-aware or :id
  // Note: Check this AFTER base64 since base64 also has letters+numbers
  if (ID_PATTERNS.shortId.test(segment)) {
    if (!useContextAware) {
      return "id";
    }
    // Check previous segment for context
    const prev = segments[index - 1]?.toLowerCase();
    if (prev === "orders") {
      return "orderId";
    }
    if (prev === "items" || prev === "products") {
      return "itemId";
    }
    if (prev === "reviews") {
      return "id";
    }
    return "id";
  }

  // Already-normalized placeholder - preserve the name
  if (segment.startsWith(":")) {
    return segment.slice(1); // Remove the : prefix
  }

  // Wildcard - preserve as-is
  if (segment === "*") {
    return "*";
  }

  // Fallback for unknown dynamic segments
  return "param";
}

/**
 * Normalize an HTTP route path to prevent cardinality explosion
 *
 * Converts actual paths with IDs/slugs to templated routes:
 * - /users/123 → /users/:id
 * - /api/v1/orders/abc-123/items/456 → /api/v1/orders/:orderId/items/:itemId
 * - /articles/my-article-title → /articles/:slug
 *
 * @param path - The actual request path
 * @param options - Normalization options
 * @returns Normalized route template
 *
 * @example
 * ```typescript
 * normalizeRoute('/users/123'); // '/users/:id'
 * normalizeRoute('/api/v1/orders/abc/items/456'); // '/api/v1/orders/:id/items/:id'
 * normalizeRoute('/posts/my-title', { template: '/posts/:slug' }); // '/posts/:slug'
 * ```
 */
export function normalizeRoute(path: string, options: NormalizeOptions = {}): string {
  // Use explicit template if provided
  if (options.template) {
    return options.template;
  }

  // Handle empty or root
  if (!path || path === "/") {
    return "/";
  }

  // Strip query params and fragments
  let cleanPath = path.split("?")[0].split("#")[0];

  // Track if path had trailing slash
  const hadTrailingSlash = cleanPath.endsWith("/") && cleanPath !== "/";

  // Strip trailing slash for processing
  if (cleanPath.endsWith("/") && cleanPath !== "/") {
    cleanPath = cleanPath.slice(0, -1);
  }

  // Split into segments
  const segments = cleanPath.split("/").filter(Boolean);

  // Process each segment
  const normalized = segments.map((segment, index) => {
    // Check for explicit segment replacement
    if (options.segmentReplacements?.[index]) {
      return `:${options.segmentReplacements[index]}`;
    }

    // Keep wildcards as-is
    if (segment === "*") {
      return "*";
    }

    // Check if segment is dynamic
    if (isDynamicSegment(segment)) {
      const placeholder = inferPlaceholderName(
        segment,
        index,
        segments,
        options.useContextAwarePlaceholders ?? true,
      );
      // Don't re-wrap if already a placeholder
      return placeholder === "*" ? "*" : `:${placeholder}`;
    }

    // Keep static segment as-is
    return segment;
  });

  // Reconstruct path
  let result = `/${normalized.join("/")}`;

  // Re-add trailing slash if requested and original had one
  if (options.preserveTrailingSlash && hadTrailingSlash) {
    result += "/";
  }

  return result;
}

/**
 * Batch normalize multiple routes
 */
export function normalizeRoutes(paths: string[], options: NormalizeOptions = {}): string[] {
  return paths.map((path) => normalizeRoute(path, options));
}

/**
 * Check if a route has high cardinality risk
 *
 * Returns true if the route contains segments that look like dynamic values
 * but haven't been normalized yet.
 */
export function hasCardinalityRisk(route: string): boolean {
  if (!route || route === "/") {
    return false;
  }

  const segments = route.split("/").filter(Boolean);
  return segments.some((segment) => {
    // Already normalized
    if (segment.startsWith(":") || segment === "*") {
      return false;
    }

    // Check for dynamic patterns
    return isDynamicSegment(segment);
  });
}

/**
 * Estimate cardinality of a route
 *
 * Returns approximate number of unique routes this pattern could generate.
 * Used for capacity planning and alerting on high-cardinality routes.
 */
export function estimateCardinality(route: string): number {
  if (!route || route === "/") {
    return 1;
  }

  const segments = route.split("/").filter(Boolean);
  let cardinality = 1;

  for (const segment of segments) {
    if (segment.startsWith(":")) {
      // Parameter could be infinite values, use conservative estimate
      cardinality *= 1000;
    } else if (segment === "*") {
      // Wildcard could match many paths
      cardinality *= 100;
    }
    // Static segments don't multiply cardinality
  }

  return cardinality;
}
