#!/usr/bin/env bun
/**
 * Post-publish verification for @fulmenhq/tsfulmen.
 *
 * Installs the package in a temporary directory, performs smoke tests on key APIs,
 * and ensures recent modules (signals, fulhash, appidentity) behave as expected.
 *
 * Usage:
 *   bunx tsx scripts/verify-published-package.ts          # verify latest
 *   bunx tsx scripts/verify-published-package.ts 0.1.5    # verify specific version
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

const PACKAGE_NAME = '@fulmenhq/tsfulmen';
const versionArg = process.argv[2] ?? 'latest';
const packageSpec = versionArg === 'latest' ? PACKAGE_NAME : `${PACKAGE_NAME}@${versionArg}`;

const tempDir = mkdtempSync(join(os.tmpdir(), 'verify-tsfulmen-'));
console.log('📁 Temporary directory:', tempDir);

function run(command: string, options: { cwd?: string; stdio?: 'pipe' | 'inherit' } = {}): string {
  const stdio = options.stdio ?? 'inherit';
  return execSync(command, { stdio, cwd: options.cwd });
}

let exitCode = 0;

try {
  process.chdir(tempDir);

  console.log('\n🔧 Initialising test project...');
  run('npm init -y', { stdio: 'ignore' });

  console.log(`📥 Installing ${packageSpec} ...`);
  run(`npm install ${packageSpec}`, { stdio: 'inherit' });

  const installedPkgJsonPath = join(
    tempDir,
    'node_modules',
    '@fulmenhq',
    'tsfulmen',
    'package.json',
  );
  const installedMeta = JSON.parse(readFileSync(installedPkgJsonPath, 'utf8')) as {
    version: string;
  };
  console.log('✅ Installed version:', installedMeta.version);

  console.log('\n🧪 Running smoke tests...');
  const testFile = join(tempDir, 'verify.mjs');
  const testCode = `
import assert from 'node:assert/strict';
import { VERSION } from '@fulmenhq/tsfulmen';
import { hash } from '@fulmenhq/tsfulmen/fulhash';
import { getSignalsVersion, createSignalManager, exitCodes, getExitCodeInfo } from '@fulmenhq/tsfulmen/foundry';
import { loadIdentity } from '@fulmenhq/tsfulmen/appidentity';

console.log('  - Checking package version export');
assert.equal(typeof VERSION, 'string');
assert.match(VERSION, /^\\d+\\.\\d+\\.\\d+/);

console.log('  - Smoke testing FulHash');
const digest = await hash('tsfulmen');
assert.equal(digest.hex.length, 32);

console.log('  - Validating exit code catalog');
assert.ok(exitCodes.EXIT_SUCCESS === 0);
assert.equal(getExitCodeInfo(143)?.name, 'EXIT_SIGNAL_TERM');

console.log('  - Validating signal catalog');
assert.equal(await getSignalsVersion(), 'v1.0.0');
const manager = createSignalManager({ testMode: true });
let invoked = false;
await manager.register('SIGTERM', () => {
  invoked = true;
});
await manager.trigger('SIGTERM');
assert.ok(invoked, 'Signal handler should have been invoked');

console.log('  - Testing app identity loader (test injection)');
const identity = await loadIdentity({
  identity: {
    app: {
      binary_name: 'testapp',
      vendor: 'testvendor',
      env_prefix: 'TESTAPP_',
      config_name: 'testapp',
      description: 'Test application',
    },
  },
});
assert.equal(identity.app.binary_name, 'testapp');

console.log('\\n✅ Smoke tests passed');
`;

  writeFileSync(testFile, testCode);
  run(`node ${testFile}`, { stdio: 'inherit', cwd: tempDir });
} catch (error) {
  console.error('\n❌ Package verification failed:', (error as Error).message);
  exitCode = 1;
} finally {
  console.log('\n🧹 Cleaning up...');
  try {
    process.chdir('/');
    rmSync(tempDir, { recursive: true, force: true });
    console.log('✅ Temporary directory removed');
  } catch (cleanupError) {
    console.error('⚠️ Cleanup warning:', (cleanupError as Error).message);
  }
}

console.log('');
if (exitCode === 0) {
  console.log('✅ Package verification PASSED');
} else {
  console.log('❌ Package verification FAILED');
}

process.exit(exitCode);
