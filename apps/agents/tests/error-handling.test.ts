import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  retryWithBackoff,
  withTimeout,
  createErrorResponse,
  CircuitBreaker,
  CircuitBreakerState,
  RequestDeduplicator,
} from '../src/error-handling.js';

// ---------------------------------------------------------------------------
// retryWithBackoff
// ---------------------------------------------------------------------------

describe('retryWithBackoff', () => {
  it('resolves immediately on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, 3, 1);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and resolves on second attempt', async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error('transient');
      return 'recovered';
    });

    const result = await retryWithBackoff(fn, 3, 1);

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  }, 500);

  it('throws after exhausting all retries', async () => {
    const fn = vi.fn().mockImplementation(async () => {
      throw new Error('persistent failure');
    });

    await expect(retryWithBackoff(fn, 3, 1)).rejects.toThrow('persistent failure');
    expect(fn).toHaveBeenCalledTimes(3);
  }, 500);

  it('calls function multiple times on repeated failure', async () => {
    const fn = vi.fn().mockImplementation(async () => {
      throw new Error('fail');
    });

    await retryWithBackoff(fn, 3, 1).catch(() => {});

    // Should have retried 3 times total
    expect(fn).toHaveBeenCalledTimes(3);
  }, 500);

  it('wraps non-Error rejections', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject('plain string error'));

    await expect(retryWithBackoff(fn, 1, 1)).rejects.toThrow('plain string error');
  }, 500);
});

// ---------------------------------------------------------------------------
// withTimeout
// ---------------------------------------------------------------------------

describe('withTimeout', () => {
  it('resolves when promise completes before timeout', async () => {
    const promise = Promise.resolve('fast result');
    const result = await withTimeout(promise, 1000);
    expect(result).toBe('fast result');
  });

  it('rejects with timeout error when promise exceeds timeout', async () => {
    // Use a real short timeout (20ms) to avoid fake timer + rejection issues
    const neverResolves = new Promise<never>(() => {});
    await expect(withTimeout(neverResolves, 20)).rejects.toThrow('Operation timeout after 20ms');
  }, 500);

  it('propagates original rejection when promise rejects before timeout', async () => {
    const promise = Promise.reject(new Error('upstream error'));
    await expect(withTimeout(promise, 5000)).rejects.toThrow('upstream error');
  });
});

// ---------------------------------------------------------------------------
// createErrorResponse
// ---------------------------------------------------------------------------

describe('createErrorResponse', () => {
  it('creates response from Error instance', () => {
    const response = createErrorResponse(new Error('something went wrong'), 'INTERNAL_ERROR');

    expect(response.error).toBe('INTERNAL_ERROR');
    expect(response.code).toBe('INTERNAL_ERROR');
    expect(response.message).toBe('something went wrong');
    expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
    expect(response.requestId).toBeUndefined();
  });

  it('creates response from non-Error value', () => {
    const response = createErrorResponse('a plain string', 'PARSE_ERROR');

    expect(response.message).toBe('a plain string');
    expect(response.code).toBe('PARSE_ERROR');
  });

  it('includes requestId when provided', () => {
    const response = createErrorResponse(new Error('oops'), 'VALIDATION', 'req-123');

    expect(response.requestId).toBe('req-123');
  });

  it('omits requestId when not provided', () => {
    const response = createErrorResponse(new Error('oops'), 'CODE');

    expect('requestId' in response).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CircuitBreaker
// ---------------------------------------------------------------------------

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-breaker', 3, 1000, 2);
  });

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
    expect(breaker.isOpen()).toBe(false);
  });

  it('executes function successfully in CLOSED state', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const result = await breaker.call(fn);
    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('opens after reaching failure threshold', async () => {
    for (let i = 0; i < 3; i++) {
      await breaker.call(() => Promise.reject(new Error('fail'))).catch(() => {});
    }

    expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
    expect(breaker.isOpen()).toBe(true);
  });

  it('rejects immediately when OPEN', async () => {
    for (let i = 0; i < 3; i++) {
      await breaker.call(() => Promise.reject(new Error('fail'))).catch(() => {});
    }

    const rejectedFn = vi.fn().mockResolvedValue('ok');
    await breaker.call(rejectedFn).catch(() => {});

    expect(rejectedFn).not.toHaveBeenCalled();
  });

  it('transitions to HALF_OPEN after timeout elapses', async () => {
    // Use timeoutMs=0 so it's always ready to reset
    const cb = new CircuitBreaker('cb', 1, 0, 2);
    await cb.call(() => Promise.reject(new Error('fail'))).catch(() => {});

    expect(cb.isOpen()).toBe(true);

    // With timeoutMs=0, next call should trigger HALF_OPEN
    await cb.call(vi.fn().mockResolvedValue('ok'));
    expect(cb.getState()).toBe(CircuitBreakerState.HALF_OPEN);
  });

  it('closes after sufficient successes in HALF_OPEN', async () => {
    // successThreshold=2, timeoutMs=0
    const cb = new CircuitBreaker('cb', 1, 0, 2);
    await cb.call(() => Promise.reject(new Error('fail'))).catch(() => {});

    const successFn = vi.fn().mockResolvedValue('ok');
    await cb.call(successFn);
    expect(cb.getState()).toBe(CircuitBreakerState.HALF_OPEN);

    await cb.call(successFn);
    expect(cb.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it('propagates underlying function error', async () => {
    await expect(breaker.call(() => Promise.reject(new Error('upstream down')))).rejects.toThrow(
      'upstream down',
    );
  });
});

// ---------------------------------------------------------------------------
// RequestDeduplicator
// ---------------------------------------------------------------------------

describe('RequestDeduplicator', () => {
  let dedup: RequestDeduplicator;

  beforeEach(() => {
    dedup = new RequestDeduplicator();
  });

  it('executes function on first call', async () => {
    const fn = vi.fn().mockResolvedValue('data');
    const result = await dedup.dedupe('key1', fn, 5000);

    expect(result).toBe('data');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns cached promise for duplicate key within TTL', async () => {
    const fn = vi.fn().mockResolvedValue('cached');

    await dedup.dedupe('key1', fn, 5000);
    await dedup.dedupe('key1', fn, 5000);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls function again after TTL expires', async () => {
    const fn = vi.fn().mockResolvedValue('fresh');

    // Use TTL=1ms so it expires almost immediately
    await dedup.dedupe('key1', fn, 1);

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 5));

    await dedup.dedupe('key1', fn, 1);

    expect(fn).toHaveBeenCalledTimes(2);
  }, 500);

  it('removes entry from cache on rejection', async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error('fail');
      return 'retry success';
    });

    await dedup.dedupe('key1', fn, 5000).catch(() => {});

    // After failure, cache should be cleared — second call should re-execute
    const result = await dedup.dedupe('key1', fn, 5000);

    expect(result).toBe('retry success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not share cache entries across different keys', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    await dedup.dedupe('key-a', fn, 5000);
    await dedup.dedupe('key-b', fn, 5000);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('tracks cache size correctly', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    expect(dedup.size()).toBe(0);

    await dedup.dedupe('k1', fn, 5000);
    await dedup.dedupe('k2', fn, 5000);

    expect(dedup.size()).toBe(2);
  });

  it('clears all entries with clear()', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    await dedup.dedupe('k1', fn, 5000);
    dedup.clear();

    expect(dedup.size()).toBe(0);
  });
});
