import { describe, expect, it } from 'vitest';
import { RateLimiter, checkApiRateLimit, apiRateLimiter } from '@/lib/server/rate-limiter';

describe('RateLimiter', () => {
  it('allows requests within the limit', () => {
    const limiter = new RateLimiter(3, 60_000);
    expect(limiter.check('user1').allowed).toBe(true);
    expect(limiter.check('user1').allowed).toBe(true);
    expect(limiter.check('user1').allowed).toBe(true);
  });

  it('blocks requests over the limit', () => {
    const limiter = new RateLimiter(2, 60_000);
    limiter.check('user1');
    limiter.check('user1');
    const result = limiter.check('user1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('tracks remaining count correctly', () => {
    const limiter = new RateLimiter(5, 60_000);
    expect(limiter.check('user1').remaining).toBe(4);
    expect(limiter.check('user1').remaining).toBe(3);
    expect(limiter.check('user1').remaining).toBe(2);
  });

  it('isolates keys from each other', () => {
    const limiter = new RateLimiter(1, 60_000);
    expect(limiter.check('user1').allowed).toBe(true);
    expect(limiter.check('user2').allowed).toBe(true);
    expect(limiter.check('user1').allowed).toBe(false);
    expect(limiter.check('user2').allowed).toBe(false);
  });
});

describe('apiRateLimiter', () => {
  it('exists with 60 req/min limit', () => {
    expect(apiRateLimiter).toBeInstanceOf(RateLimiter);
  });
});

describe('checkApiRateLimit', () => {
  it('returns null when allowed', () => {
    const result = checkApiRateLimit('test-unique-user-' + Math.random());
    expect(result).toBeNull();
  });
});
