/**
 * Signal Manager
 *
 * Cross-platform signal handler registration and lifecycle management.
 * Implements FIFO execution, priority overrides, timeout enforcement, and double-tap support.
 */

import { isWindows, supportsSignal } from './capabilities.js';
import { getSignal } from './catalog.js';
import {
  createDoubleTapTracker,
  type DoubleTapState,
  handleDoubleTap,
  resetDoubleTap,
} from './double-tap.js';
import { type FallbackLogger, handleWindowsFallback, type TelemetryEmitter } from './windows.js';

/**
 * Signal handler function type
 */
export type SignalHandler = (signal: NodeJS.Signals) => void | Promise<void>;

/**
 * Handler registration options
 */
export interface HandlerOptions {
  /**
   * Priority for execution order (higher priority runs first)
   * Default: 0 (FIFO order)
   */
  priority?: number;

  /**
   * Timeout for this handler in milliseconds
   * Default: manager's default timeout (30s)
   */
  timeoutMs?: number;

  /**
   * Handler identifier for debugging
   */
  id?: string;
}

/**
 * Timeout behavior options
 */
export type TimeoutBehavior = 'force_exit' | 'log_and_continue';

/**
 * Signal manager configuration
 */
export interface SignalManagerOptions {
  /**
   * Default handler timeout in milliseconds
   * Default: 30000 (30 seconds)
   */
  defaultTimeoutMs?: number;

  /**
   * Behavior when handler timeout is exceeded
   * Default: 'log_and_continue'
   */
  timeoutBehavior?: TimeoutBehavior;

  /**
   * Logger for handler events
   */
  logger?: FallbackLogger;

  /**
   * Telemetry emitter for observability
   */
  telemetry?: TelemetryEmitter;

  /**
   * Enable test mode (prevents process.exit, allows signal injection)
   */
  testMode?: boolean;

  /**
   * Double-tap debounce window in milliseconds (for SIGINT)
   * Default: 2000 (2 seconds per Crucible standard)
   */
  doubleTapWindowMs?: number;

  /**
   * Exit code for double-tap force quit
   * Default: 130 (SIGINT)
   */
  doubleTapExitCode?: number;
}

/**
 * Internal handler registration
 */
interface RegisteredHandler {
  signal: string;
  handler: SignalHandler;
  priority: number;
  timeoutMs: number;
  id: string;
  registeredAt: number;
}

/**
 * Signal Manager
 */
export class SignalManager {
  private handlers: Map<string, RegisteredHandler[]> = new Map();
  private nativeListeners: Map<string, (signal: NodeJS.Signals) => void> = new Map();
  private options: Required<Omit<SignalManagerOptions, 'logger' | 'telemetry'>> & {
    logger?: FallbackLogger;
    telemetry?: TelemetryEmitter;
  };
  private handlerIdCounter = 0;
  private doubleTapTrackers: Map<string, DoubleTapState> = new Map();
  private shuttingDown = false;

  constructor(options: SignalManagerOptions = {}) {
    this.options = {
      defaultTimeoutMs: options.defaultTimeoutMs ?? 30000,
      timeoutBehavior: options.timeoutBehavior ?? 'log_and_continue',
      testMode: options.testMode ?? false,
      doubleTapWindowMs: options.doubleTapWindowMs ?? 2000,
      doubleTapExitCode: options.doubleTapExitCode ?? 130,
      logger: options.logger,
      telemetry: options.telemetry,
    };
  }

