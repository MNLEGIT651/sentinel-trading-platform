import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimiter, rateLimitResponse, proxyRateLimiter } from '@/lib/server/rate-limiter';

// ---------------------------------------------------------------------------
// RateLimiter
// ---------------------------------------------------------------------------

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows the first request and returns correct remaining count', () => {
    const limiter = new RateLimiter(5, 60_000);
    const result = limiter.check('user-1');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('counts down remaining on subsequent requests', () => {
    const limiter = new RateLimiter(3, 60_000);

    const r1 = limiter.check('user-1');
    const r2 = limiter.check('user-1');
    const r3 = limiter.check('user-1');

    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);
  });

  it('blocks request after limit is exceeded', () => {
    const limiter = new RateLimiter(2, 60_000);

    limiter.check('user-1');
    limiter.check('user-1');
    const r3 = limiter.check('user-1');

    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('resets window after windowMs elapses', () => {
    const limiter = new RateLimiter(2, 60_000);

    limiter.check('user-1');
    limiter.check('user-1');

    // Advance past window
    vi.advanceTimersByTime(60_001);

    const result = limiter.check('user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('tracks different keys independently', () => {
    const limiter = new RateLimiter(2, 60_000);

    limiter.check('user-1');
    limiter.check('user-1');
    // user-1 is now at limit

    const resultB = limiter.check('user-2');
    expect(resultB.allowed).toBe(true);
    expect(resultB.remaining).toBe(1);
  });

  it('provides resetAtMs in the future', () => {
    const limiter = new RateLimiter(10, 60_000);
    const now = Date.now();

    const result = limiter.check('user-1');
    expect(result.resetAtMs).toBeGreaterThan(now);
  });

  it('resetAtMs stays consistent within the same window', () => {
    const limiter = new RateLimiter(10, 60_000);

    const r1 = limiter.check('user-1');
    vi.advanceTimersByTime(5000); // still within window
    const r2 = limiter.check('user-1');

    expect(r1.resetAtMs).toBe(r2.resetAtMs);
  });

  it('still allows the exact limit-th request', () => {
    const limiter = new RateLimiter(3, 60_000);

    limiter.check('u');
    limiter.check('u');
    const r = limiter.check('u'); // 3rd = exactly at limit

    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// rateLimitResponse
// ---------------------------------------------------------------------------

describe('rateLimitResponse', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 429 status', () => {
    const resetAt = Date.now() + 30_000;
    const response = rateLimitResponse(resetAt);
    expect(response.status).toBe(429);
  });

  it('includes Retry-After header in seconds', () => {
    const resetAt = Date.now() + 30_000;
    const response = rateLimitResponse(resetAt);
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  it('includes X-RateLimit-Limit header', () => {
    const resetAt = Date.now() + 60_000;
    const response = rateLimitResponse(resetAt);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('120');
  });

  it('includes X-RateLimit-Remaining: 0 header', () => {
    const resetAt = Date.now() + 60_000;
    const response = rateLimitResponse(resetAt);
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('includes X-RateLimit-Reset header as unix seconds', () => {
    const resetAt = Date.now() + 60_000; // 60 seconds from epoch
    const response = rateLimitResponse(resetAt);
    const expectedReset = Math.ceil(resetAt / 1_000);
    expect(response.headers.get('X-RateLimit-Reset')).toBe(String(expectedReset));
  });

  it('body contains error field', async () => {
    const resetAt = Date.now() + 30_000;
    const response = rateLimitResponse(resetAt);
    const body = await response.json();
    expect(body.error).toBe('rate_limited');
  });

  it('body includes retryAfterSeconds', async () => {
    const resetAt = Date.now() + 45_000;
    const response = rateLimitResponse(resetAt);
    const body = await response.json();
    expect(body.retryAfterSeconds).toBe(45);
  });

  it('Content-Type is application/json', () => {
    const resetAt = Date.now() + 30_000;
    const response = rateLimitResponse(resetAt);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });
});

// ---------------------------------------------------------------------------
// proxyRateLimiter singleton
// ---------------------------------------------------------------------------

describe('proxyRateLimiter', () => {
  it('is a RateLimiter instance', () => {
    expect(proxyRateLimiter).toBeInstanceOf(RateLimiter);
  });

  it('allows legitimate requests well under the 120/min limit', () => {
    const key = `test-${Date.now()}`;
    const result = proxyRateLimiter.check(key);
    expect(result.allowed).toBe(true);
  });
});
