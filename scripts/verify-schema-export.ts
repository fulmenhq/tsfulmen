/**
 * Schema export verification script
 *
 * Exports a representative schema with provenance metadata, strips the
 * provenance block, and compares the result against the runtime registry
 * copy to detect drift.
 */

import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { exitCodes } from '../src/foundry/index.js';
import { exportSchema, stripProvenance } from '../src/schema/export.js';
import { compareSchemas } from '../src/schema/normalizer.js';
import { getSchema } from '../src/schema/registry.js';

const TEST_SCHEMA_ID = 'library/foundry/v1.0.0/exit-codes';

async function main(): Promise<void> {
  const tmpPath = join(tmpdir(), `verify-schema-export-${Date.now()}.json`);

  try {
    console.log('🔍 Verifying schema export parity...');
    console.log(`   Schema: ${TEST_SCHEMA_ID}`);

    const exportResult = await exportSchema({
      schemaId: TEST_SCHEMA_ID,
      outPath: tmpPath,
      includeProvenance: true,
      validate: true,
    });

    console.log('✅ Export succeeded');
    console.log(`   Format: ${exportResult.format}`);
    console.log(`   Provenance: ${exportResult.includeProvenance}`);

    const exportedContent = await readFile(tmpPath, 'utf-8');
    const strippedContent = stripProvenance(exportedContent);

    const schemaMetadata = await getSchema(TEST_SCHEMA_ID);
    const runtimeContent = await readFile(schemaMetadata.path, 'utf-8');

    const comparison = compareSchemas(strippedContent, runtimeContent);

    if (comparison.equal) {
      console.log('✅ Parity check passed: exported schema matches runtime schema');
      process.exit(exitCodes.EXIT_SUCCESS);
    } else {
      console.error('❌ Parity check failed: exported schema differs from runtime schema');
      console.error('   Exported (normalized):');
      console.error(comparison.normalizedA.substring(0, 200));
      console.error('   Runtime (normalized):');
      console.error(comparison.normalizedB.substring(0, 200));
      process.exit(exitCodes.EXIT_DATA_INVALID);
    }
  } catch (error) {
    console.error('❌ Verification failed:', (error as Error).message);
    process.exit(exitCodes.EXIT_FAILURE);
  } finally {
    await rm(tmpPath, { force: true });
  }
}

await main();
