/**
 * Schema CLI - Commander-based CLI for schema operations
 *
 * Provides command-line interface for schema discovery, validation,
 * and normalization operations. This is a developer tool for exploration
 * and testing, not for production use.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { Command } from 'commander';
import { isGoneatAvailable, runGoneatValidation } from './goneat-bridge.js';
import { compareSchemas, normalizeSchema } from './normalizer.js';
import { getSchemaRegistry, listSchemas } from './registry.js';
import type { CLIOptions, SchemaValidationResult } from './types.js';
import { formatDiagnostics } from './utils.js';
import { validateFileBySchemaId } from './validator.js';

/**
 * Create CLI command structure
 */
export function createCLI(options: CLIOptions = {}): Command {
  const program = new Command();

  program
    .name('tsfulmen-schema')
    .description('Schema validation and discovery CLI for Fulmen (developer tool)')
    .version('0.1.0');

  // List schemas command
  program
    .command('list')
    .description('List available schemas from registry')
    .argument('[prefix]', 'Filter schemas by prefix')
    .option('--base-dir <path>', 'Override schema base directory')
    .action(async (prefix?: string, cmdOptions?: { baseDir?: string }) => {
      try {
        const schemas = await listSchemas(prefix, {
          baseDir: cmdOptions?.baseDir || options.baseDir,
        });

        if (schemas.length === 0) {
          console.log('No schemas found');
          return;
        }

        console.log(`Found ${schemas.length} schema(s):\n`);
        for (const schema of schemas) {
          console.log(`  ${schema.id}`);
          console.log(`    Format: ${schema.format}`);
          console.log(`    Path: ${schema.relativePath}`);
          if (schema.description) {
            console.log(`    Description: ${schema.description}`);
          }
          console.log();
        }
      } catch (error) {
        console.error('Error listing schemas:', (error as Error).message);
        process.exit(1);
      }
    });

  // Show schema command
  program
    .command('show')
    .description('Show schema details')
    .requiredOption('--schema-id <id>', 'Schema ID to show')
    .option('--base-dir <path>', 'Override schema base directory')
    .action(async (cmdOptions: { schemaId: string; baseDir?: string }) => {
      try {
        const registry = getSchemaRegistry({
          baseDir: cmdOptions.baseDir || options.baseDir,
        });
        const schema = await registry.getSchema(cmdOptions.schemaId);

        console.log('Schema Details:\n');
        console.log(`  ID: ${schema.id}`);
        console.log(`  Format: ${schema.format}`);
        console.log(`  Path: ${schema.path}`);
        console.log(`  Relative Path: ${schema.relativePath}`);
        if (schema.version) {
          console.log(`  Version: ${schema.version}`);
        }
        if (schema.description) {
          console.log(`  Description: ${schema.description}`);
        }
        if (schema.schemaDraft) {
          console.log(`  Schema Draft: ${schema.schemaDraft}`);
        }

        // Read and display schema content
        const content = await readFile(schema.path, 'utf-8');
        console.log('\nSchema Content:');
        console.log(content);
      } catch (error) {
        console.error('Error showing schema:', (error as Error).message);
        process.exit(1);
      }
    });

  // Validate data command
  program
    .command('validate')
    .description('Validate data file against schema')
    .requiredOption('--schema-id <id>', 'Schema ID to validate against')
    .argument('<file>', 'Data file to validate')
    .option('--use-goneat', 'Use goneat for validation (requires goneat binary)')
    .option('--goneat-path <path>', 'Path to goneat binary')
    .option('--base-dir <path>', 'Override schema base directory')
    .action(
      async (
        file: string,
        cmdOptions: {
          schemaId: string;
          useGoneat?: boolean;
          goneatPath?: string;
          baseDir?: string;
        },
      ) => {
        try {
          let result: SchemaValidationResult;

          if (cmdOptions.useGoneat) {
            // Check goneat availability
            const available = await isGoneatAvailable(cmdOptions.goneatPath);
            if (!available) {
              console.error('❌ goneat not available. Install goneat or remove --use-goneat flag.');
              console.error('   AJV validation (default) works without external dependencies.');
              process.exit(1);
            }

            // Get schema path
            const registry = getSchemaRegistry({
              baseDir: cmdOptions.baseDir || options.baseDir,
            });
            const schema = await registry.getSchema(cmdOptions.schemaId);

            console.log('Using goneat validation...');
            result = await runGoneatValidation(schema.path, file, cmdOptions.goneatPath);
          } else {
            // Use AJV validation (default, library implementation)
            console.log('Using AJV validation...');
            result = await validateFileBySchemaId(file, cmdOptions.schemaId, {
              baseDir: cmdOptions.baseDir || options.baseDir,
            });
          }

          if (result.valid) {
            console.log(`✅ Validation passed (${result.source})`);
            process.exit(0);
          } else {
            console.log(`❌ Validation failed (${result.source})`);
            console.log('\nDiagnostics:');
            console.log(formatDiagnostics(result.diagnostics));
            process.exit(1);
          }
        } catch (error) {
          console.error('Error validating file:', (error as Error).message);
          process.exit(1);
        }
      },
    );

  // Validate schema command
  program
    .command('validate-schema')
    .description('Validate a schema file itself')
    .argument('<file>', 'Schema file to validate')
    .action(async (file: string) => {
      try {
        const content = await readFile(file, 'utf-8');
        const { validateSchema } = await import('./validator.js');
        const result = await validateSchema(content);

        if (result.valid) {
          console.log('✅ Schema is valid');
          process.exit(0);
        } else {
          console.log('❌ Schema is invalid');
          console.log('\nDiagnostics:');
          console.log(formatDiagnostics(result.diagnostics));
          process.exit(1);
        }
      } catch (error) {
        console.error('Error validating schema:', (error as Error).message);
        process.exit(1);
      }
    });

  // Normalize schema command
  program
    .command('normalize')
    .description('Normalize schema to canonical JSON format')
    .argument('<file>', 'Schema file to normalize')
    .option('--compact', 'Output compact JSON (no formatting)')
    .option('-o, --output <file>', 'Write to output file instead of stdout')
    .action(async (file: string, cmdOptions: { compact?: boolean; output?: string }) => {
      try {
        const content = await readFile(file, 'utf-8');
        const normalized = normalizeSchema(content, {
          compact: cmdOptions.compact,
        });

        if (cmdOptions.output) {
          await writeFile(cmdOptions.output, normalized, 'utf-8');
          console.log(`✅ Normalized schema written to ${cmdOptions.output}`);
        } else {
          console.log(normalized);
        }
      } catch (error) {
        console.error('Error normalizing schema:', (error as Error).message);
        process.exit(1);
      }
    });

  // Compare schemas command
  program
    .command('compare')
    .description('Compare two schemas for semantic equality')
    .argument('<file1>', 'First schema file')
    .argument('<file2>', 'Second schema file')
    .option('--show-normalized', 'Show normalized outputs')
    .action(async (file1: string, file2: string, cmdOptions: { showNormalized?: boolean }) => {
      try {
        const content1 = await readFile(file1, 'utf-8');
        const content2 = await readFile(file2, 'utf-8');

        const result = compareSchemas(content1, content2);

        if (result.equal) {
          console.log('✅ Schemas are semantically equal');
        } else {
          console.log('❌ Schemas differ');
        }

        if (cmdOptions.showNormalized) {
          console.log('\nNormalized Schema 1:');
          console.log(result.normalizedA);
          console.log('\nNormalized Schema 2:');
          console.log(result.normalizedB);
        }

        process.exit(result.equal ? 0 : 1);
      } catch (error) {
        console.error('Error comparing schemas:', (error as Error).message);
        process.exit(1);
      }
    });

  // Export schema command
  program
    .command('export')
    .description('Export schema from registry to file with provenance')
    .requiredOption('--schema-id <id>', 'Schema ID to export')
    .requiredOption('--out <path>', 'Output file path')
    .option('--force', 'Overwrite existing file', false)
    .option('--no-provenance', 'Exclude provenance metadata')
    .option('--no-validate', 'Skip schema validation before export')
    .option('--format <format>', 'Export format (json|yaml|auto)', 'auto')
    .option('--base-dir <path>', 'Override schema base directory')
    .action(
      async (cmdOptions: {
        schemaId: string;
        out: string;
        force?: boolean;
        provenance?: boolean;
        validate?: boolean;
        format?: string;
        baseDir?: string;
      }) => {
        try {
          const { exportSchema } = await import('./export.js');
          const { exitCodes } = await import('../foundry/index.js');

          const result = await exportSchema({
            schemaId: cmdOptions.schemaId,
            outPath: cmdOptions.out,
            includeProvenance: cmdOptions.provenance ?? true,
            validate: cmdOptions.validate ?? true,
            overwrite: cmdOptions.force ?? false,
            format: (cmdOptions.format as 'json' | 'yaml' | 'auto') ?? 'auto',
            baseDir: cmdOptions.baseDir || options.baseDir,
          });

          console.log('✅ Schema exported successfully');
          console.log(`   Schema ID: ${result.schemaId}`);
          console.log(`   Output: ${result.outPath}`);
          console.log(`   Format: ${result.format}`);

          if (result.provenance) {
            console.log('\nProvenance:');
            console.log(`   Crucible: ${result.provenance.crucible_version}`);
            console.log(`   Library: ${result.provenance.library_version}`);
            if (result.provenance.revision) {
              console.log(`   Revision: ${result.provenance.revision}`);
            }
            console.log(`   Exported: ${result.provenance.exported_at}`);
          }

          process.exit(exitCodes.EXIT_SUCCESS);
        } catch (error) {
          const { exitCodes } = await import('../foundry/index.js');
          const { SchemaExportError, SchemaValidationError, ExportErrorReason } = await import(
            './errors.js'
          );

          console.error('❌ Schema export failed:', (error as Error).message);

          // Map specific error types to appropriate exit codes
          if (error instanceof SchemaExportError) {
            if (error.outPath) {
              console.error(`   Output path: ${error.outPath}`);
            }

            // Use error reason for type-safe exit code mapping
            switch (error.reason) {
              case ExportErrorReason.FILE_EXISTS:
              case ExportErrorReason.WRITE_FAILED:
                process.exit(exitCodes.EXIT_FILE_WRITE_ERROR);
                break;

              case ExportErrorReason.INVALID_FORMAT:
                process.exit(exitCodes.EXIT_INVALID_ARGUMENT);
                break;

              default:
                // PROVENANCE_FAILED, UNKNOWN, and any future reasons
                process.exit(exitCodes.EXIT_FAILURE);
            }
          }

          if (error instanceof SchemaValidationError) {
            // Schema not found or validation failed
            const errorMsg = error.message.toLowerCase();

            if (errorMsg.includes('not found')) {
              process.exit(exitCodes.EXIT_FILE_NOT_FOUND);
            }

            // Validation failures
            process.exit(exitCodes.EXIT_DATA_INVALID);
          }

          process.exit(exitCodes.EXIT_FAILURE);
        }
      },
    );

  // Identity show command
  program
    .command('identity-show')
    .description('Show application identity from .fulmen/app.yaml')
    .option('--path <path>', 'Explicit path to app.yaml')
    .option('--json', 'Output as JSON')
    .action(async (cmdOptions: { path?: string; json?: boolean }) => {
      try {
        const { loadIdentity } = await import('../appidentity/loader.js');
        const { exitCodes } = await import('../foundry/index.js');

        const identity = await loadIdentity({ path: cmdOptions.path });

        if (cmdOptions.json) {
          console.log(JSON.stringify(identity, null, 2));
        } else {
          console.log('Application Identity:\n');
          console.log(`  Binary Name: ${identity.app.binary_name}`);
          console.log(`  Vendor: ${identity.app.vendor}`);
          console.log(`  Env Prefix: ${identity.app.env_prefix}`);
          console.log(`  Config Name: ${identity.app.config_name}`);
          console.log(`  Description: ${identity.app.description}`);

          if (identity.metadata) {
            console.log('\nMetadata:');
            if (identity.metadata.license) {
              console.log(`  License: ${identity.metadata.license}`);
            }
            if (identity.metadata.repository_category) {
              console.log(`  Category: ${identity.metadata.repository_category}`);
            }
            if (identity.metadata.telemetry_namespace) {
              console.log(`  Telemetry: ${identity.metadata.telemetry_namespace}`);
            }
            if (identity.metadata.project_url) {
              console.log(`  Project URL: ${identity.metadata.project_url}`);
            }
          }
        }

        process.exit(exitCodes.EXIT_SUCCESS);
      } catch (error) {
        const { exitCodes } = await import('../foundry/index.js');
        const { AppIdentityError } = await import('../appidentity/errors.js');

        console.error('❌ Failed to load identity:', (error as Error).message);

        if (error instanceof AppIdentityError) {
          if (error.message.includes('not found')) {
            process.exit(exitCodes.EXIT_FILE_NOT_FOUND);
          }
          if (error.message.includes('Invalid') || error.message.includes('validation')) {
            process.exit(exitCodes.EXIT_DATA_INVALID);
          }
        }

        process.exit(exitCodes.EXIT_FAILURE);
      }
    });

  // Identity validate command
  program
    .command('identity-validate')
    .description('Validate application identity against schema')
    .argument('[file]', 'Path to app.yaml (defaults to discovery)')
    .action(async (file?: string) => {
      try {
        const { loadIdentity } = await import('../appidentity/loader.js');
        const { exitCodes } = await import('../foundry/index.js');

        console.log('Validating application identity...');

        const identity = await loadIdentity({ path: file });

        console.log('✅ Identity is valid');
        console.log(`   Binary: ${identity.app.binary_name}`);
        console.log(`   Vendor: ${identity.app.vendor}`);

        process.exit(exitCodes.EXIT_SUCCESS);
      } catch (error) {
        const { exitCodes } = await import('../foundry/index.js');
        const { AppIdentityError } = await import('../appidentity/errors.js');

        console.error('❌ Identity validation failed:', (error as Error).message);

        if (error instanceof AppIdentityError) {
          if (error.message.includes('not found')) {
            process.exit(exitCodes.EXIT_FILE_NOT_FOUND);
          }
          if (error.message.includes('Invalid') || error.message.includes('validation')) {
            process.exit(exitCodes.EXIT_DATA_INVALID);
          }
        }

        process.exit(exitCodes.EXIT_FAILURE);
      }
    });

  return program;
}

// Main entry point when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const program = createCLI();
  program.parse(process.argv);
}
