/**
 * Demonstrate that path resolution works correctly from different contexts
 * This simulates how the module would work when installed as a package
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadPatternCatalog } from '../loader.js';

describe('Path Resolution Verification', () => {
  it('should resolve paths relative to module file using import.meta.url', async () => {
    // This test verifies that our path resolution strategy works correctly
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Construct the expected path the same way our loader does
    // The test file is in src/foundry/__tests__/ so we need to go up 3 levels to project root
    const expectedPath = join(
      __dirname,
      '../../../config/crucible-ts/library/foundry/patterns.yaml',
    );

    // Verify the file exists at the resolved path
    const content = await readFile(expectedPath, 'utf-8');
    expect(content).toBeDefined();
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain('patterns:');

    console.log('✅ Path resolution verified - file exists at:', expectedPath);
  });

  it('should load catalog from resolved paths', async () => {
    // Test that the loader actually works with the resolved paths
    const catalog = await loadPatternCatalog();

    expect(catalog).toBeDefined();
    expect(catalog.patterns).toBeDefined();
    expect(catalog.patterns.length).toBeGreaterThan(0);

    // Verify we can access actual pattern data
    const firstPattern = catalog.patterns[0];
    expect(firstPattern.id).toBeDefined();
    expect(firstPattern.name).toBeDefined();
    expect(firstPattern.pattern).toBeDefined();

    console.log('✅ Catalog loaded successfully from resolved paths');
    console.log(`   First pattern: ${firstPattern.id} - ${firstPattern.name}`);
  });

  it('should handle different working directories correctly', async () => {
    // This test simulates the module being used from different working directories
    // The key insight is that import.meta.url always gives us the correct module location

    const currentCwd = process.cwd();

    // Change to a different directory (simulating package installation)
    const testDir = '/tmp';
    process.chdir(testDir);

    try {
      // The loader should still work because it uses import.meta.url, not process.cwd()
      const catalog = await loadPatternCatalog();
      expect(catalog).toBeDefined();
      expect(catalog.patterns.length).toBeGreaterThan(0);

      console.log('✅ Module works correctly even when CWD is different');
      console.log(`   Original CWD: ${currentCwd}`);
      console.log(`   Test CWD: ${testDir}`);
      console.log(`   Patterns loaded: ${catalog.patterns.length}`);
    } finally {
      // Restore original working directory
      process.chdir(currentCwd);
    }
  });
});
