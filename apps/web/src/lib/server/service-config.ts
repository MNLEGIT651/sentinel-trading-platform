import type { ServiceName } from '@/lib/service-error';

// ─── Timeout constants (milliseconds) ────────────────────────────────────────
// Centralised here so they can be tuned in one place and tested by name.

/** Timeout for /health liveness probes — kept short to fail fast. */
const TIMEOUT_HEALTH_MS = 4_000;

/** Timeout for strategy scan requests — CPU-intensive, may fan out over many tickers. */
const TIMEOUT_ENGINE_STRATEGY_SCAN_MS = 70_000;

/** Timeout for backtest runs — involves replaying historical data. */
const TIMEOUT_ENGINE_BACKTEST_MS = 45_000;

/** Timeout for real-time quote fetches from the engine. */
const TIMEOUT_ENGINE_QUOTES_MS = 15_000;

/** Timeout for historical bar data fetches from the engine. */
const TIMEOUT_ENGINE_BARS_MS = 12_000;

/** Timeout for order history pagination queries. */
const TIMEOUT_ENGINE_ORDER_HISTORY_MS = 10_000;

/** Default timeout for engine GET requests not matched by a specific rule. */
const TIMEOUT_ENGINE_GET_DEFAULT_MS = 10_000;

/** Default timeout for engine mutation (POST/PUT/DELETE) requests. */
const TIMEOUT_ENGINE_MUTATION_DEFAULT_MS = 15_000;

/** Default timeout for agents service GET requests. */
const TIMEOUT_AGENTS_GET_DEFAULT_MS = 6_000;

/** Default timeout for agents service mutation requests. */
const TIMEOUT_AGENTS_MUTATION_DEFAULT_MS = 8_000;

// ─── Dev-only defaults ────────────────────────────────────────────────────────

/** Local URL used for the engine when running outside of production. */
const ENGINE_DEV_URL = 'http://localhost:8000';

/** API key used for the engine in local development. */
const ENGINE_DEV_API_KEY = 'sentinel-dev-key';

/** Local URL used for the agents service when running outside of production. */
const AGENTS_DEV_URL = 'http://localhost:3001';

// ─────────────────────────────────────────────────────────────────────────────

interface ServiceConfig {
  service: ServiceName;
  label: string;
  baseUrl: string | null;
  headers: Record<string, string>;
  configured: boolean;
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

function isLocalOnlyUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function normalizeBaseUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/\/+$/, '');
}

export function getServiceConfig(service: ServiceName): ServiceConfig {
  if (service === 'engine') {
    const baseUrl = normalizeBaseUrl(
      process.env.ENGINE_URL ?? (isProductionRuntime() ? null : ENGINE_DEV_URL),
    );
    const apiKey = process.env.ENGINE_API_KEY ?? (isProductionRuntime() ? '' : ENGINE_DEV_API_KEY);
    const configured =
      baseUrl !== null && apiKey.length > 0 && !(isProductionRuntime() && isLocalOnlyUrl(baseUrl));

    return {
      service,
      label: 'quant engine',
      baseUrl: configured ? baseUrl : null,
      // Send only the standard Bearer token; X-API-Key is no longer forwarded.
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      configured,
    };
  }

  const baseUrl = normalizeBaseUrl(
    process.env.AGENTS_URL ?? (isProductionRuntime() ? null : AGENTS_DEV_URL),
  );
  const configured = baseUrl !== null && !(isProductionRuntime() && isLocalOnlyUrl(baseUrl));

  return {
    service,
    label: 'agents service',
    baseUrl: configured ? baseUrl : null,
    headers: {},
    configured,
  };
}

export function getServiceTimeoutMs(
  service: ServiceName,
  upstreamPath: string,
  method: string,
): number {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = upstreamPath.toLowerCase();

  if (normalizedPath === '/health') return TIMEOUT_HEALTH_MS;

  if (service === 'engine') {
    if (normalizedPath.includes('/api/v1/strategies/scan')) return TIMEOUT_ENGINE_STRATEGY_SCAN_MS;
    if (normalizedPath.includes('/api/v1/backtest/run')) return TIMEOUT_ENGINE_BACKTEST_MS;
    if (normalizedPath.includes('/api/v1/data/quotes')) return TIMEOUT_ENGINE_QUOTES_MS;
    if (normalizedPath.includes('/api/v1/data/bars/')) return TIMEOUT_ENGINE_BARS_MS;
    if (normalizedPath.includes('/api/v1/portfolio/orders/history'))
      return TIMEOUT_ENGINE_ORDER_HISTORY_MS;
    if (normalizedMethod === 'GET') return TIMEOUT_ENGINE_GET_DEFAULT_MS;
    return TIMEOUT_ENGINE_MUTATION_DEFAULT_MS;
  }

  if (normalizedMethod === 'GET') return TIMEOUT_AGENTS_GET_DEFAULT_MS;
  return TIMEOUT_AGENTS_MUTATION_DEFAULT_MS;
}

export function getServiceAttempts(
  service: ServiceName,
  upstreamPath: string,
  method: string,
): number {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = upstreamPath.toLowerCase();

  if (!['GET', 'HEAD'].includes(normalizedMethod)) return 1;
  if (normalizedPath === '/health') return 1;
  if (service === 'agents') return 2;
  return 2;
}
