#!/usr/bin/env bun
/**
 * Verify Signals Parity Script
 *
 * Validates that TSFulmen's signal catalog can be loaded and has expected structure.
 * Detailed parity tests are in src/foundry/signals/__tests__/parity.test.ts
 */

import { exitCodes } from '../src/foundry/exit-codes/index.js';
import { getSignalCatalog, getSignalsVersion } from '../src/foundry/signals/catalog.js';

async function main() {
  console.log('Verifying signals catalog integrity...\n');

  try {
    const version = await getSignalsVersion();
    const catalog = await getSignalCatalog();

    console.log(`✓ Version: ${version}`);
    console.log(`✓ Signals loaded: ${catalog.signals.length}`);
    console.log(`✓ Behaviors loaded: ${catalog.behaviors.length}`);

    // Verify expected signals are present
    const expectedSignals = ['SIGTERM', 'SIGINT', 'SIGHUP', 'SIGQUIT', 'SIGPIPE', 'SIGALRM', 'SIGUSR1', 'SIGUSR2'];
    const missingSignals = expectedSignals.filter(
      name => !catalog.signals.find(s => s.name === name)
    );

    if (missingSignals.length > 0) {
      console.error(`❌ Missing expected signals: ${missingSignals.join(', ')}`);
      process.exit(exitCodes.EXIT_DATA_INVALID);
    }

    console.log(`✓ All expected signals present`);

    // Verify expected behaviors (use actual IDs from catalog)
    const expectedBehaviors = [
      'graceful_shutdown',
      'graceful_shutdown_with_double_tap',
      'reload_via_restart',
      'immediate_exit',
      'custom',
      'observe_only'
    ];
    const missingBehaviors = expectedBehaviors.filter(
      id => !catalog.behaviors.find(b => b.id === id)
    );

    if (missingBehaviors.length > 0) {
      console.error(`❌ Missing expected behaviors: ${missingBehaviors.join(', ')}`);
      process.exit(exitCodes.EXIT_DATA_INVALID);
    }

    console.log(`✓ All expected behaviors present`);

    // Verify each signal has required properties
    for (const signal of catalog.signals) {
      if (!signal.name || !signal.description || !signal.default_behavior) {
        console.error(`❌ Signal ${signal.name || 'unknown'} missing required properties`);
        process.exit(exitCodes.EXIT_DATA_INVALID);
      }
    }

    console.log(`✓ All signals have required properties`);

    console.log('\n✅ Signal catalog integrity check passed');
    console.log('Note: Detailed parity tests run in test suite (src/foundry/signals/__tests__/parity.test.ts)');
    process.exit(exitCodes.EXIT_SUCCESS);
  } catch (error) {
    console.error('Error verifying signals catalog:', (error as Error).message);
    process.exit(exitCodes.EXIT_FAILURE);
  }
}

main();
