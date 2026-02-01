/**
 * TSFulmen Signals Module
 *
 * Cross-platform signal handling with Fulmen ecosystem standards.
 * Provides catalog access, handler registration, and platform-aware fallbacks.
 */

// Capability exports
export {
  getPlatform,
  getPlatformCapabilities,
  getSignalNumber,
  getWindowsEvent,
  isPOSIX,
  isWindows,
  type Platform,
  type PlatformCapabilities,
  supportsSignal,
  supportsSignalExitCodes,
} from "./capabilities.js";
// Catalog exports
export {
  getBehavior,
  getSignal,
  getSignalCatalog,
  getSignalsVersion,
  listBehaviors,
  listSignals,
} from "./catalog.js";
// HTTP config reload endpoint helper exports
export {
  type ConfigReloadEndpointOptions,
  type ConfigReloadErrorResponse,
  type ConfigReloadRateLimitHook,
  type ConfigReloadRequest,
  type ConfigReloadResponse,
  createConfigReloadEndpoint,
} from "./config-reload-endpoint.js";
// Convenience wrapper exports
export {
  onAnyShutdown,
  onEmergencyQuit,
  onReload,
  onShutdown,
  onUSR1,
  onUSR2,
} from "./convenience.js";
// Double-tap exports
export {
  createDoubleTapTracker,
  type DoubleTapConfig,
  type DoubleTapState,
  getWindowTimeRemaining,
  handleDoubleTap,
  isWithinWindow,
  resetDoubleTap,
} from "./double-tap.js";
// Guard exports
export {
  ensurePOSIX,
  ensureSignalExitCodesSupported,
  ensureSupported,
  ensureWindows,
  type GuardOptions,
} from "./guards.js";
// HTTP helper exports
export {
  type AuthHook,
  type AuthResult,
  createBearerTokenAuth,
  createSignalEndpoint,
  createSimpleRateLimiter,
  type RateLimitHook,
  type RateLimitResult,
  type SignalEndpointOptions,
  type SignalErrorResponse,
  type SignalRequest,
  type SignalResponse,
} from "./http-helper.js";
// Manager exports
export {
  createSignalManager,
  type HandlerOptions,
  type SignalHandler,
  SignalManager,
  type SignalManagerOptions,
  type TimeoutBehavior,
} from "./manager.js";

// Config reload exports
export {
  type ConfigLoader,
  type ConfigReloadOptions,
  type ConfigReloadResult,
  ConfigReloadTracker,
  type ConfigValidationResult,
  type ConfigValidator,
  createConfigReloadHandler,
} from "./reload.js";
// Type exports
export type {
  Behavior,
  BehaviorInfo,
  BehaviorPhase,
  ExitCodes,
  LogLevel,
  OsMappings,
  PlatformOverrides,
  PlatformSupport,
  PlatformSupportLevel,
  Signal,
  SignalBehavior,
  SignalCatalog,
  SignalInfo,
  WindowsFallback,
  WindowsFallbackBehavior,
} from "./types.js";
// Windows fallback exports
export {
  type FallbackLogger,
  getFallbackMetadata,
  getHttpFallbackGuidance,
  handleWindowsFallback,
  requiresFallback,
  type TelemetryEmitter,
  type WindowsFallbackOptions,
  type WindowsFallbackResult,
} from "./windows.js";
