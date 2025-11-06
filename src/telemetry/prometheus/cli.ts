#!/usr/bin/env node
/**
 * Prometheus exporter CLI
 *
 * Command-line interface for Prometheus metrics server and utilities.
 * Provides serve, export, and validate commands for development and debugging.
 */

import { Command } from 'commander';
import { exitCodes } from '../../foundry/exit-codes/index.js';
import { createSignalManager } from '../../foundry/signals/index.js';
import { metrics } from '../index.js';
import { PromClientNotFoundError } from './errors.js';
import { PrometheusExporter } from './exporter.js';
import { registerPrometheusShutdown } from './lifecycle.js';
import { startMetricsServer, stopMetricsServer } from './server.js';

/**
 * Load App Identity if available
 *
 * Attempts to load application identity for namespace/subsystem defaults.
 * Returns null if App Identity is not available (graceful degradation).
 */
async function loadAppIdentityIfAvailable(): Promise<{
  vendor?: string;
  binary_name?: string;
} | null> {
  try {
    const { loadIdentity } = await import('../../appidentity/index.js');
    const identity = await loadIdentity({ skipValidation: true });
    return {
      vendor: identity.app.vendor,
      binary_name: identity.app.binary_name,
    };
  } catch {
    // App Identity not available - use defaults
    return null;
  }
}

/**
 * Serve command - Start Prometheus metrics HTTP server
 */
async function serveCommand(options: {
  host: string;
  port: number;
  path: string;
  interval: number;
  refreshOnScrape: boolean;
  namespace?: string;
  subsystem?: string;
}): Promise<void> {
  try {
    // Load App Identity for defaults
    const identity = await loadAppIdentityIfAvailable();

    // Determine namespace and subsystem
    const namespace = options.namespace ?? identity?.vendor ?? 'tsfulmen';
    const subsystem = options.subsystem ?? identity?.binary_name ?? 'app';

    // Create exporter
    const exporter = new PrometheusExporter({
      registry: metrics,
      namespace,
      subsystem,
    });

    // Start background refresh loop
    exporter.startRefresh({
      intervalMs: options.interval,
      onError: (err) => {
        console.error('Refresh error:', err.message);
      },
    });

    // Start HTTP server
    const server = await startMetricsServer(exporter, {
      host: options.host,
      port: options.port,
      path: options.path,
      refreshOnScrape: options.refreshOnScrape,
    });

    // Setup graceful shutdown
    const signalManager = createSignalManager();
    await registerPrometheusShutdown(exporter, signalManager);

    // Also stop HTTP server on shutdown
    signalManager.register('SIGTERM', async () => {
      await stopMetricsServer(server);
    });
    signalManager.register('SIGINT', async () => {
      await stopMetricsServer(server);
    });

    console.log(`Namespace: ${namespace}, Subsystem: ${subsystem}`);
    console.log(`Refresh interval: ${options.interval}ms`);
    console.log('Press Ctrl+C to stop');
  } catch (err) {
    if (err instanceof PromClientNotFoundError) {
      console.error('Error: prom-client not installed');
      console.error('Install with: bun add prom-client');
      process.exit(exitCodes.EXIT_MISSING_DEPENDENCY);
    }

    console.error('Error starting metrics server:', err);
    process.exit(1);
  }
}

/**
 * Export command - Export current metrics in Prometheus format
 */
