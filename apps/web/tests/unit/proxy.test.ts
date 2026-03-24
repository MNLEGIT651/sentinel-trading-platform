/**
 * Unit tests for the Next.js auth/rate-limit middleware (src/proxy.ts).
 *
 * The middleware is responsible for:
 *  1. Refreshing Supabase session cookies on every request
 *  2. Redirecting authenticated users away from /login and /signup
 *  3. Allowing public routes through without auth
 *  4. Returning JSON 401 for unauthenticated /api/* requests (not an HTML redirect)
 *  5. Redirecting unauthenticated page-route requests to /login
 *  6. Rate-limiting /api/* routes before doing any auth work
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock Supabase updateSession ──────────────────────────────────────────

const mockUpdateSession = vi.fn<
  [NextRequest],
  Promise<{ user: { id: string } | null; supabaseResponse: Response }>
>();

vi.mock('@/lib/supabase/server', () => ({
  updateSession: (req: NextRequest) => mockUpdateSession(req),
}));

// ─── Mock rate limiter ────────────────────────────────────────────────────

const mockCheck = vi.fn<[string], { allowed: boolean; remaining: number; resetAtMs: number }>();

vi.mock('@/lib/server/rate-limiter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/rate-limiter')>();
  return {
    ...actual,
    proxyRateLimiter: { check: (key: string) => mockCheck(key) },
    rateLimitResponse: () =>
      new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { 'Retry-After': '60' },
      }),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────

const ORIGIN = 'https://sentinel.example';

function makeRequest(pathname: string, ip = '1.2.3.4'): NextRequest {
  const req = new NextRequest(`${ORIGIN}${pathname}`);
  // Simulate Vercel's x-forwarded-for header
  (req.headers as unknown as Map<string, string>).set('x-forwarded-for', ip);
  return req;
}

const SUPABASE_PASSTHROUGH = new Response(null, { status: 200 });
const authenticatedSession = { user: { id: 'user-abc' }, supabaseResponse: SUPABASE_PASSTHROUGH };
const unauthenticatedSession = { user: null, supabaseResponse: SUPABASE_PASSTHROUGH };

function allowedRl() {
  return { allowed: true, remaining: 119, resetAtMs: Date.now() + 60_000 };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('proxy middleware', () => {
  let proxy: typeof import('@/proxy').proxy;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Default: rate limit allows, user is authenticated
    mockCheck.mockReturnValue(allowedRl());
    mockUpdateSession.mockResolvedValue(authenticatedSession);
    const mod = await import('@/proxy');
    proxy = mod.proxy;
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ── Auth page redirects ───────────────────────────────────────────────

  it('redirects authenticated user on /login to /', async () => {
    const response = await proxy(makeRequest('/login'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/`);
  });

  it('redirects authenticated user on /signup to /', async () => {
    const response = await proxy(makeRequest('/signup'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/`);
  });

  it('passes unauthenticated user on /login through', async () => {
    mockUpdateSession.mockResolvedValueOnce(unauthenticatedSession);
    const response = await proxy(makeRequest('/login'));
    expect(response.status).toBe(200);
  });

  // ── Public routes ────────────────────────────────────────────────────

  it('allows /auth/callback through without auth check redirect', async () => {
    mockUpdateSession.mockResolvedValueOnce(unauthenticatedSession);
    const response = await proxy(makeRequest('/auth/callback'));
    expect(response.status).toBe(200);
  });

  it('allows /api/health through without auth', async () => {
    mockUpdateSession.mockResolvedValueOnce(unauthenticatedSession);
    const response = await proxy(makeRequest('/api/health'));
    expect(response.status).toBe(200);
  });

  it('allows /favicon.ico through without auth', async () => {
    mockUpdateSession.mockResolvedValueOnce(unauthenticatedSession);
    const response = await proxy(makeRequest('/favicon.ico'));
    expect(response.status).toBe(200);
  });

  // ── Unauthenticated page redirect ────────────────────────────────────

  it('redirects unauthenticated user on / to /login', async () => {
    mockUpdateSession.mockResolvedValueOnce(unauthenticatedSession);
    const response = await proxy(makeRequest('/'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/login`);
  });

  it('appends ?next= when redirecting from a non-root page', async () => {
    mockUpdateSession.mockResolvedValueOnce(unauthenticatedSession);
    const response = await proxy(makeRequest('/portfolio'));
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('/login');
    expect(location).toContain('next=%2Fportfolio');
  });

  it('does NOT append ?next= when redirecting from /', async () => {
    mockUpdateSession.mockResolvedValueOnce(unauthenticatedSession);
    const response = await proxy(makeRequest('/'));
    const location = response.headers.get('location') ?? '';
    expect(location).not.toContain('next=');
  });

  // ── API route: JSON 401 (not HTML redirect) ───────────────────────────

  it('returns JSON 401 for unauthenticated /api/engine/* request', async () => {
    mockUpdateSession.mockResolvedValueOnce(unauthenticatedSession);
    const response = await proxy(makeRequest('/api/engine/health'));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({ error: 'unauthorized' });
  });

  it('returns JSON 401 for unauthenticated /api/agents/* request', async () => {
    mockUpdateSession.mockResolvedValueOnce(unauthenticatedSession);
    const response = await proxy(makeRequest('/api/agents/cycles'));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({ error: 'unauthorized' });
  });

  it('does NOT redirect /api/* to /login even when unauthenticated', async () => {
    mockUpdateSession.mockResolvedValueOnce(unauthenticatedSession);
    const response = await proxy(makeRequest('/api/engine/health'));
    expect(response.status).not.toBe(307);
    expect(response.headers.get('location')).toBeNull();
  });

  it('passes authenticated /api/engine/* request through', async () => {
    const response = await proxy(makeRequest('/api/engine/health'));
    expect(response.status).toBe(200);
  });

  // ── Rate limiting ────────────────────────────────────────────────────

  it('returns 429 when the rate limiter denies an /api/* request', async () => {
    mockCheck.mockReturnValueOnce({ allowed: false, remaining: 0, resetAtMs: Date.now() + 60_000 });
    const response = await proxy(makeRequest('/api/engine/health'));
    expect(response.status).toBe(429);
  });

  it('uses x-forwarded-for as the rate-limit key', async () => {
    mockCheck.mockReturnValue(allowedRl());
    await proxy(makeRequest('/api/engine/health', '10.0.0.1'));
    expect(mockCheck).toHaveBeenCalledWith('10.0.0.1');
  });

  it('does NOT rate-limit page routes', async () => {
    await proxy(makeRequest('/portfolio'));
    expect(mockCheck).not.toHaveBeenCalled();
  });

  it('does NOT rate-limit /api/health (public prefix)', async () => {
    mockUpdateSession.mockResolvedValueOnce(unauthenticatedSession);
    await proxy(makeRequest('/api/health'));
    expect(mockCheck).not.toHaveBeenCalled();
  });
});

// ─── Rate limiter unit tests ──────────────────────────────────────────────

describe('RateLimiter', () => {
  it('allows requests within the window limit', async () => {
    const { RateLimiter } = await import('@/lib/server/rate-limiter');
    const limiter = new RateLimiter(3, 60_000);

    expect(limiter.check('key').allowed).toBe(true);
    expect(limiter.check('key').allowed).toBe(true);
    expect(limiter.check('key').allowed).toBe(true);
  });

  it('denies the request after the limit is exceeded', async () => {
    const { RateLimiter } = await import('@/lib/server/rate-limiter');
    const limiter = new RateLimiter(2, 60_000);

    limiter.check('key');
    limiter.check('key');
    const result = limiter.check('key');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('decrements remaining on each allowed call', async () => {
    const { RateLimiter } = await import('@/lib/server/rate-limiter');
    const limiter = new RateLimiter(5, 60_000);

    expect(limiter.check('key').remaining).toBe(4);
    expect(limiter.check('key').remaining).toBe(3);
    expect(limiter.check('key').remaining).toBe(2);
  });

  it('tracks separate keys independently', async () => {
    const { RateLimiter } = await import('@/lib/server/rate-limiter');
    const limiter = new RateLimiter(1, 60_000);

    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('b').allowed).toBe(true); // separate key — should be allowed
    expect(limiter.check('a').allowed).toBe(false); // 'a' is now over limit
  });

  it('resets the window after windowMs elapses', async () => {
    vi.useFakeTimers();
    const { RateLimiter } = await import('@/lib/server/rate-limiter');
    const limiter = new RateLimiter(1, 500);

    limiter.check('key'); // fills the limit
    expect(limiter.check('key').allowed).toBe(false);

    vi.advanceTimersByTime(501);
    expect(limiter.check('key').allowed).toBe(true); // new window opened
    vi.useRealTimers();
  });

  it('provides a resetAtMs in the future', async () => {
    const { RateLimiter } = await import('@/lib/server/rate-limiter');
    const limiter = new RateLimiter(5, 60_000);
    const before = Date.now();
    const result = limiter.check('key');
    expect(result.resetAtMs).toBeGreaterThan(before);
  });
});
