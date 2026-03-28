/**
 * Minimal structured JSON logger for the agents service.
 *
 * Outputs one JSON object per line to stdout/stderr so log aggregators
 * (Datadog, Railway, etc.) can index individual fields without parsing
 * free-form text.
 *
 * Every log line automatically includes the current request's correlation ID
 * (via AsyncLocalStorage) when one is active.
 *
 * Usage:
 *   import { logger } from './logger.js';
 *   logger.info('cycle.start', { cycleCount: 1 });
 *   logger.error('agent.failed', { role: 'risk_monitor', error: 'timeout' });
 */

import { getCorrelationId } from './correlation.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  event: string;
  ts: string;
  correlationId?: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, event: string, meta?: Record<string, unknown>): void {
  const correlationId = getCorrelationId();
  const entry: LogEntry = {
    level,
    event,
    ts: new Date().toISOString(),
    ...(correlationId ? { correlationId } : {}),
    ...meta,
  };
  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  debug: (event: string, meta?: Record<string, unknown>) => emit('debug', event, meta),
  info: (event: string, meta?: Record<string, unknown>) => emit('info', event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => emit('warn', event, meta),
  error: (event: string, meta?: Record<string, unknown>) => emit('error', event, meta),
};
