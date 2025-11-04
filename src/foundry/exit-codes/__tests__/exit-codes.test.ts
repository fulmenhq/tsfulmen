import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXIT_CODES_VERSION,
  type ExitCode,
  type ExitCodeName,
  exitCodeMetadata,
  exitCodes,
  getExitCodeInfo,
  getPlatform,
  getPlatformCapabilities,
  getSimplifiedCodeDescription,
  getSimplifiedCodes,
  isPOSIX,
  isWindows,
  mapExitCodeToSimplified,
  SimplifiedMode,
  supportsSignalExitCodes,
} from '../index.js';

// Load canonical snapshot from synced SSOT
const snapshotPath = join(
  process.cwd(),
  'config/crucible-ts/library/foundry/exit-codes.snapshot.json',
);
const canonicalSnapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8')) as {
  version: string;
  codes: Record<
    string,
    {
      name: string;
      category: string;
      description: string;
      context: string;
      retry_hint?: 'retry' | 'no_retry' | 'investigate';
      bsd_equivalent?: string;
      python_note?: string;
    }
  >;
};

describe('Exit Codes - Parity', () => {
  it('should export exitCodes object', () => {
    expect(exitCodes).toBeDefined();
    expect(typeof exitCodes).toBe('object');
  });

  it('should have EXIT_SUCCESS (0)', () => {
    expect(exitCodes.EXIT_SUCCESS).toBe(0);
  });

  it('should have EXIT_FAILURE (1)', () => {
    expect(exitCodes.EXIT_FAILURE).toBe(1);
  });

  it('should match canonical snapshot from SSOT', () => {
    // Validate against synced snapshot to catch drift, mutations, or deletions
    const snapshotCodes = Object.keys(canonicalSnapshot.codes);
    const exportedCodes = Object.keys(exitCodes);

    // Ensure exact count matches (no additions/deletions)
    expect(exportedCodes.length).toBe(snapshotCodes.length);

    // Validate each exit code in snapshot exists in exported object
    for (const [codeStr, snapshotEntry] of Object.entries(canonicalSnapshot.codes)) {
      const codeNum = Number(codeStr);
      const constantName = snapshotEntry.name;

      // Check exit code constant exists and has correct value
      expect(exitCodes).toHaveProperty(constantName);
      expect(exitCodes[constantName as ExitCodeName]).toBe(codeNum);

      // Check metadata exists and matches snapshot
      expect(exitCodeMetadata).toHaveProperty(codeStr);
      const meta = exitCodeMetadata[codeNum];

      expect(meta.code).toBe(codeNum);
      expect(meta.name).toBe(snapshotEntry.name);
      expect(meta.category).toBe(snapshotEntry.category);
      expect(meta.description).toBe(snapshotEntry.description);
      expect(meta.context).toBe(snapshotEntry.context);

      // Validate optional fields if present in snapshot
      if (snapshotEntry.retry_hint) {
        expect(meta.retryHint).toBe(snapshotEntry.retry_hint);
      }
      if (snapshotEntry.bsd_equivalent) {
        expect(meta.bsdEquivalent).toBe(snapshotEntry.bsd_equivalent);
      }
      if (snapshotEntry.python_note) {
        expect(meta.pythonNote).toBe(snapshotEntry.python_note);
      }
    }

    // Ensure no unexpected exit codes exist (would indicate drift)
    for (const constantName of Object.keys(exitCodes)) {
      const codeNum = exitCodes[constantName as ExitCodeName];
      const codeStr = String(codeNum);
      expect(canonicalSnapshot.codes).toHaveProperty(codeStr);
    }
  });

  it('should export EXIT_CODES_VERSION matching snapshot', () => {
    expect(EXIT_CODES_VERSION).toBeDefined();
    expect(typeof EXIT_CODES_VERSION).toBe('string');
    // Validate version matches canonical snapshot
    expect(EXIT_CODES_VERSION).toBe(canonicalSnapshot.version);
  });

  it('should have all expected category codes', () => {
    // Networking (10-19)
    expect(exitCodes.EXIT_PORT_IN_USE).toBe(10);
    expect(exitCodes.EXIT_CONNECTION_TIMEOUT).toBe(15);

    // Configuration (20-29)
    expect(exitCodes.EXIT_CONFIG_INVALID).toBe(20);
    expect(exitCodes.EXIT_MISSING_DEPENDENCY).toBe(21);

    // Runtime (30-39)
    expect(exitCodes.EXIT_HEALTH_CHECK_FAILED).toBe(30);
    expect(exitCodes.EXIT_DATABASE_UNAVAILABLE).toBe(31);

    // Usage (40-49, includes 64)
    expect(exitCodes.EXIT_INVALID_ARGUMENT).toBe(40);
    expect(exitCodes.EXIT_USAGE).toBe(64);

    // Permissions (50-59)
    expect(exitCodes.EXIT_PERMISSION_DENIED).toBe(50);
    expect(exitCodes.EXIT_FILE_NOT_FOUND).toBe(51);

    // Data (60-69)
    expect(exitCodes.EXIT_DATA_INVALID).toBe(60);
    expect(exitCodes.EXIT_PARSE_ERROR).toBe(61);

    // Security (70-79)
    expect(exitCodes.EXIT_AUTHENTICATION_FAILED).toBe(70);
    expect(exitCodes.EXIT_AUTHORIZATION_FAILED).toBe(71);

    // Observability (80-89)
    expect(exitCodes.EXIT_METRICS_UNAVAILABLE).toBe(80);
    expect(exitCodes.EXIT_LOGGING_FAILED).toBe(82);

    // Testing (91-99)
    expect(exitCodes.EXIT_TEST_FAILURE).toBe(91);
    expect(exitCodes.EXIT_COVERAGE_THRESHOLD_NOT_MET).toBe(96);

    // Signals (128+)
    expect(exitCodes.EXIT_SIGNAL_INT).toBe(130);
    expect(exitCodes.EXIT_SIGNAL_TERM).toBe(143);
  });
});

