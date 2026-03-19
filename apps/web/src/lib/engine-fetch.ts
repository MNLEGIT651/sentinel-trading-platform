const _BASE = process.env.NEXT_PUBLIC_ENGINE_URL ?? 'http://localhost:8000';
const _API_KEY = process.env.NEXT_PUBLIC_ENGINE_API_KEY ?? '';

/** Build the full URL for an engine API path (e.g. `/api/v1/data/quotes`). */
export function engineUrl(path: string): string {
  return `${_BASE}${path}`;
}

/** Return headers that authenticate against the engine's ApiKeyMiddleware. */
export function engineHeaders(): Record<string, string> {
  if (!_API_KEY) return {};
  return { 'X-API-Key': _API_KEY };
}
