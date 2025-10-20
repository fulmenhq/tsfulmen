/**
 * Schema CLI - Commander-based CLI for schema operations
 *
 * Provides command-line interface for schema discovery, validation,
 * and normalization operations.
 */

import { Command } from 'commander';
import type { CLIOptions } from './types.js';

/**
 * Create CLI command structure
 */
export function createCLI(_options: CLIOptions = {}): Command {
  const program = new Command();

  program
    .name('tsfulmen-schema')
    .description('Schema validation and discovery CLI for Fulmen')
    .version('0.1.0');

  // TODO: Implement CLI commands
  // - schema list [prefix]
  // - schema show --schema-id <id>
  // - schema validate --schema-id <id> <file> [--use-goneat]
  // - schema validate-schema <file>
  // - schema normalize <file> [--compact]

  return program;
}
