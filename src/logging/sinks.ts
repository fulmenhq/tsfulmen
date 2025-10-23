/**
 * Sink implementations for log output destinations
 */

import { appendFileSync } from 'node:fs';
import type { LogEvent, Sink } from './types.js';

/**
 * Console sink - writes log events to stdout as JSON
 */
export class ConsoleSink implements Sink {
  write(event: LogEvent): void {
    console.log(JSON.stringify(event));
  }
}

/**
 * File sink - appends log events to a file as JSON
 */
export class FileSink implements Sink {
  constructor(private readonly filePath: string) {}

  write(event: LogEvent): void {
    try {
      appendFileSync(this.filePath, `${JSON.stringify(event)}\n`);
    } catch (error) {
      // Log to stderr if file write fails to avoid losing the log
      console.error(`FileSink: Failed to write to ${this.filePath}:`, (error as Error).message);
      // Fall back to console
      console.log(JSON.stringify(event));
    }
  }
}

/**
 * Null sink - discards all log events (useful for testing or disabling logging)
 */
export class NullSink implements Sink {
  write(_event: LogEvent): void {
    // Intentionally do nothing
  }
}
