import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { findByExtensions, findConfigFiles, findSchemaFiles } from '../convenience.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_ROOT = path.join(__dirname, 'fixtures');
const CONVENIENCE_FIXTURE = path.join(FIXTURES_ROOT, 'convenience');

function relativePaths(results: Awaited<ReturnType<typeof findConfigFiles>>): string[] {
  return results.map((result) => result.relativePath).sort();
}

describe('Pathfinder Convenience Helpers', () => {
  it('should find configuration files with default extensions', async () => {
    const results = await findConfigFiles(path.join(CONVENIENCE_FIXTURE, 'config'));
    expect(relativePaths(results)).toEqual(['app.yaml', 'settings.json']);
  });

  it('should find schema files using standard patterns', async () => {
    const results = await findSchemaFiles(CONVENIENCE_FIXTURE);
    expect(relativePaths(results)).toEqual([
      'schemas/legacy.schema.yaml',
      'schemas/service.schema.json',
    ]);
  });

  it('should find files by extensions', async () => {
    const results = await findByExtensions(CONVENIENCE_FIXTURE, ['ts']);
    expect(relativePaths(results)).toEqual(['src/index.ts']);
  });
});
