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
  exitCodes,
  exitCodeMetadata,
  getExitCodeInfo,
  EXIT_CODES_VERSION,
  type ExitCode,
  type ExitCodeName,
  type ExitCodeInfo,
} from "../../crucible/foundry/exitCodes.js";

// Export simplified mode helpers
export {
  SimplifiedMode,
  mapExitCodeToSimplified,
  getSimplifiedCodes,
  getSimplifiedCodeDescription,
} from "./simplified.js";

// Export capability detection helpers
export {
  supportsSignalExitCodes,
  getPlatform,
  isWindows,
  isPOSIX,
  getPlatformCapabilities,
  type PlatformCapabilities,
} from "./capabilities.js";
