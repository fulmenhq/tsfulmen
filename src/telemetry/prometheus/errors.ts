/**
 * Prometheus exporter error classes
 *
 * Specialized errors for Prometheus integration failures.
 */

import { FulmenError } from '../../errors/index.js';

/**
 * Base error class for Prometheus exporter errors
 */
export class PrometheusExporterError extends FulmenError {
  constructor(
    message: string,
    options?: {
      code?: string;
      cause?: unknown;
      context?: Record<string, unknown>;
    },
  ) {
    super({
      code: options?.code || 'PROMETHEUS_EXPORTER_ERROR',
      message,
      severity: 'medium',
      context: options?.context,
    });

    if (options?.cause) {
      this.cause = options.cause;
    }

    this.name = 'PrometheusExporterError';
  }
}

/**
 * Error thrown when prom-client peer dependency is not installed
 */
export class PromClientNotFoundError extends PrometheusExporterError {
  constructor(cause?: unknown) {
    super(
      'prom-client peer dependency not found. Install with: bun add prom-client\n' +
        'For npm: npm install prom-client\n' +
        'For more information, see: https://github.com/siimon/prom-client',
      {
        code: 'PROM_CLIENT_NOT_FOUND',
        cause,
        context: {
          suggestion: 'Run "bun add prom-client" to install the required peer dependency',
        },
      },
    );

    this.name = 'PromClientNotFoundError';
  }
}

/**
 * Error thrown when metric name is invalid for Prometheus
 */
export class InvalidMetricNameError extends PrometheusExporterError {
  constructor(metricName: string, reason: string) {
    super(`Invalid Prometheus metric name: "${metricName}". ${reason}`, {
      code: 'INVALID_METRIC_NAME',
      context: {
        metricName,
        reason,
        suggestion:
          'Prometheus metric names must match: [a-zA-Z_:][a-zA-Z0-9_:]*\n' +
          'See: https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels',
      },
    });

    this.name = 'InvalidMetricNameError';
  }
}

/**
 * Error thrown when label name is invalid for Prometheus
 */
export class InvalidLabelNameError extends PrometheusExporterError {
  constructor(labelName: string, reason: string) {
    super(`Invalid Prometheus label name: "${labelName}". ${reason}`, {
      code: 'INVALID_LABEL_NAME',
      context: {
        labelName,
        reason,
        suggestion:
          'Prometheus label names must match: [a-zA-Z_][a-zA-Z0-9_]*\n' +
          'See: https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels',
      },
    });

    this.name = 'InvalidLabelNameError';
  }
}

/**
 * Error thrown when metric registration fails
 */
export class MetricRegistrationError extends PrometheusExporterError {
  constructor(metricName: string, cause: unknown) {
    super(`Failed to register Prometheus metric: "${metricName}"`, {
      code: 'METRIC_REGISTRATION_FAILED',
      cause,
      context: {
        metricName,
        suggestion: 'Check for duplicate metric names or incompatible collector types',
      },
    });

    this.name = 'MetricRegistrationError';
  }
}

/**
 * Error thrown when refresh operation fails
 *
 * This error wraps underlying errors (InvalidMetricNameError, MetricRegistrationError, etc.)
 * that occur during the refresh process. Callers should inspect the `cause` property
 * to access the root error for specific error handling.
 *
 * @example
 * ```typescript
 * try {
 *   await exporter.refresh();
 * } catch (err) {
 *   if (err instanceof RefreshError) {
 *     // Check the underlying cause for specific error types
 *     if (err.cause instanceof InvalidMetricNameError) {
 *       console.error('Invalid metric name:', err.cause.message);
 *     }
 *   }
 * }
 * ```
 */
export class RefreshError extends PrometheusExporterError {
  constructor(cause: unknown, context?: Record<string, unknown>) {
    super('Failed to refresh Prometheus metrics from TelemetryRegistry', {
      code: 'REFRESH_FAILED',
      cause,
      context,
    });

    this.name = 'RefreshError';
  }
}
