/**
 * Request-scoped correlation ID context using AsyncLocalStorage.
 *
 * Every inbound HTTP request gets a correlation ID (forwarded or generated).
 * The ID is available to any code running in the same async context — loggers,
 * the EngineClient, Supabase calls, etc. — without manual parameter threading.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const correlationStore = new AsyncLocalStorage<string>();

/** Header name used across all Sentinel services. */
export const CORRELATION_HEADER = 'x-correlation-id';

/** Return the current correlation ID, or empty string outside a request. */
export function getCorrelationId(): string {
  return correlationStore.getStore() ?? '';
}

/**
 * Run `fn` inside a new correlation scope.
 * If `id` is omitted a fresh UUID v4 is generated.
 */
export function withCorrelationId<T>(fn: () => T, id?: string): T {
  return correlationStore.run(id ?? randomUUID(), fn);
}
