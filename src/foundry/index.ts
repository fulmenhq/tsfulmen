/**
 * Foundry module - Main exports
 *
 * Provides ergonomic access to Crucible Foundry Pattern Catalog data including
 * patterns, HTTP status codes, MIME types, and country codes with Bun-first
 * implementation and comprehensive TypeScript support.
 */

export const VERSION = "0.1.1";

// Country Code catalog exports
export {
  clearCountryCodeCache,
  getCountryByAlpha2,
  getCountryByAlpha3,
  getCountryByNumeric,
  listCountries,
} from "./country-codes.js";
// Detection options type export
export type { DetectionOptions } from "./detector.js";
// Export error classes
export { FoundryCatalogError } from "./errors.js";
// Exit Codes catalog and helpers
export {
  EXIT_CODES_VERSION,
  type ExitCode,
  type ExitCodeInfo,
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
  type PlatformCapabilities,
  SimplifiedMode,
  supportsSignalExitCodes,
} from "./exit-codes/index.js";
// HTTP Status catalog exports
export {
  clearHttpStatusCache,
  getHttpStatus,
  getStatusReason,
  isClientError,
  isInformational,
  isRedirection,
  isServerError,
  isSuccess,
  listHttpStatuses,
} from "./http-statuses.js";
// Export loader functions
export {
  loadAllCatalogs,
  loadCountryCodeCatalog,
  loadHttpStatusCatalog,
  loadMimeTypeCatalog,
  loadPatternCatalog,
} from "./loader.js";
// MIME Type catalog exports
export {
  clearMimeTypeCache,
  detectMimeType,
  detectMimeTypeFromBuffer,
  detectMimeTypeFromFile,
  detectMimeTypeFromStream,
  getMimeType,
  getMimeTypeByExtension,
  isSupportedMimeType,
  listMimeTypes,
  matchMagicNumber,
} from "./mime-types.js";
// Pattern catalog exports
export {
  clearPatternCache,
  describePattern,
  getPattern,
  getPatternRegex,
  listPatterns,
  matchPattern,
} from "./patterns.js";
// Signal catalog and module exports
export {
  // Types
  type AuthHook,
  type AuthResult,
  type Behavior,
  type BehaviorInfo,
  type BehaviorPhase,
  type ConfigLoader,
  type ConfigReloadEndpointOptions,
  type ConfigReloadErrorResponse,
  type ConfigReloadOptions,
  type ConfigReloadRequest,
  type ConfigReloadResponse,
  type ConfigReloadResult,
  // Config reload
  ConfigReloadTracker,
  type ConfigValidationResult,
  type ConfigValidator,
  type ControlDiscoveryEndpointOptions,
  type ControlDiscoveryErrorResponse,
  type ControlDiscoveryResponse,
  type ControlEndpointDescriptor,
  // HTTP helper
  createBearerTokenAuth,
  createConfigReloadEndpoint,
  createConfigReloadHandler,
  createControlDiscoveryEndpoint,
  // Double-tap
  createDoubleTapTracker,
  createSignalEndpoint,
  // Manager
  createSignalManager,
  createSimpleRateLimiter,
  type DoubleTapConfig,
  type DoubleTapState,
  type ExitCodes,
  // Guards
  ensurePOSIX,
  ensureSignalExitCodesSupported,
  ensureSupported,
  ensureWindows,
  type FallbackLogger,
  type GuardOptions,
  // Catalog
  getBehavior,
  // Windows fallback
  getFallbackMetadata,
  getHttpFallbackGuidance,
  // Capabilities
  getPlatformCapabilities as getSignalPlatformCapabilities,
  getSignal,
  getSignalCatalog,
  getSignalNumber,
  getSignalsVersion,
  getWindowsEvent,
  getWindowTimeRemaining,
  type HandlerOptions,
  handleDoubleTap,
  handleWindowsFallback,
  isPOSIX as isSignalPOSIX,
  isWindows as isSignalWindows,
  isWithinWindow,
  type LogLevel,
  listBehaviors,
  listSignals,
  type OsMappings,
  // Convenience wrappers
  onAnyShutdown,
  onEmergencyQuit,
  onReload,
  onShutdown,
  onUSR1,
  onUSR2,
  type Platform,
  type PlatformCapabilities as SignalPlatformCapabilities,
  type PlatformOverrides,
  type PlatformSupport,
  type PlatformSupportLevel,
  type RateLimitHook,
  type RateLimitResult,
  requiresFallback,
  resetDoubleTap,
  type Signal,
  type SignalBehavior,
  type SignalCatalog,
  type SignalEndpointOptions,
  type SignalErrorResponse,
  type SignalHandler,
  type SignalInfo,
  SignalManager,
  type SignalManagerOptions,
  type SignalRequest,
  type SignalResponse,
  supportsSignal,
  supportsSignalExitCodes as supportsSignalBasedExitCodes,
  type TelemetryEmitter,
  type TimeoutBehavior,
  type WindowsFallback,
  type WindowsFallbackBehavior,
  type WindowsFallbackOptions,
  type WindowsFallbackResult,
} from "./signals/index.js";
export type {
  NormalizeOptions,
  Suggestion,
  SuggestOptions,
} from "./similarity/index.js";
// Similarity utilities exports
export {
  casefold,
  distance,
  equalsIgnoreCase,
  normalize,
  score,
  stripAccents,
  suggest,
} from "./similarity/index.js";