async function exportCommand(options: {
  format: 'text' | 'json';
  namespace?: string;
  subsystem?: string;
}): Promise<void> {
  try {
    // Load App Identity for defaults
    const identity = await loadAppIdentityIfAvailable();

    // Determine namespace and subsystem
    const namespace = options.namespace ?? identity?.vendor ?? 'tsfulmen';
    const subsystem = options.subsystem ?? identity?.binary_name ?? 'app';

    // Create exporter
    const exporter = new PrometheusExporter({
      registry: metrics,
      namespace,
      subsystem,
    });

    // Refresh to get current metrics
    await exporter.refresh();

    if (options.format === 'text') {
      // Output Prometheus text format
      const output = await exporter.getMetrics();
      console.log(output);
    } else {
      // Output JSON format (stats + metrics)
      const stats = exporter.getStats();
      const metricsText = await exporter.getMetrics();

      console.log(
        JSON.stringify(
          {
            stats,
            metrics: metricsText,
            namespace,
            subsystem,
          },
          null,
          2,
        ),
      );
    }

    process.exit(0);
  } catch (err) {
    if (err instanceof PromClientNotFoundError) {
      console.error('Error: prom-client not installed');
      console.error('Install with: bun add prom-client');
      process.exit(exitCodes.EXIT_MISSING_DEPENDENCY);
    }

    console.error('Error exporting metrics:', err);
    process.exit(1);
  }
}

/**
 * Validate command - Validate Prometheus exporter configuration
 */
async function validateCommand(): Promise<void> {
  try {
    // Check prom-client availability
    await import('prom-client');
    console.log('✓ prom-client is installed');

    // Try to create exporter
    const exporter = new PrometheusExporter({ registry: metrics });
    console.log('✓ PrometheusExporter can be instantiated');

    // Try to refresh (exports metrics from registry)
    await exporter.refresh();
    console.log('✓ Metrics can be refreshed from registry');

    // Get stats
    const stats = exporter.getStats();
    console.log(`✓ Exported ${stats.metricsCount} metrics`);

    // Check for naming conflicts
    const metricsText = await exporter.getMetrics();
    const lines = metricsText.split('\n').filter((line) => !line.startsWith('#'));
    const uniqueLines = new Set(lines);

    if (lines.length !== uniqueLines.size) {
      console.warn('⚠ Warning: Duplicate metric names detected');
      process.exit(exitCodes.EXIT_CONFIG_INVALID);
    }

    console.log('✓ No naming conflicts detected');
    console.log('\nValidation successful!');
    process.exit(0);
  } catch (err) {
    if (err instanceof Error && err.message.includes('Cannot find module')) {
      console.error('✗ prom-client not installed');
      console.error('  Install with: bun add prom-client');
      process.exit(exitCodes.EXIT_MISSING_DEPENDENCY);
    }

    console.error('✗ Validation failed:', err);
    process.exit(exitCodes.EXIT_CONFIG_INVALID);
  }
}

/**
 * Main CLI program
 */
function main(): void {
  const program = new Command();

  program
    .name('tsfulmen-prometheus')
    .description('Prometheus exporter for TSFulmen telemetry')
    .version('0.1.8');

  // Serve command
  program
    .command('serve')
    .description('Start Prometheus metrics HTTP server')
    .option('--host <host>', 'Host to bind to', '127.0.0.1')
    .option('--port <port>', 'Port to bind to', '9464')
    .option('--path <path>', 'Path to serve metrics on', '/metrics')
    .option('--interval <ms>', 'Background refresh interval in ms', '15000')
    .option('--refresh-on-scrape', 'Refresh metrics on each scrape request', false)
    .option('--namespace <string>', 'Override namespace prefix')
    .option('--subsystem <string>', 'Override subsystem prefix')
    .action((options) => {
      void serveCommand({
        host: options.host,
        port: Number.parseInt(options.port, 10),
        path: options.path,
        interval: Number.parseInt(options.interval, 10),
        refreshOnScrape: options.refreshOnScrape,
        namespace: options.namespace,
        subsystem: options.subsystem,
      });
    });

  // Export command
  program
    .command('export')
    .description('Export current metrics in Prometheus format')
    .option('--format <type>', 'Output format (text|json)', 'text')
    .option('--namespace <string>', 'Override namespace prefix')
    .option('--subsystem <string>', 'Override subsystem prefix')
    .action((options) => {
      void exportCommand({
        format: options.format as 'text' | 'json',
        namespace: options.namespace,
        subsystem: options.subsystem,
      });
    });

  // Validate command
  program
    .command('validate')
    .description('Validate Prometheus exporter configuration')
    .action(() => {
      void validateCommand();
    });

  program.parse();
}

// Entry point check
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
