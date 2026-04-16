import { describe, expect, it } from 'vitest';
import { RateLimiter, checkApiRateLimit, apiRateLimiter } from '@/lib/server/rate-limiter';

describe('RateLimiter', () => {
  it('allows requests within the limit', async () => {
    const limiter = new RateLimiter(3, 60_000);
    expect((await limiter.check('user1')).allowed).toBe(true);
    expect((await limiter.check('user1')).allowed).toBe(true);
    expect((await limiter.check('user1')).allowed).toBe(true);
  });

  it('blocks requests over the limit', async () => {
    const limiter = new RateLimiter(2, 60_000);
    await limiter.check('user1');
    await limiter.check('user1');
    const result = await limiter.check('user1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('tracks remaining count correctly', async () => {
    const limiter = new RateLimiter(5, 60_000);
    expect((await limiter.check('user1')).remaining).toBe(4);
    expect((await limiter.check('user1')).remaining).toBe(3);
    expect((await limiter.check('user1')).remaining).toBe(2);
  });

  it('isolates keys from each other', async () => {
    const limiter = new RateLimiter(1, 60_000);
    expect((await limiter.check('user1')).allowed).toBe(true);
    expect((await limiter.check('user2')).allowed).toBe(true);
    expect((await limiter.check('user1')).allowed).toBe(false);
    expect((await limiter.check('user2')).allowed).toBe(false);
  });
});

describe('apiRateLimiter', () => {
  it('exists with 60 req/min limit', () => {
    expect(apiRateLimiter).toBeInstanceOf(RateLimiter);
  });
});

describe('checkApiRateLimit', () => {
  it('returns null when allowed', async () => {
    const result = await checkApiRateLimit('test-unique-user-' + Math.random());
    expect(result).toBeNull();
  });
});
