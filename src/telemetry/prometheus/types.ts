/**
 * Prometheus exporter types
 *
 * TypeScript type definitions for Prometheus integration with TSFulmen telemetry.
 */

import type { MetricsRegistry } from '../registry.js';

/**
 * Prometheus exporter configuration options
 */
export interface PrometheusExporterOptions {
  /**
   * TelemetryRegistry instance to export metrics from
   *
   * @default metrics (singleton registry)
   */
  registry?: MetricsRegistry;

  /**
   * Namespace prefix for all metrics
   *
   * If not provided, will attempt to use App Identity vendor field,
   * falling back to 'tsfulmen'.
   *
   * @example 'fulmen', 'acme'
   */
  namespace?: string;

  /**
   * Subsystem prefix for all metrics
   *
   * If not provided, will attempt to use App Identity binary_name field,
   * falling back to 'app'.
   *
   * @example 'myapp', 'worker', 'api'
   */
  subsystem?: string;

  /**
   * Default labels applied to all metrics
   *
   * Useful for deployment metadata (environment, region, version).
   * Label names must match Prometheus naming rules: [a-zA-Z_][a-zA-Z0-9_]*
   *
   * @example
   * ```typescript
   * {
   *   environment: 'production',
   *   region: 'us-east-1',
   *   version: '0.1.8'
   * }
   * ```
   */
  defaultLabels?: Record<string, string>;

  /**
   * Custom help text for metrics
   *
   * Maps metric name to help description. If not provided,
   * uses taxonomy description or generates default help text.
   *
   * @example
   * ```typescript
   * {
   *   'schema_validations': 'Total number of schema validations performed'
   * }
   * ```
   */
  helpText?: Record<string, string>;

  /**
   * Whether to include timestamp in metrics output
   *
   * @default false
   */
  includeTimestamp?: boolean;
}

/**
 * Refresh options for background synchronization
 */
export interface RefreshOptions {
  /**
   * Refresh interval in milliseconds
   *
   * @default 15000 (15 seconds, matches typical Prometheus scrape interval)
   */
  intervalMs?: number;

  /**
   * Error callback invoked when refresh fails
   *
   * Errors are logged internally, but this callback allows custom handling
   * (e.g., alerting, circuit breaking).
   *
   * @param error - Error that occurred during refresh
   */
  onError?: (error: Error) => void;
}

/**
 * Server options for HTTP metrics endpoint
 */
export interface ServerOptions {
  /**
   * Host to bind server to
   *
   * @default '127.0.0.1'
   */
  host?: string;

  /**
   * Port to bind server to
   *
   * @default 9464
   */
  port?: number;

  /**
   * Path to serve metrics on
   *
   * @default '/metrics'
   */
  path?: string;

  /**
   * Whether to refresh metrics on each scrape request
   *
   * Most deployments should use background refresh instead.
   * Enable this only if scrape interval is very long (>1 minute).
   *
   * @default false
   */
  refreshOnScrape?: boolean;

  /**
   * Optional authentication hook
   *
   * Called before serving metrics. Return true to allow, false to reject with 401.
   *
   * @param req - HTTP request object
   * @returns Whether request is authenticated
   */
  authenticate?: (req: unknown) => boolean | Promise<boolean>;

  /**
   * Optional rate limiting hook
   *
   * Called after authentication. Return true to allow, false to reject with 429.
   *
   * @param req - HTTP request object
   * @returns Whether request is within rate limits
   */
  rateLimit?: (req: unknown) => boolean | Promise<boolean>;
}

/**
 * Exporter statistics and state
 */
export interface ExporterStats {
  /** Total number of successful refresh operations */
  refreshCount: number;

  /** Total number of failed refresh operations */
  errorCount: number;

  /** Timestamp of last successful refresh (ISO 8601) */
  lastRefreshTime: string | null;

  /** Number of metrics currently registered in Prometheus registry */
  metricsCount: number;

  /** Whether background refresh loop is running */
  isRefreshing: boolean;
}
