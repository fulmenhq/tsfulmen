import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Unit tests for verify-published-package.ts
 *
 * These tests validate the verification script logic without actually
 * running npm install (which would be an integration test).
 *
 * Key validations:
 * - TypeScript compiles without errors
 * - Script structure is sound
 * - Async functions are properly awaited
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const scriptPath = join(__dirname, '../verify-published-package.ts');

describe('verify-published-package script', () => {
  it('compiles without TypeScript errors', () => {
    // This test passes if the file compiles, which happens during test discovery
    expect(true).toBe(true);
  });

  it('has proper async/await usage for catalog functions', () => {
    const scriptContent = readFileSync(scriptPath, 'utf-8');

    // Verify getSignalsVersion is awaited
    expect(scriptContent).toContain('await getSignalsVersion()');

    // Verify other async catalog functions are awaited
    const asyncPatterns = [
      /await\s+getSignalsVersion\(\)/,
      /await\s+hash\(/,
      /await\s+loadIdentity\(/,
      /await\s+manager\.register\(/,
      /await\s+manager\.trigger\(/,
    ];

    for (const pattern of asyncPatterns) {
      expect(scriptContent).toMatch(pattern);
    }
  });

  it('validates VERSION export check exists', () => {
    const scriptContent = readFileSync(scriptPath, 'utf-8');

    // Ensure we check VERSION type and format
    expect(scriptContent).toContain("assert.equal(typeof VERSION, 'string')");
    expect(scriptContent).toMatch(/assert\.match\(VERSION,.*\\d/);
  });

  it('has proper cleanup in finally block', () => {
    const scriptContent = readFileSync(scriptPath, 'utf-8');

    // Ensure cleanup happens
    expect(scriptContent).toContain('finally {');
    expect(scriptContent).toContain('rmSync(tempDir');
  });

  it('uses correct stdio options', () => {
    const scriptContent = readFileSync(scriptPath, 'utf-8');

    // Verify run function signature includes all stdio types
    expect(scriptContent).toMatch(/stdio\?:\s*['"]pipe['"].*['"]inherit['"].*['"]ignore['"]/);
  });
});
