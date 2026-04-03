import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimiter } from '@/lib/server/rate-limiter';
import { checkMutationRateLimit, mutationRateLimiter } from '@/lib/server/csrf';

// ---------------------------------------------------------------------------
// Mock the canonical URL helper (csrf module imports from auth/url)
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/url', () => ({
  getCanonicalUrl: vi.fn(() => 'https://sentinel.example.com'),
}));

// ---------------------------------------------------------------------------
// mutationRateLimiter — tighter limits for state-changing routes
// ---------------------------------------------------------------------------

describe('mutationRateLimiter', () => {
  it('is a RateLimiter instance', () => {
    expect(mutationRateLimiter).toBeInstanceOf(RateLimiter);
  });

  it('allows requests within threshold', () => {
    const key = `mutation-test-allow-${Date.now()}`;
    const result = mutationRateLimiter.check(key);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// checkMutationRateLimit — integration with Response
// ---------------------------------------------------------------------------

describe('checkMutationRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when requests are within threshold', () => {
    const userId = `user-mutation-ok-${Date.now()}`;
    const response = checkMutationRateLimit(userId);
    expect(response).toBeNull();
  });

  it('returns 429 after threshold is exceeded', () => {
    const userId = `user-mutation-blocked-${Date.now()}`;
    // mutationRateLimiter has limit of 20 per minute
    for (let i = 0; i < 20; i++) {
      const res = checkMutationRateLimit(userId);
      expect(res).toBeNull();
    }
    // 21st request should be blocked
    const blocked = checkMutationRateLimit(userId);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it('429 response includes Retry-After header', async () => {
    const userId = `user-mutation-retry-${Date.now()}`;
    for (let i = 0; i < 20; i++) {
      checkMutationRateLimit(userId);
    }
    const blocked = checkMutationRateLimit(userId)!;
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
  });

  it('429 response body contains rate_limited error', async () => {
    const userId = `user-mutation-body-${Date.now()}`;
    for (let i = 0; i < 20; i++) {
      checkMutationRateLimit(userId);
    }
    const blocked = checkMutationRateLimit(userId)!;
    const body = await blocked.json();
    expect(body.error).toBe('rate_limited');
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('allows requests again after window resets', () => {
    const userId = `user-mutation-reset-${Date.now()}`;
    for (let i = 0; i < 20; i++) {
      checkMutationRateLimit(userId);
    }
    // Should be blocked
    expect(checkMutationRateLimit(userId)).not.toBeNull();

    // Advance past the 60s window
    vi.advanceTimersByTime(60_001);

    // Should be allowed again
    const response = checkMutationRateLimit(userId);
    expect(response).toBeNull();
  });
});
