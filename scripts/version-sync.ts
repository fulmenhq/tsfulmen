#!/usr/bin/env bun
/**
 * Sync VERSION file to package.json and other metadata files
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function syncVersion() {
  const versionFile = join(process.cwd(), 'VERSION');

  if (!existsSync(versionFile)) {
    console.error('❌ VERSION file not found');
    process.exit(1);
  }

  const version = readFileSync(versionFile, 'utf-8').trim();

  // Update package.json
  const packageJsonPath = join(process.cwd(), 'package.json');
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    packageJson.version = version;
    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
    console.log(`✅ Updated package.json to ${version}`);
  }

  // Update src/index.ts VERSION constant
  const srcIndexPath = join(process.cwd(), 'src', 'index.ts');
  if (existsSync(srcIndexPath)) {
    const srcIndex = readFileSync(srcIndexPath, 'utf-8');
    const updated = srcIndex.replace(
      /export const VERSION = '[^']+';/,
      `export const VERSION = '${version}';`,
    );
    if (updated !== srcIndex) {
      writeFileSync(srcIndexPath, updated);
      console.log(`✅ Updated src/index.ts VERSION constant to ${version}`);
    } else {
      console.log(`✓ src/index.ts VERSION already matches ${version}`);
    }
  }

  // Future: Update other files as needed (CHANGELOG, etc.)
}

syncVersion();
