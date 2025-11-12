/**
 * Error Handling & Telemetry Demo
 *
 * Demonstrates integrated error handling and metrics collection
 * using FulmenError and MetricsRegistry.
 *
 * Run with: bunx tsx examples/error-telemetry-demo.ts
 */

import { FulmenError } from "../src/errors/fulmen-error.js";
import { metrics } from "../src/telemetry/index.js";

async function simulateConfigLoad(filepath: string): Promise<void> {
  const startTime = performance.now();

  try {
    console.log(`Loading config from: ${filepath}`);

    if (!filepath.endsWith(".json")) {
      throw new Error("Invalid config format: expected JSON");
    }

    const loadTime = Math.random() * 100;
    await new Promise((resolve) => setTimeout(resolve, loadTime));

    metrics.histogram("config_load_ms").observe(performance.now() - startTime);
    console.log("✅ Config loaded successfully");
  } catch (err) {
    metrics.counter("config_load_errors").inc();
    metrics.histogram("config_load_ms").observe(performance.now() - startTime);

    const fulmenError = FulmenError.fromError(err, {
      code: "CONFIG_LOAD_FAILED",
      severity: "high",
      context: {
        filepath,
        operation: "load",
      },
    });

    console.error("❌ Config load failed");
    console.error(JSON.stringify(fulmenError.toJSON(), null, 2));
    throw fulmenError;
  }
}

async function simulateSchemaValidation(schemaId: string): Promise<void> {
  const startTime = performance.now();
  console.log(`\nValidating against schema: ${schemaId}`);

  const validationTime = Math.random() * 50;
  await new Promise((resolve) => setTimeout(resolve, validationTime));

  const isValid = Math.random() > 0.3;

  if (!isValid) {
    metrics.counter("schema_validation_errors").inc();

    const fulmenError = FulmenError.wrap(new Error("Validation failed"), {
      code: "SCHEMA_VALIDATION_FAILED",
      severity: "medium",
      context: {
        schema_id: schemaId,
        error_count: 2,
      },
    });

    console.error("❌ Validation failed");
    console.error(JSON.stringify(fulmenError.toJSON(), null, 2));
    throw fulmenError;
  }

  metrics.counter("schema_validations").inc();
  console.log(`✅ Validation passed (${(performance.now() - startTime).toFixed(2)}ms)`);
}

async function simulatePathfinderFind(pattern: string): Promise<void> {
  const startTime = performance.now();

  try {
    console.log(`\nSearching for schemas matching: ${pattern}`);

    const searchTime = Math.random() * 200;
    await new Promise((resolve) => setTimeout(resolve, searchTime));

    const foundCount = Math.floor(Math.random() * 10) + 1;
    metrics.histogram("pathfinder_find_ms").observe(performance.now() - startTime);

    console.log(
      `✅ Found ${foundCount} schemas in ${(performance.now() - startTime).toFixed(2)}ms`,
    );
  } catch (err) {
    metrics.counter("pathfinder_validation_errors").inc();
    throw err;
  }
}

async function main() {
  console.log("🚀 TSFulmen Error Handling & Telemetry Demo\n");
  console.log("=".repeat(60));

  try {
    await simulateConfigLoad("/path/to/config.json");
  } catch (_err) {
    // Error already logged, continue demo
  }

  try {
    await simulateConfigLoad("/path/to/invalid.txt");
  } catch (_err) {
    // Error already logged, continue demo
  }

  for (let i = 0; i < 5; i++) {
    try {
      await simulateSchemaValidation("observability/metrics/v1.0.0/metrics-event");
    } catch (_err) {
      // Continue
    }
  }

  await simulatePathfinderFind("**/*.schema.json");
  await simulatePathfinderFind("observability/**");

  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 Metrics Summary\n");

  const events = await metrics.export();

  for (const event of events) {
    if (typeof event.value === "number") {
      console.log(`${event.name}: ${event.value} ${event.unit ?? ""}`);
    } else {
      console.log(
        `${event.name}: count=${event.value.count}, sum=${event.value.sum.toFixed(2)}ms, avg=${(event.value.sum / event.value.count).toFixed(2)}ms`,
      );
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("📝 JSON Export\n");
  console.log(JSON.stringify(events, null, 2));

  console.log("\n✨ Demo complete!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
