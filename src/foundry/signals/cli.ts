/**
 * Signals CLI - Commander-based CLI for signal operations
 *
 * Provides command-line interface for signal catalog exploration and validation.
 * This is a developer tool for debugging and operational work.
 */

import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import { exitCodes } from '../exit-codes/index.js';
import {
  getPlatformCapabilities,
  supportsSignal,
  supportsSignalExitCodes,
} from './capabilities.js';
import {
  getBehavior,
  getSignal,
  getSignalsVersion,
  listBehaviors,
  listSignals,
} from './catalog.js';

/**
 * Create CLI command structure
 */
export function createSignalsCLI(): Command {
  const program = new Command();

  program
    .name('tsfulmen-signals')
    .description('Signal handling CLI for Fulmen (developer tool)')
    .version('0.1.0');

  // Show signal(s) command
  program
    .command('show')
    .description('Show signal catalog information')
    .argument('[signal]', 'Signal name to show (e.g., SIGTERM, TERM, HUP)')
    .option('--json', 'Output as JSON')
    .option('--behaviors', 'Show behaviors instead of signals')
    .action(async (signal?: string, cmdOptions?: { json?: boolean; behaviors?: boolean }) => {
      try {
        if (cmdOptions?.behaviors) {
          // Show behaviors
          if (signal) {
            const behavior = await getBehavior(signal);
            if (!behavior) {
              console.error(`Behavior '${signal}' not found`);
              process.exit(exitCodes.EXIT_INVALID_ARGUMENT);
            }

            if (cmdOptions.json) {
              console.log(JSON.stringify(behavior, null, 2));
            } else {
              console.log(`Behavior: ${behavior.id}\n`);
              console.log(`  Name: ${behavior.name}`);
              console.log(`  Description: ${behavior.description}`);
              console.log(`  Phases: ${behavior.phases.join(', ')}`);
            }
          } else {
            // List all behaviors
            const behaviors = await listBehaviors();
            if (cmdOptions.json) {
              console.log(JSON.stringify(behaviors, null, 2));
            } else {
              console.log(`Found ${behaviors.length} behavior(s):\n`);
              for (const behavior of behaviors) {
                console.log(`  ${behavior.id}: ${behavior.description}`);
              }
            }
          }
          return;
        }

        // Show signals
        if (signal) {
          // Normalize signal name
          const normalizedSignal = signal.toUpperCase().startsWith('SIG')
            ? signal.toUpperCase()
            : `SIG${signal.toUpperCase()}`;

          const signalInfo = await getSignal(normalizedSignal);
          if (!signalInfo) {
            console.error(`Signal '${signal}' not found`);
            process.exit(exitCodes.EXIT_INVALID_ARGUMENT);
          }

          const supported = await supportsSignal(normalizedSignal);
          const caps = await getPlatformCapabilities();

          if (cmdOptions?.json) {
            console.log(
              JSON.stringify(
                {
                  ...signalInfo,
                  platform_supported: supported,
                  platform_capabilities: caps,
                },
                null,
                2,
              ),
            );
          } else {
            console.log(`Signal: ${signalInfo.name}\n`);
            console.log(`  Description: ${signalInfo.description}`);
            console.log(`  Number (POSIX): ${signalInfo.unix_number}`);
            console.log(`  Default Behavior: ${signalInfo.default_behavior}`);
            console.log(`  Exit Code: ${signalInfo.exit_code}`);
            console.log(`  Platform Supported: ${supported ? 'Yes' : 'No (use HTTP fallback)'}`);

            if (signalInfo.platform_overrides) {
              console.log(`\n  Platform Overrides:`);
              if (signalInfo.platform_overrides.darwin)
                console.log(`    macOS: ${JSON.stringify(signalInfo.platform_overrides.darwin)}`);
              if (signalInfo.platform_overrides.freebsd)
                console.log(
                  `    FreeBSD: ${JSON.stringify(signalInfo.platform_overrides.freebsd)}`,
                );
            }

            if (signalInfo.windows_fallback) {
              console.log(`\n  Windows Fallback:`);
              console.log(`    Log Level: ${signalInfo.windows_fallback.log_level}`);
              console.log(`    Telemetry Event: ${signalInfo.windows_fallback.telemetry_event}`);
              console.log(`    HTTP Operation: ${signalInfo.windows_fallback.operation_hint}`);
            }
          }
        } else {
          // List all signals
          const signals = await listSignals();
          const version = await getSignalsVersion();

          if (cmdOptions?.json) {
            console.log(JSON.stringify({ version, signals }, null, 2));
          } else {
            console.log(`Signal Catalog Version: ${version}\n`);
            console.log(`Found ${signals.length} signal(s):\n`);

            const caps = await getPlatformCapabilities();
            console.log(`Platform: ${caps.platform} (${caps.isPOSIX ? 'POSIX' : 'Windows'})`);
            console.log(
              `Signal Exit Codes: ${supportsSignalExitCodes() ? 'Supported' : 'Not supported'}\n`,
            );

            for (const sig of signals) {
              const supported = await supportsSignal(sig.name);
              const marker = supported ? '✓' : '✗';
              console.log(`  ${marker} ${sig.name} (${sig.unix_number}): ${sig.description}`);
            }
          }
        }
      } catch (error) {
        console.error('Error showing signal info:', (error as Error).message);
        process.exit(exitCodes.EXIT_FAILURE);
      }
    });

  // Validate signal config command
  program
    .command('validate')
    .description('Validate signal configuration file against schema')
    .argument('<file>', 'Signal configuration file to validate (YAML/JSON)')
    .option('--json', 'Output as JSON')
    .action(async (file: string, cmdOptions?: { json?: boolean }) => {
      try {
        // Read file content
        const content = await readFile(file, 'utf-8');
        let data: unknown;

        // Parse based on extension
        if (file.endsWith('.json')) {
          data = JSON.parse(content);
        } else if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          // Use dynamic import for yaml parsing
          const yaml = await import('yaml');
          data = yaml.parse(content);
        } else {
          throw new Error('Unsupported file format. Use .json, .yaml, or .yml');
        }

        // Validate against schema
        const { validateDataBySchemaId } = await import('../../schema/validator.js');
        const result = await validateDataBySchemaId(
          'library/foundry/v1.0.0/signals',
          data as string,
        );

        if (cmdOptions?.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          if (result.valid) {
            console.log('✓ Validation passed');
            process.exit(exitCodes.EXIT_SUCCESS);
          } else {
            console.error('✗ Validation failed:\n');
            if (result.diagnostics) {
              for (const diag of result.diagnostics) {
                console.error(`  ${diag.pointer}: ${diag.message}`);
              }
            }
            process.exit(exitCodes.EXIT_DATA_INVALID);
          }
        }
      } catch (error) {
        console.error('Error validating signal config:', (error as Error).message);
        process.exit(exitCodes.EXIT_FAILURE);
      }
    });

  // Platform capabilities command
  program
    .command('platform')
    .description('Show platform capabilities for signal handling')
    .option('--json', 'Output as JSON')
    .action(async (cmdOptions?: { json?: boolean }) => {
      try {
        const caps = await getPlatformCapabilities();
        const signalExitCodes = supportsSignalExitCodes();

        if (cmdOptions?.json) {
          console.log(
            JSON.stringify(
              {
                ...caps,
                supportsSignalExitCodes: signalExitCodes,
              },
              null,
              2,
            ),
          );
        } else {
          console.log('Platform Capabilities:\n');
          console.log(`  Platform: ${caps.platform}`);
          console.log(`  POSIX: ${caps.isPOSIX ? 'Yes' : 'No'}`);
          console.log(`  Windows: ${caps.isWindows ? 'Yes' : 'No'}`);
          console.log(`  Signal Exit Codes: ${signalExitCodes ? 'Supported' : 'Not supported'}`);

          if (caps.supportedSignals && caps.supportedSignals.length > 0) {
            console.log('\n  Supported Signals:');
            for (const signal of caps.supportedSignals) {
              console.log(`    ✓ ${signal}`);
            }
          }

          if (caps.unsupportedSignals && caps.unsupportedSignals.length > 0) {
            console.log('\n  Unsupported Signals (use HTTP fallback):');
            for (const signal of caps.unsupportedSignals) {
              console.log(`    ✗ ${signal}`);
            }
          }
        }
      } catch (error) {
        console.error('Error getting platform capabilities:', (error as Error).message);
        process.exit(exitCodes.EXIT_FAILURE);
      }
    });

  return program;
}

/**
 * Main CLI entry point
 */
export async function main(argv?: string[]): Promise<void> {
  const program = createSignalsCLI();
  await program.parseAsync(argv);
}

// Main entry point when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const program = createSignalsCLI();
  program.parse(process.argv);
}
