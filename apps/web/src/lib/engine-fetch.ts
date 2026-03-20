const ENGINE_PROXY_BASE = '/api/engine';

/** Build the full URL for an engine API path (e.g. `/api/v1/data/quotes`). */
export function engineUrl(path: string): string {
  return `${ENGINE_PROXY_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Engine auth stays server-side in the proxy layer. */
export function engineHeaders(): Record<string, string> {
  return {};
}
