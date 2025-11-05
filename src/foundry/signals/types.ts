/**
 * Signal Handling Types
 *
 * TypeScript type definitions for the Fulmen signal handling catalog
 * derived from schemas/library/foundry/v1.0.0/signals.schema.json
 */

/**
 * Signal behavior enumeration
 */
export type SignalBehavior =
  | 'graceful_shutdown'
  | 'graceful_shutdown_with_double_tap'
  | 'reload_via_restart'
  | 'immediate_exit'
  | 'custom'
  | 'observe_only';

/**
 * Windows fallback behavior types
 */
export type WindowsFallbackBehavior = 'http_admin_endpoint' | 'exception_handling' | 'timer_api';

/**
 * Log level enumeration for Windows fallback
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Platform support level
 */
export type PlatformSupportLevel = 'native' | 'mapped' | 'unsupported';

/**
 * Windows fallback metadata
 */
export interface WindowsFallback {
  fallback_behavior: WindowsFallbackBehavior;
  log_level: LogLevel;
  log_message: string;
  log_template: string;
  operation_hint: string;
  telemetry_event: string;
  telemetry_tags: Record<string, string>;
}

/**
 * Platform-specific signal number overrides
 */
export interface PlatformOverrides {
  darwin?: number;
  freebsd?: number;
}

/**
 * Individual signal definition
 */
export interface Signal {
  id: string;
  name: string;
  unix_number: number;
  platform_overrides?: PlatformOverrides;
  windows_event: string | null;
  windows_fallback?: WindowsFallback;
  description: string;
  default_behavior: SignalBehavior;
  exit_code: number;
  timeout_seconds?: number;
  cleanup_actions?: string[];
  double_tap_window_seconds?: number;
  double_tap_message?: string;
  double_tap_behavior?: 'immediate_exit';
  double_tap_exit_code?: number;
  reload_strategy?: 'restart_based';
  validation_required?: boolean;
  usage_notes?: string;
}

/**
 * Behavior phase definition
 */
export interface BehaviorPhase {
  name: string;
  description: string;
}

/**
 * Signal handling behavior definition
 */
export interface Behavior {
  id: string;
  name: string;
  description: string;
  phases: BehaviorPhase[];
}

/**
 * OS signal number mappings
 */
export interface OsMappings {
  unix: Record<string, number>;
  windows: Record<string, number>;
  platform_overrides?: {
    darwin?: Record<string, number>;
    freebsd?: Record<string, number>;
  };
  signal_to_event: Record<string, string | null>;
}

/**
 * Platform support matrix entry
 */
export interface PlatformSupport {
  signal: string;
  linux: PlatformSupportLevel;
  macos: PlatformSupportLevel;
  freebsd: PlatformSupportLevel;
  windows: PlatformSupportLevel;
  fallback?: WindowsFallbackBehavior;
  notes: string;
}

/**
 * Exit code mappings (128+N pattern)
 */
export interface ExitCodes {
  SIGTERM: number;
  SIGINT: number;
  SIGHUP: number;
  SIGQUIT: number;
  SIGPIPE: number;
  SIGALRM: number;
  SIGUSR1: number;
  SIGUSR2: number;
  note: string;
}

/**
 * Complete signal handling catalog
 */
export interface SignalCatalog {
  $schema: string;
  description: string;
  version: string;
  signals: Signal[];
  behaviors: Behavior[];
  os_mappings: OsMappings;
  platform_support: PlatformSupport[];
  exit_codes: ExitCodes;
}

/**
 * Signal lookup result
 */
export interface SignalInfo extends Signal {
  // Additional computed properties can be added here
}

/**
 * Behavior lookup result
 */
export interface BehaviorInfo extends Behavior {
  // Additional computed properties can be added here
}