  /**
   * Register a signal handler
   *
   * @param signal - Signal name (e.g., "SIGTERM") or NodeJS.Signals
   * @param handler - Handler function
   * @param options - Handler options
   */
  async register(
    signal: string | NodeJS.Signals,
    handler: SignalHandler,
    options: HandlerOptions = {},
  ): Promise<void> {
    const signalName = typeof signal === 'string' ? signal : signal;

    // Check if signal is supported on this platform
    const supported = await supportsSignal(signalName);
    if (!supported) {
      // Log Windows fallback if applicable
      if (isWindows()) {
        await handleWindowsFallback(signalName, {
          logger: this.options.logger,
          telemetry: this.options.telemetry,
        });
      }
      return; // Don't register unsupported signals
    }

    // Get or create handler list for this signal
    if (!this.handlers.has(signalName)) {
      this.handlers.set(signalName, []);
    }

    // Create handler registration
    const registration: RegisteredHandler = {
      signal: signalName,
      handler,
      priority: options.priority ?? 0,
      timeoutMs: options.timeoutMs ?? this.options.defaultTimeoutMs,
      id: options.id ?? `handler-${++this.handlerIdCounter}`,
      registeredAt: Date.now(),
    };

    // Add to handler list
    const handlers = this.handlers.get(signalName)!;
    handlers.push(registration);

    // Sort by priority (higher first), then by registration order (FIFO)
    handlers.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.registeredAt - b.registeredAt; // FIFO for same priority
    });

    // Register native listener if not already registered
    if (!this.nativeListeners.has(signalName)) {
      await this.registerNativeListener(signalName);
    }

    // Log registration
    if (this.options.logger) {
      this.options.logger.info(`Signal handler registered: ${signalName}`, {
        handler_id: registration.id,
        priority: registration.priority,
        timeout_ms: registration.timeoutMs,
      });
    }

    // Emit telemetry
    if (this.options.telemetry) {
      this.options.telemetry.emit('fulmen.signal.handler_registered', {
        signal: signalName,
        handler_id: registration.id,
        priority: String(registration.priority),
      });
    }
  }

  /**
   * Register native Node.js signal listener
   */
  private async registerNativeListener(signalName: string): Promise<void> {
    const signal = await getSignal(signalName);
    if (!signal) {
      return;
    }

    // Check if this signal uses double-tap behavior
    const useDoubleTap = signal.default_behavior === 'graceful_shutdown_with_double_tap';

    if (useDoubleTap) {
      // Create double-tap tracker
      const tracker = await createDoubleTapTracker(signalName, {
        windowMs: this.options.doubleTapWindowMs,
        exitCode: this.options.doubleTapExitCode,
        logger: this.options.logger,
        testMode: this.options.testMode,
      });
      this.doubleTapTrackers.set(signalName, tracker);
    }

    // Create native listener
    const listener = async (sig: NodeJS.Signals) => {
      // Handle double-tap if enabled
      if (useDoubleTap) {
        const tracker = this.doubleTapTrackers.get(signalName);
        if (tracker) {
          const forceQuit = handleDoubleTap(tracker);
          if (forceQuit) {
            // Second tap - force quit already handled by handleDoubleTap
            return;
          }
          // First tap - continue to graceful shutdown
        }
      }

      // Execute registered handlers
      await this.executeHandlers(signalName, sig);
    };

    // Register with Node.js
    process.on(signalName as NodeJS.Signals, listener);
    this.nativeListeners.set(signalName, listener);
  }

  /**
   * Execute all registered handlers for a signal
   */
  private async executeHandlers(signalName: string, signal: NodeJS.Signals): Promise<void> {
    const handlers = this.handlers.get(signalName);
    if (!handlers || handlers.length === 0) {
      return;
    }

    // Mark as shutting down
    this.shuttingDown = true;

    // Log signal receipt
    if (this.options.logger) {
      this.options.logger.info(`Signal received: ${signalName}`, {
        handler_count: handlers.length,
      });
    }

    // Execute handlers in priority order
    for (const registration of handlers) {
      try {
        // Execute with timeout
        await this.executeWithTimeout(registration, signal);
      } catch (error) {
        // Handler failed - log and continue or exit
        if (this.options.logger) {
          this.options.logger.warn(`Signal handler failed: ${signalName}`, {
            handler_id: registration.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        if (this.options.telemetry) {
          this.options.telemetry.emit('fulmen.signal.handler_error', {
            signal: signalName,
            handler_id: registration.id,
            error_type: error instanceof Error ? error.constructor.name : 'unknown',
          });
        }

        if (this.options.timeoutBehavior === 'force_exit') {
          const exitCode = (await getSignal(signalName))?.exit_code ?? 1;
          if (!this.options.testMode) {
            process.exit(exitCode);
          }
          return;
        }
        // Otherwise continue to next handler
      }
    }

    // Reset double-tap state if graceful shutdown completed
    const tracker = this.doubleTapTrackers.get(signalName);
    if (tracker) {
      resetDoubleTap(tracker);
    }
  }

  /**
   * Execute a handler with timeout enforcement
   */
  private async executeWithTimeout(
    registration: RegisteredHandler,
    signal: NodeJS.Signals,
  ): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Handler timeout exceeded: ${registration.timeoutMs}ms`));
      }, registration.timeoutMs);
    });

    const handlerPromise = Promise.resolve(registration.handler(signal));

    try {
      await Promise.race([handlerPromise, timeoutPromise]);

      // Handler completed successfully
      if (this.options.telemetry) {
        this.options.telemetry.emit('fulmen.signal.handler_completed', {
          signal: registration.signal,
          handler_id: registration.id,
        });
      }
    } catch (error) {
      // Timeout or handler error
      if (this.options.telemetry) {
        this.options.telemetry.emit('fulmen.signal.handler_timeout', {
          signal: registration.signal,
          handler_id: registration.id,
          timeout_ms: String(registration.timeoutMs),
        });
      }
      throw error;
    }
  }

  /**
   * Unregister a signal handler
   *
   * @param signal - Signal name
   * @param handler - Handler to remove (if not provided, removes all handlers)
   */
  unregister(signal: string, handler?: SignalHandler): void {
    const handlers = this.handlers.get(signal);
    if (!handlers) {
      return;
    }

    if (handler) {
      // Remove specific handler
      const index = handlers.findIndex((h) => h.handler === handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    } else {
      // Remove all handlers for this signal
      handlers.length = 0;
    }

    // If no handlers left, remove native listener
    if (handlers.length === 0) {
      const listener = this.nativeListeners.get(signal);
      if (listener) {
        process.off(signal as NodeJS.Signals, listener);
        this.nativeListeners.delete(signal);
      }
      this.handlers.delete(signal);
    }
  }

  /**
   * Check if a signal has registered handlers
   */
  isRegistered(signal: string): boolean {
    const handlers = this.handlers.get(signal);
    return handlers !== undefined && handlers.length > 0;
  }

  /**
   * Get handler count for a signal
   */
  getHandlerCount(signal: string): number {
    const handlers = this.handlers.get(signal);
    return handlers?.length ?? 0;
  }

  /**
   * Trigger signal handlers manually (for testing)
   *
   * @param signal - Signal name
   */
  async trigger(signal: string): Promise<void> {
    const handlers = this.handlers.get(signal);
    if (!handlers || handlers.length === 0) {
      return;
    }

    await this.executeHandlers(signal, signal as NodeJS.Signals);
  }

  /**
   * Shutdown the signal manager and cleanup all handlers
   */
  async shutdown(): Promise<void> {
    // Remove all native listeners
    for (const [signal, listener] of this.nativeListeners.entries()) {
      process.off(signal as NodeJS.Signals, listener);
    }

    // Clear state
    this.nativeListeners.clear();
    this.handlers.clear();
    this.doubleTapTrackers.clear();
    this.shuttingDown = false;
  }

  /**
   * Check if manager is currently shutting down
   */
  isShuttingDown(): boolean {
    return this.shuttingDown;
  }
}

/**
 * Create a new signal manager instance
 *
 * @param options - Manager configuration
 */
export function createSignalManager(options: SignalManagerOptions = {}): SignalManager {
  return new SignalManager(options);
}
