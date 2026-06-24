/**
 * Compiled-binary SERVE proof fixture (v0.4.0 T6). NOT shipped.
 *
 * Exercises the real standalone-`serve` lifecycle that was the original
 * `bun --compile` blocker (kilo gap #4) — mirroring src/telemetry/prometheus/cli.ts
 * `serveCommand`: load the signals catalog from embedded assets, bind the Prometheus
 * metrics HTTP server, `createSignalManager()`, register Prometheus shutdown +
 * SIGTERM/SIGINT handlers, then shut down. Run from a temp cwd with no asset tree on
 * disk; a clean bind + lifecycle wiring + shutdown proves serve works in a single-file
 * binary.
 */

import { createSignalManager, getSignalCatalog } from "../../src/foundry/signals/index.js";
import { metrics } from "../../src/telemetry/index.js";
import {
  PrometheusExporter,
  registerPrometheusShutdown,
  startMetricsServer,
  stopMetricsServer,
} from "../../src/telemetry/prometheus/index.js";

async function main(): Promise<void> {
  // 1. Signals catalog from embedded assets (the serve blocker).
  const catalog = await getSignalCatalog();
  if (!catalog?.signals?.length) {
    throw new Error("signals catalog empty");
  }

  // 2. Bind the metrics HTTP server on an ephemeral port.
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

  // 3. Real serve lifecycle: signal manager + Prometheus shutdown + signal handlers
  //    (this is the createSignalManager()/registration path from serveCommand).
  const signalManager = createSignalManager();
  await registerPrometheusShutdown(exporter, signalManager);
  signalManager.register("SIGTERM", async () => {
    await stopMetricsServer(server, 5000, exporter);
  });
  signalManager.register("SIGINT", async () => {
    await stopMetricsServer(server, 5000, exporter);
  });

  // 4. Shut down cleanly.
  await stopMetricsServer(server, 5000, exporter);

  console.log(`SERVE_OK=${port > 0} port=${port} signals=${catalog.signals.length}`);
}

main().catch((error) => {
  console.log(`SERVE_OK=false err=${(error as Error).message}`);
  process.exit(1);
});
