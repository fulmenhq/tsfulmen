/**
 * Signal Handler Convenience Wrappers
 *
 * Common signal handling patterns for shutdown, reload, and custom behaviors.
 */

import type { HandlerOptions, SignalHandler, SignalManager } from "./manager.js";

/**
 * Register a graceful shutdown handler
 *
 * Convenience wrapper for SIGTERM and SIGINT handlers.
 * Automatically registers both signals to the same handler.
 *
 * @param manager - Signal manager instance
 * @param handler - Shutdown handler function
 * @param options - Handler options
 *
 * @example
 * ```typescript
 * await onShutdown(manager, async () => {
 *   await closeDatabase();
 *   await flushLogs();
 * });
 * ```
 */
export async function onShutdown(
  manager: SignalManager,
  handler: SignalHandler,
  options: HandlerOptions = {},
): Promise<void> {
  await manager.register("SIGTERM", handler, options);
  await manager.register("SIGINT", handler, options);
}

/**
 * Register a config reload handler
 *
 * Convenience wrapper for SIGHUP handler.
 * Only registers on POSIX platforms (SIGHUP not supported on Windows).
 *
 * @param manager - Signal manager instance
 * @param handler - Reload handler function
 * @param options - Handler options
 *
 * @example
 * ```typescript
 * await onReload(manager, async () => {
 *   const newConfig = await loadConfig();
 *   await validateConfig(newConfig);
 *   process.exit(129); // Exit for restart
 * });
 * ```
 */
export async function onReload(
  manager: SignalManager,
  handler: SignalHandler,
  options: HandlerOptions = {},
): Promise<void> {
  await manager.register("SIGHUP", handler, options);
}

/**
 * Register a custom handler for SIGUSR1
 *
 * Common use cases: toggle debug logging, reopen log files, dump statistics.
 *
 * @param manager - Signal manager instance
 * @param handler - Custom handler function
 * @param options - Handler options
 *
 * @example
 * ```typescript
 * await onUSR1(manager, async () => {
 *   logger.info('SIGUSR1 received - reopening log files');
 *   await reopenLogFiles();
 * });
 * ```
 */
export async function onUSR1(
  manager: SignalManager,
  handler: SignalHandler,
  options: HandlerOptions = {},
): Promise<void> {
  await manager.register("SIGUSR1", handler, options);
}

/**
 * Register a custom handler for SIGUSR2
 *
 * Common use cases: trigger profiling, rotate credentials, toggle verbose mode.
 *
 * @param manager - Signal manager instance
 * @param handler - Custom handler function
 * @param options - Handler options
 *
 * @example
 * ```typescript
 * await onUSR2(manager, async () => {
 *   logger.info('SIGUSR2 received - toggling debug mode');
 *   toggleDebugMode();
 * });
 * ```
 */
export async function onUSR2(
  manager: SignalManager,
  handler: SignalHandler,
  options: HandlerOptions = {},
): Promise<void> {
  await manager.register("SIGUSR2", handler, options);
}

/**
 * Register an emergency quit handler
 *
 * Convenience wrapper for SIGQUIT (immediate exit, no cleanup).
 *
 * @param manager - Signal manager instance
 * @param handler - Emergency quit handler
 * @param options - Handler options
 *
 * @example
 * ```typescript
 * await onEmergencyQuit(manager, async () => {
 *   logger.error('SIGQUIT received - emergency exit');
 *   process.exit(131);
 * });
 * ```
 */
export async function onEmergencyQuit(
  manager: SignalManager,
  handler: SignalHandler,
  options: HandlerOptions = {},
): Promise<void> {
  await manager.register("SIGQUIT", handler, options);
}

/**
 * Register handlers for all common shutdown signals
 *
 * Registers the same handler for SIGTERM, SIGINT, and SIGQUIT.
 * Useful for applications that want consistent shutdown behavior.
 *
 * @param manager - Signal manager instance
 * @param handler - Shutdown handler function
 * @param options - Handler options
 */
export async function onAnyShutdown(
  manager: SignalManager,
  handler: SignalHandler,
  options: HandlerOptions = {},
): Promise<void> {
  await manager.register("SIGTERM", handler, options);
  await manager.register("SIGINT", handler, options);
  await manager.register("SIGQUIT", handler, options);
}
