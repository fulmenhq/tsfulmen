/**
 * Prometheus exporter lifecycle integration
 *
 * Helpers for integrating PrometheusExporter with TSFulmen lifecycle management,
 * particularly signal handling for graceful shutdown.
 */

import type { SignalManager } from "../../foundry/signals/index.js";
import type { PrometheusExporter } from "./exporter.js";

/**
 * Register Prometheus exporter shutdown handler
 *
 * Automatically stops the background refresh loop and performs a final refresh
 * when SIGTERM or SIGINT is received. This ensures metrics are up-to-date
 * before the process terminates.
 *
 * @param exporter - PrometheusExporter instance to manage
 * @param manager - SignalManager instance for lifecycle coordination
 *
 * @example
 * ```typescript
 * import { PrometheusExporter, registerPrometheusShutdown } from '@fulmenhq/tsfulmen/telemetry/prometheus';
 * import { createSignalManager } from '@fulmenhq/tsfulmen/foundry/signals';
 *
 * const exporter = new PrometheusExporter({ registry: metrics });
 * const signalManager = createSignalManager();
 *
 * // Register graceful shutdown
 * await registerPrometheusShutdown(exporter, signalManager);
 *
 * // Start refresh loop
 * exporter.startRefresh({ intervalMs: 15000 });
 *
 * // When SIGTERM/SIGINT received, exporter will:
 * // 1. Stop refresh loop
 * // 2. Perform final refresh
 * // 3. Allow process to exit gracefully
 * ```
 */
export async function registerPrometheusShutdown(
  exporter: PrometheusExporter,
  manager: SignalManager,
): Promise<void> {
  const shutdownHandler = async () => {
    await exporter.stopRefresh();
  };

  // Register for both SIGTERM and SIGINT
  await manager.register("SIGTERM", shutdownHandler);
  await manager.register("SIGINT", shutdownHandler);
}
