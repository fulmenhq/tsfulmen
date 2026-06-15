#!/usr/bin/env node
/**
 * Executable entry point for the `tsfulmen-schema` CLI.
 *
 * This is a dedicated bin entry, never imported by the library graph, so it is
 * safe to parse argv unconditionally — under `bun build --compile` it cannot be
 * reached as a non-entry module and therefore cannot shadow a consumer's CLI.
 */
import { createCLI } from "../schema/cli.js";

createCLI().parse(process.argv);
