#!/usr/bin/env node
/**
 * Executable entry point for the `tsfulmen-signals` CLI.
 *
 * Dedicated bin entry (never imported by the library graph); see
 * src/bin/schema-cli.ts for the compile-safety rationale.
 */
import { main } from "../foundry/signals/cli.js";

void main();