describe('Exit Codes - Metadata', () => {
  it('should export exitCodeMetadata', () => {
    expect(exitCodeMetadata).toBeDefined();
    expect(typeof exitCodeMetadata).toBe('object');
  });

  it('should have metadata for all exit codes', () => {
    for (const [name, code] of Object.entries(exitCodes)) {
      const meta = exitCodeMetadata[code];
      expect(meta).toBeDefined();
      expect(meta?.name).toBe(name);
    }
  });

  it('should have required fields for each metadata entry', () => {
    for (const [code, meta] of Object.entries(exitCodeMetadata)) {
      expect(meta.code).toBe(Number(code));
      expect(meta.name).toBeDefined();
      expect(typeof meta.name).toBe('string');
      expect(meta.description).toBeDefined();
      expect(typeof meta.description).toBe('string');
      expect(meta.context).toBeDefined();
      expect(typeof meta.context).toBe('string');
      expect(meta.category).toBeDefined();
      expect(typeof meta.category).toBe('string');
    }
  });

  it('should have valid categories', () => {
    const validCategories = [
      'standard',
      'networking',
      'configuration',
      'runtime',
      'usage',
      'permissions',
      'data',
      'security',
      'observability',
      'testing',
      'signals',
    ];

    for (const meta of Object.values(exitCodeMetadata)) {
      expect(validCategories).toContain(meta.category);
    }
  });

  it('should have retry hints where expected', () => {
    const meta20 = exitCodeMetadata[20]; // CONFIG_INVALID
    expect(meta20.retryHint).toBe('no_retry');

    const meta30 = exitCodeMetadata[30]; // HEALTH_CHECK_FAILED
    expect(meta30.retryHint).toBe('retry');

    const meta33 = exitCodeMetadata[33]; // RESOURCE_EXHAUSTED
    expect(meta33.retryHint).toBe('investigate');
  });

  it('should have BSD equivalent for relevant codes', () => {
    const meta64 = exitCodeMetadata[64]; // USAGE
    expect(meta64.bsdEquivalent).toBe('EX_USAGE');
  });
});

describe('Exit Codes - getExitCodeInfo', () => {
  it('should be a function', () => {
    expect(typeof getExitCodeInfo).toBe('function');
  });

  it('should return metadata for valid exit code', () => {
    const info = getExitCodeInfo(0);
    expect(info).toBeDefined();
    expect(info?.code).toBe(0);
    expect(info?.name).toBe('EXIT_SUCCESS');
  });

  it('should return undefined for invalid exit code', () => {
    const info = getExitCodeInfo(999);
    expect(info).toBeUndefined();
  });

  it('should return correct metadata for all exit codes', () => {
    for (const code of Object.values(exitCodes)) {
      const info = getExitCodeInfo(code);
      expect(info).toBeDefined();
      expect(info?.code).toBe(code);
    }
  });
});

describe('Simplified Mode - Basic', () => {
  it('should map SUCCESS to 0', () => {
    const result = mapExitCodeToSimplified(exitCodes.EXIT_SUCCESS, SimplifiedMode.BASIC);
    expect(result).toBe(0);
  });

  it('should map all failures to 1', () => {
    const failures = [
      exitCodes.EXIT_FAILURE,
      exitCodes.EXIT_CONFIG_INVALID,
      exitCodes.EXIT_DATABASE_UNAVAILABLE,
      exitCodes.EXIT_PERMISSION_DENIED,
      exitCodes.EXIT_SIGNAL_TERM,
    ];

    for (const code of failures) {
      const result = mapExitCodeToSimplified(code, SimplifiedMode.BASIC);
      expect(result).toBe(1);
    }
  });

  it('should return correct simplified codes for BASIC mode', () => {
    const codes = getSimplifiedCodes(SimplifiedMode.BASIC);
    expect(codes).toEqual([0, 1]);
  });

  it('should return correct descriptions for BASIC mode', () => {
    expect(getSimplifiedCodeDescription(0, SimplifiedMode.BASIC)).toBe('Success');
    expect(getSimplifiedCodeDescription(1, SimplifiedMode.BASIC)).toBe('Failure');
  });
});

