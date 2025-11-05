/**
 * Signal Catalog Parity Tests
 *
 * Validates TSFulmen signal catalog implementation against Crucible parity snapshot
 * to ensure cross-language consistency with gofulmen and pyfulmen.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { getSignal, getSignalCatalog, listBehaviors, listSignals } from '../catalog.js';

// Load parity snapshot
const SNAPSHOT_PATH = join(
  __dirname,
  '../../../../config/crucible-ts/library/foundry/fixtures/signals/parity-snapshot.json',
);

interface ParitySnapshot {
  version: string;
  fixtures: {
    minimal: {
      signals_count: number;
      required_signals: string[];
      behaviors_count: number;
    };
    complete: {
      signals_count: number;
      all_signals: string[];
      behaviors_count: number;
      has_platform_overrides: boolean;
      has_custom_handlers: boolean;
      has_double_tap: boolean;
      has_reload_strategy: boolean;
    };
    custom_behavior: {
      signals_count: number;
      signals: string[];
      custom_signals: string[];
      behaviors_count: number;
      platform_override_signals: string[];
    };
  };
  test_expectations: {
    signal_validation: {
      required_fields: string[];
      optional_fields: string[];
      valid_behaviors: string[];
      exit_code_range: { min: number; max: number };
      signal_number_range: { min: number; max: number };
    };
    behavior_validation: {
      required_fields: string[];
      phase_required_fields: string[];
    };
    exit_code_mapping: Record<string, number>;
    platform_override_signals: Record<string, Record<string, number>>;
  };
}

let paritySnapshot: ParitySnapshot;

describe('Signal Catalog Parity Tests', () => {
  test('load parity snapshot', async () => {
    const content = await readFile(SNAPSHOT_PATH, 'utf-8');
    paritySnapshot = JSON.parse(content);
    expect(paritySnapshot).toBeDefined();
    expect(paritySnapshot.version).toBe('v1.0.0');
  });

  test('catalog version matches snapshot', async () => {
    const content = await readFile(SNAPSHOT_PATH, 'utf-8');
    paritySnapshot = JSON.parse(content);
    const catalog = await getSignalCatalog();
    expect(catalog.version).toBe(paritySnapshot.version);
  });

  describe('Signal Structure Validation', () => {
    test('all required signals present', async () => {
      const content = await readFile(SNAPSHOT_PATH, 'utf-8');
      paritySnapshot = JSON.parse(content);
      const signals = await listSignals();
      const signalNames = signals.map((s) => s.name);

      const expectedSignals = paritySnapshot.fixtures.complete.all_signals;
      for (const expectedSignal of expectedSignals) {
        expect(signalNames).toContain(expectedSignal);
      }
    });

    test('signal count matches complete fixture', async () => {
      const content = await readFile(SNAPSHOT_PATH, 'utf-8');
      paritySnapshot = JSON.parse(content);
      const signals = await listSignals();
      expect(signals.length).toBe(paritySnapshot.fixtures.complete.signals_count);
    });

    test('all signals have required fields', async () => {
      const content = await readFile(SNAPSHOT_PATH, 'utf-8');
      paritySnapshot = JSON.parse(content);
      const signals = await listSignals();
      const requiredFields = paritySnapshot.test_expectations.signal_validation.required_fields;

      for (const signal of signals) {
        for (const field of requiredFields) {
          expect(signal).toHaveProperty(field);
          expect((signal as unknown as Record<string, unknown>)[field]).toBeDefined();
        }
      }
    });

    test('signal behaviors are valid', async () => {
      const content = await readFile(SNAPSHOT_PATH, 'utf-8');
      paritySnapshot = JSON.parse(content);
      const signals = await listSignals();
      const validBehaviors = paritySnapshot.test_expectations.signal_validation.valid_behaviors;

      for (const signal of signals) {
        expect(validBehaviors).toContain(signal.default_behavior);
      }
    });

    test('exit codes within valid range', async () => {
      const content = await readFile(SNAPSHOT_PATH, 'utf-8');
      paritySnapshot = JSON.parse(content);
      const signals = await listSignals();
      const { min, max } = paritySnapshot.test_expectations.signal_validation.exit_code_range;

      for (const signal of signals) {
        expect(signal.exit_code).toBeGreaterThanOrEqual(min);
        expect(signal.exit_code).toBeLessThanOrEqual(max);
      }
    });

    test('unix signal numbers within valid range', async () => {
      const content = await readFile(SNAPSHOT_PATH, 'utf-8');
      paritySnapshot = JSON.parse(content);
      const signals = await listSignals();
      const { min, max } = paritySnapshot.test_expectations.signal_validation.signal_number_range;

      for (const signal of signals) {
        expect(signal.unix_number).toBeGreaterThanOrEqual(min);
        expect(signal.unix_number).toBeLessThanOrEqual(max);
      }
    });
  });

  describe('Exit Code Mappings', () => {
    test('exit codes match POSIX 128+N pattern', async () => {
      const content = await readFile(SNAPSHOT_PATH, 'utf-8');
      paritySnapshot = JSON.parse(content);
      const exitCodeMapping = paritySnapshot.test_expectations.exit_code_mapping;

      for (const [signalName, expectedExitCode] of Object.entries(exitCodeMapping)) {
        const signal = await getSignal(signalName);
        expect(signal, `Signal ${signalName} should exist`).not.toBeNull();
        expect(signal?.exit_code, `Exit code for ${signalName}`).toBe(expectedExitCode);
      }
    });
  });

  describe('Platform Overrides', () => {
    test('SIGUSR1/SIGUSR2 have platform-specific numbers', async () => {
      const content = await readFile(SNAPSHOT_PATH, 'utf-8');
      paritySnapshot = JSON.parse(content);
      const platformOverrides = paritySnapshot.test_expectations.platform_override_signals;

      for (const [signalName, platforms] of Object.entries(platformOverrides)) {
        const signal = await getSignal(signalName);
        expect(signal, `Signal ${signalName} should exist`).not.toBeNull();

        if (signal?.platform_overrides) {
          if (platforms.darwin) {
            expect(signal.platform_overrides.darwin).toBe(platforms.darwin);
          }
          if (platforms.freebsd) {
            expect(signal.platform_overrides.freebsd).toBe(platforms.freebsd);
          }
        }

        // Unix number should match Linux standard
        expect(signal?.unix_number).toBe(platforms.linux);
      }
    });
  });

  describe('Behavior Structure Validation', () => {
    test('behavior count matches complete fixture', async () => {
      const content = await readFile(SNAPSHOT_PATH, 'utf-8');
      paritySnapshot = JSON.parse(content);
      const behaviors = await listBehaviors();
      expect(behaviors.length).toBe(paritySnapshot.fixtures.complete.behaviors_count);
    });

    test('all behaviors have required fields', async () => {
      const content = await readFile(SNAPSHOT_PATH, 'utf-8');
      paritySnapshot = JSON.parse(content);
      const behaviors = await listBehaviors();
      const requiredFields = paritySnapshot.test_expectations.behavior_validation.required_fields;

      for (const behavior of behaviors) {
        for (const field of requiredFields) {
          expect(behavior).toHaveProperty(field);
          expect((behavior as unknown as Record<string, unknown>)[field]).toBeDefined();
        }
      }
    });

    test('behavior phases have required fields', async () => {
      const content = await readFile(SNAPSHOT_PATH, 'utf-8');
      paritySnapshot = JSON.parse(content);
      const behaviors = await listBehaviors();
      const phaseRequiredFields =
        paritySnapshot.test_expectations.behavior_validation.phase_required_fields;

      for (const behavior of behaviors) {
        expect(behavior.phases).toBeDefined();
        expect(Array.isArray(behavior.phases)).toBe(true);
        expect(behavior.phases.length).toBeGreaterThan(0);

        for (const phase of behavior.phases) {
          for (const field of phaseRequiredFields) {
            expect(phase).toHaveProperty(field);
            expect((phase as unknown as Record<string, unknown>)[field]).toBeDefined();
          }
        }
      }
    });
  });

  describe('Windows Fallback Metadata', () => {
    test('unsupported Windows signals have fallback metadata', async () => {
      const signals = await listSignals();

      const windowsUnsupportedSignals = signals.filter(
        (s) => s.windows_event === null && s.windows_fallback,
      );

      for (const signal of windowsUnsupportedSignals) {
        expect(signal.windows_fallback).toBeDefined();
        expect(signal.windows_fallback?.fallback_behavior).toBeDefined();
        expect(signal.windows_fallback?.log_level).toBe('INFO');
        expect(signal.windows_fallback?.log_message).toBeDefined();
        expect(signal.windows_fallback?.log_template).toBeDefined();
        expect(signal.windows_fallback?.operation_hint).toBeDefined();
        expect(signal.windows_fallback?.telemetry_event).toBe('fulmen.signal.unsupported');
        expect(signal.windows_fallback?.telemetry_tags).toBeDefined();
        expect(signal.windows_fallback?.telemetry_tags.signal).toBe(signal.name);
        expect(signal.windows_fallback?.telemetry_tags.platform).toBe('windows');
      }
    });
  });

  describe('Special Signal Behaviors', () => {
    test('SIGINT has double-tap configuration', async () => {
      const sigint = await getSignal('SIGINT');
      expect(sigint).not.toBeNull();
      expect(sigint?.default_behavior).toBe('graceful_shutdown_with_double_tap');
      expect(sigint?.double_tap_window_seconds).toBe(2);
      expect(sigint?.double_tap_message).toBeDefined();
      expect(sigint?.double_tap_behavior).toBe('immediate_exit');
      expect(sigint?.double_tap_exit_code).toBe(130);
    });

    test('SIGHUP has reload configuration', async () => {
      const sighup = await getSignal('SIGHUP');
      expect(sighup).not.toBeNull();
      expect(sighup?.default_behavior).toBe('reload_via_restart');
      expect(sighup?.reload_strategy).toBe('restart_based');
      expect(sighup?.validation_required).toBe(true);
    });

    test('SIGTERM has graceful shutdown configuration', async () => {
      const sigterm = await getSignal('SIGTERM');
      expect(sigterm).not.toBeNull();
      expect(sigterm?.default_behavior).toBe('graceful_shutdown');
      expect(sigterm?.timeout_seconds).toBe(30);
      expect(sigterm?.cleanup_actions).toBeDefined();
      expect(Array.isArray(sigterm?.cleanup_actions)).toBe(true);
    });
  });
});
