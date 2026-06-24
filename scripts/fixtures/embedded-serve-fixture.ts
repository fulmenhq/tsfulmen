/**
 * Compiled-binary SERVE proof fixture (v0.4.0 T6). NOT shipped.
 *
 * Exercises the standalone-`serve` path that was the original `bun --compile`
 * blocker (kilo gap #4): `createSignalManager()`/signals-catalog load + binding the
 * Prometheus metrics HTTP server — all from embedded assets, run from a temp cwd
 * with no asset tree on disk. A clean bind + shutdown proves serve works in a
 * single-file binary.
 */

import { getSignalCatalog } from "../../src/foundry/signals/index.js";
import { metrics } from "../../src/telemetry/index.js";
import {
  PrometheusExporter,
  startMetricsServer,
  stopMetricsServer,
} from "../../src/telemetry/prometheus/index.js";

async function main(): Promise<void> {
  // 1. Signals catalog from embedded assets (the serve blocker).
  const catalog = await getSignalCatalog();
  if (!catalog?.signals?.length) {
    throw new Error("signals catalog empty");
  }

  // 2. Bind the metrics HTTP server on an ephemeral port, then shut down.
  const exporter = new PrometheusExporter({
    registry: metrics,
    namespace: "t6",
    subsystem: "serve",
  });
  const server = await startMetricsServer(exporter, {
    host: "127.0.0.1",
    port: 0,
    path: "/metrics",
  });
  const addr = server.address();
  const port = addr && typeof addr === "object" ? addr.port : 0;
  await stopMetricsServer(server);

  console.log(`SERVE_OK=${port > 0} port=${port} signals=${catalog.signals.length}`);
}

main().catch((error) => {
  console.log(`SERVE_OK=false err=${(error as Error).message}`);
  process.exit(1);
});
