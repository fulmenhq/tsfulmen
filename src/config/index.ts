/**
 * Config module - implements Fulmen Config Path Standard
 *
 * Provides utilities for config path resolution and three-layer config loading
 */

export const VERSION = "0.1.0";

export * from "./errors.js";
// Config Path API exports
export * from "./paths.js";
export * from "./types.js";
export * from "./loader.js";