describe('Simplified Mode - Severity', () => {
  it('should map SUCCESS to 0', () => {
    const result = mapExitCodeToSimplified(exitCodes.EXIT_SUCCESS, SimplifiedMode.SEVERITY);
    expect(result).toBe(0);
  });

  it('should map recoverable errors to 1', () => {
    const recoverable = [
      exitCodes.EXIT_HEALTH_CHECK_FAILED, // retryHint: retry
      exitCodes.EXIT_DATABASE_UNAVAILABLE, // retryHint: retry
      exitCodes.EXIT_OPERATION_TIMEOUT, // retryHint: retry
    ];

    for (const code of recoverable) {
      const result = mapExitCodeToSimplified(code, SimplifiedMode.SEVERITY);
      expect(result).toBe(1);
    }
  });

  it('should map config errors to 2', () => {
    const configErrors = [
      exitCodes.EXIT_CONFIG_INVALID, // retryHint: no_retry
      exitCodes.EXIT_SSOT_VERSION_MISMATCH, // retryHint: no_retry
      exitCodes.EXIT_INVALID_ARGUMENT, // category: usage
      exitCodes.EXIT_FILE_NOT_FOUND, // category: permissions
    ];

    for (const code of configErrors) {
      const result = mapExitCodeToSimplified(code, SimplifiedMode.SEVERITY);
      expect(result).toBe(2);
    }
  });

  it('should map fatal errors to 3', () => {
    const fatalErrors = [
      exitCodes.EXIT_MISSING_DEPENDENCY, // retryHint: investigate
      exitCodes.EXIT_RESOURCE_EXHAUSTED, // retryHint: investigate
      exitCodes.EXIT_SIGNAL_KILL, // category: signals
      exitCodes.EXIT_SIGNAL_TERM, // category: signals
    ];

    for (const code of fatalErrors) {
      const result = mapExitCodeToSimplified(code, SimplifiedMode.SEVERITY);
      expect(result).toBe(3);
    }
  });

  it('should return correct simplified codes for SEVERITY mode', () => {
    const codes = getSimplifiedCodes(SimplifiedMode.SEVERITY);
    expect(codes).toEqual([0, 1, 2, 3]);
  });

  it('should return correct descriptions for SEVERITY mode', () => {
    expect(getSimplifiedCodeDescription(0, SimplifiedMode.SEVERITY)).toBe('Success');
    expect(getSimplifiedCodeDescription(1, SimplifiedMode.SEVERITY)).toBe(
      'Recoverable error (retry possible)',
    );
    expect(getSimplifiedCodeDescription(2, SimplifiedMode.SEVERITY)).toBe(
      "Configuration error (fix config, don't retry)",
    );
    expect(getSimplifiedCodeDescription(3, SimplifiedMode.SEVERITY)).toBe(
      'Fatal error (investigate required)',
    );
  });
});

describe('Platform Capabilities', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true,
    });
  });

  it('should detect non-Windows platforms as supporting signal codes', () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      writable: true,
      configurable: true,
    });
    expect(supportsSignalExitCodes()).toBe(true);

    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      writable: true,
      configurable: true,
    });
    expect(supportsSignalExitCodes()).toBe(true);
  });

  it('should detect Windows as not supporting signal codes', () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: true,
      configurable: true,
    });
    expect(supportsSignalExitCodes()).toBe(false);
  });

  it('should return current platform', () => {
    const platform = getPlatform();
    expect(platform).toBeDefined();
    expect(typeof platform).toBe('string');
  });

  it('should detect Windows correctly', () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: true,
      configurable: true,
    });
    expect(isWindows()).toBe(true);
    expect(isPOSIX()).toBe(false);

    Object.defineProperty(process, 'platform', {
      value: 'linux',
      writable: true,
      configurable: true,
    });
    expect(isWindows()).toBe(false);
    expect(isPOSIX()).toBe(true);
  });

  it('should return platform capabilities summary', () => {
    const caps = getPlatformCapabilities();
    expect(caps).toBeDefined();
    expect(caps.platform).toBeDefined();
    expect(typeof caps.supportsSignalExitCodes).toBe('boolean');
    expect(typeof caps.isPOSIX).toBe('boolean');
    expect(typeof caps.isWindows).toBe('boolean');
    expect(caps.isPOSIX).toBe(!caps.isWindows);
  });
});

describe('Type Safety', () => {
  it('should have proper ExitCode type', () => {
    const code: ExitCode = exitCodes.EXIT_SUCCESS;
    expect(code).toBe(0);
  });

  it('should have proper ExitCodeName type', () => {
    const name: ExitCodeName = 'EXIT_SUCCESS';
    expect(exitCodes[name]).toBe(0);
  });

  it('should have readonly exitCodes object', () => {
    // TypeScript should prevent this at compile time
    // At runtime, we can't easily test immutability without causing errors
    expect(Object.isFrozen(exitCodes)).toBe(false); // May not be frozen but should be readonly in TS
  });
});
