/**
 * Exit Codes Module
 *
 * Standardized process exit codes for the Fulmen ecosystem.
 * Generated from Crucible catalog and synced via make sync-ssot.
 *
 * @module foundry/exit-codes
 */

// Re-export generated exit codes from crucible foundry
export {
  EXIT_CODES_VERSION,
  type ExitCode,
  type ExitCodeInfo,
  type ExitCodeName,
  exitCodeMetadata,
  exitCodes,
  getExitCodeInfo,
} from '../../crucible/foundry/exitCodes.js';
// Export capability detection helpers
export {
  getPlatform,
  getPlatformCapabilities,
  isPOSIX,
  isWindows,
  type PlatformCapabilities,
  supportsSignalExitCodes,
} from './capabilities.js';
// Export simplified mode helpers
export {
  getSimplifiedCodeDescription,
  getSimplifiedCodes,
  mapExitCodeToSimplified,
  SimplifiedMode,
} from './simplified.js';
