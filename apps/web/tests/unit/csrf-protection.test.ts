import { describe, expect, it } from 'vitest';
import { checkCsrf, validateOrigin } from '@/lib/server/csrf';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a Request with a given URL and headers. */
function makeRequest(
  headers: Record<string, string> = {},
  url = 'https://sentinel.example.com/api/journal',
): Request {
  return new Request(url, {
    method: 'POST',
    headers,
  });
}

// ---------------------------------------------------------------------------
// validateOrigin — pure logic
// ---------------------------------------------------------------------------

describe('validateOrigin', () => {
  it('allows request with matching Origin header', () => {
    const req = makeRequest({ origin: 'https://sentinel.example.com' });
    const result = validateOrigin(req);
    expect(result.allowed).toBe(true);
  });

  it('allows request with matching Origin header (case-insensitive)', () => {
    const req = makeRequest({ origin: 'HTTPS://SENTINEL.EXAMPLE.COM' });
    const result = validateOrigin(req);
    expect(result.allowed).toBe(true);
  });

  it('rejects request with mismatched Origin header', () => {
    const req = makeRequest({ origin: 'https://evil.example.com' });
    const result = validateOrigin(req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Origin mismatch');
  });

  it('allows request with matching Referer when Origin is absent', () => {
    const req = makeRequest({
      referer: 'https://sentinel.example.com/dashboard',
    });
    const result = validateOrigin(req);
    expect(result.allowed).toBe(true);
  });

  it('rejects request with mismatched Referer when Origin is absent', () => {
    const req = makeRequest({
      referer: 'https://evil.example.com/attack-page',
    });
    const result = validateOrigin(req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Referer origin mismatch');
  });

  it('rejects request with malformed Referer', () => {
    const req = makeRequest({ referer: 'not-a-valid-url' });
    const result = validateOrigin(req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Malformed Referer');
  });

  it('allows request with X-Requested-With when Origin and Referer are absent', () => {
    const req = makeRequest({ 'x-requested-with': 'sentinel' });
    const result = validateOrigin(req);
    expect(result.allowed).toBe(true);
  });

  it('rejects request with no Origin, Referer, or X-Requested-With', () => {
    const req = makeRequest({});
    const result = validateOrigin(req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Missing Origin, Referer, and X-Requested-With');
  });

  it('prefers Origin header over Referer', () => {
    // Origin matches but Referer does not — should still pass
    const req = makeRequest({
      origin: 'https://sentinel.example.com',
      referer: 'https://evil.example.com/page',
    });
    const result = validateOrigin(req);
    expect(result.allowed).toBe(true);
  });

  it('rejects cross-origin Origin even when Referer matches', () => {
    // Origin is checked first and does not match
    const req = makeRequest({
      origin: 'https://evil.example.com',
      referer: 'https://sentinel.example.com/dashboard',
    });
    const result = validateOrigin(req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Origin mismatch');
  });
});

// ---------------------------------------------------------------------------
// checkCsrf — Response integration
// ---------------------------------------------------------------------------

describe('checkCsrf', () => {
  it('returns null for valid same-origin request', () => {
    const req = makeRequest({ origin: 'https://sentinel.example.com' });
    const response = checkCsrf(req);
    expect(response).toBeNull();
  });

  it('returns 403 Response for cross-origin request', () => {
    const req = makeRequest({ origin: 'https://evil.example.com' });
    const response = checkCsrf(req);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
  });

  it('response body contains csrf_rejected error', async () => {
    const req = makeRequest({ origin: 'https://evil.example.com' });
    const response = checkCsrf(req)!;
    const body = await response.json();
    expect(body.error).toBe('csrf_rejected');
    expect(body.detail).toBeTruthy();
  });

  it('response Content-Type is application/json', () => {
    const req = makeRequest({ origin: 'https://evil.example.com' });
    const response = checkCsrf(req)!;
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('returns null when X-Requested-With header is provided', () => {
    const req = makeRequest({ 'x-requested-with': 'XMLHttpRequest' });
    const response = checkCsrf(req);
    expect(response).toBeNull();
  });

  it('returns 403 for request with no provenance headers at all', () => {
    const req = makeRequest({});
    const response = checkCsrf(req);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Multi-host / deployment URL handling
// ---------------------------------------------------------------------------

describe('validateOrigin — multi-host handling', () => {
  it('allows same-origin request on a raw Vercel deployment URL', () => {
    const deployUrl = 'https://trading-abc123.vercel.app/api/signals/scan';
    const req = makeRequest({ origin: 'https://trading-abc123.vercel.app' }, deployUrl);
    const result = validateOrigin(req);
    expect(result.allowed).toBe(true);
  });

  it('blocks cross-origin request on a raw Vercel deployment URL', () => {
    const deployUrl = 'https://trading-abc123.vercel.app/api/signals/scan';
    const req = makeRequest({ origin: 'https://evil.example.com' }, deployUrl);
    const result = validateOrigin(req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Origin mismatch');
  });

  it('allows same-origin on a preview branch deployment', () => {
    const previewUrl = 'https://trading-app-git-feature-xyz.vercel.app/api/data';
    const req = makeRequest(
      { origin: 'https://trading-app-git-feature-xyz.vercel.app' },
      previewUrl,
    );
    const result = validateOrigin(req);
    expect(result.allowed).toBe(true);
  });

  it('allows same-origin on localhost development', () => {
    const localUrl = 'http://localhost:3000/api/data';
    const req = makeRequest({ origin: 'http://localhost:3000' }, localUrl);
    const result = validateOrigin(req);
    expect(result.allowed).toBe(true);
  });

  it('blocks canonical-origin request sent to a different deployment host', () => {
    // User is on a raw deployment URL but Origin somehow claims canonical host
    const deployUrl = 'https://trading-abc123.vercel.app/api/signals/scan';
    const req = makeRequest({ origin: 'https://sentinel-trading-platform.vercel.app' }, deployUrl);
    const result = validateOrigin(req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Origin mismatch');
  });

  it('allows Referer fallback on a raw deployment URL', () => {
    const deployUrl = 'https://trading-abc123.vercel.app/api/data';
    const req = makeRequest({ referer: 'https://trading-abc123.vercel.app/dashboard' }, deployUrl);
    const result = validateOrigin(req);
    expect(result.allowed).toBe(true);
  });
});
