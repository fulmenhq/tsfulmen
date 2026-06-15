#!/usr/bin/env node
/**
 * Executable entry point for the `tsfulmen-prometheus` CLI.
 *
 * Dedicated bin entry (never imported by the library graph); see
 * src/bin/schema-cli.ts for the compile-safety rationale.
 */
import { createPrometheusCLI } from "../telemetry/prometheus/cli.js";

createPrometheusCLI().parse(process.argv);
