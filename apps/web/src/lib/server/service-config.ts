import type { ServiceName } from '@/lib/service-error';

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
      process.env.ENGINE_URL ?? (isProductionRuntime() ? null : 'http://localhost:8000'),
    );
    const apiKey = process.env.ENGINE_API_KEY ?? (isProductionRuntime() ? '' : 'sentinel-dev-key');
    const configured =
      baseUrl !== null && apiKey.length > 0 && !(isProductionRuntime() && isLocalOnlyUrl(baseUrl));

    return {
      service,
      label: 'quant engine',
      baseUrl: configured ? baseUrl : null,
      headers: apiKey
        ? {
            Authorization: `Bearer ${apiKey}`,
            'X-API-Key': apiKey,
          }
        : {},
      configured,
    };
  }

  const baseUrl = normalizeBaseUrl(
    process.env.AGENTS_URL ?? (isProductionRuntime() ? null : 'http://localhost:3001'),
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

  if (normalizedPath === '/health') return 4_000;

  if (service === 'engine') {
    if (normalizedPath.includes('/api/v1/strategies/scan')) return 70_000;
    if (normalizedPath.includes('/api/v1/backtest/run')) return 45_000;
    if (normalizedPath.includes('/api/v1/data/quotes')) return 15_000;
    if (normalizedPath.includes('/api/v1/data/bars/')) return 12_000;
    if (normalizedPath.includes('/api/v1/portfolio/orders/history')) return 10_000;
    if (normalizedMethod === 'GET') return 10_000;
    return 15_000;
  }

  if (normalizedMethod === 'GET') return 6_000;
  return 8_000;
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
