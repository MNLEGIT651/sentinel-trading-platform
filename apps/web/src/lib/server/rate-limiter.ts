/**
 * Rate limiter for Next.js API routes with Redis REST support.
 *
 * ## Design constraints and trade-offs
 *
 * When `RATE_LIMIT_REDIS_REST_URL` and `RATE_LIMIT_REDIS_REST_TOKEN` are set,
 * this limiter uses a shared Redis backend (Upstash Redis REST-compatible).
 * If Redis is unavailable, it falls back to an in-process sliding window so
 * local development remains functional.
 *
 * ## Usage
 *
 * ```ts
 * import { proxyRateLimiter, rateLimitResponse } from '@/lib/server/rate-limiter';
 *
 * const result = proxyRateLimiter.check(clientKey);
 * if (!result.allowed) return rateLimitResponse(result.resetAtMs);
 * ```
 */

export interface RateLimitResult {
  /** Whether the request is within the limit. */
  allowed: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Unix timestamp (ms) when the current window resets. */
  resetAtMs: number;
}

interface WindowEntry {
  count: number;
  windowStartMs: number;
}

// ─── In-process store ─────────────────────────────────────────────────────

/**
 * In-process sliding-window store.
 * The Map is cleared of stale entries during each `check()` call to prevent
 * unbounded memory growth when the set of clients is large or churning.
 */
class WindowStore {
  private readonly store = new Map<string, WindowEntry>();
  private lastCleanedAt = Date.now();

  get(key: string): WindowEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: WindowEntry): void {
    this.store.set(key, entry);
  }

  /**
   * Remove entries whose window has expired.
   * Runs at most once per `cleanIntervalMs` to amortise the cost.
   */
  clean(windowMs: number, cleanIntervalMs = 60_000): void {
    const now = Date.now();
    if (now - this.lastCleanedAt < cleanIntervalMs) return;
    this.lastCleanedAt = now;
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStartMs > windowMs) {
        this.store.delete(key);
      }
    }
  }
}

// ─── Rate limiter ─────────────────────────────────────────────────────────

export class RateLimiter {
  private readonly store = new WindowStore();
  private readonly redis = createRedisRateLimiterClient();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /**
   * Check whether `key` is within the rate limit.
   * Increments the counter for the current window.
   *
   * @param key  Typically the client identifier: IP, user ID, or composite.
   */
  async check(key: string): Promise<RateLimitResult> {
    const redisResult = await this.redis?.check(key, this.limit, this.windowMs);
    if (redisResult) return redisResult;

    this.store.clean(this.windowMs);

    const now = Date.now();
    const existing = this.store.get(key);

    // Start a fresh window if none exists or the old window has expired
    if (!existing || now - existing.windowStartMs >= this.windowMs) {
      const entry: WindowEntry = { count: 1, windowStartMs: now };
      this.store.set(key, entry);
      return {
        allowed: true,
        remaining: this.limit - 1,
        resetAtMs: now + this.windowMs,
      };
    }

    existing.count += 1;
    const resetAtMs = existing.windowStartMs + this.windowMs;

    if (existing.count > this.limit) {
      return { allowed: false, remaining: 0, resetAtMs };
    }

    return {
      allowed: true,
      remaining: this.limit - existing.count,
      resetAtMs,
    };
  }
}

// ─── Shared instances ─────────────────────────────────────────────────────

/**
 * Rate limiter applied to all `/api/engine/*` and `/api/agents/*` proxy routes.
 *
 * Limit: 120 requests per minute per client key (IP address in practice).
 * Rationale: a legitimate dashboard polling every 15s generates ~4 req/min;
 * 120/min provides 30× headroom for interactive use and bursty agent cycles
 * while still blocking runaway loops that could exhaust Railway quotas.
 */
export const proxyRateLimiter = new RateLimiter(120, 60_000);

/**
 * Rate limiter applied to all direct API routes (non-proxy).
 *
 * Limit: 60 requests per minute per user ID.
 * Rationale: most dashboard interactions are < 10 req/min.
 * 60/min gives 6× headroom while blocking abuse.
 */
export const apiRateLimiter = new RateLimiter(60, 60_000);

/**
 * Check the API rate limit for an authenticated user.
 * Returns null if allowed, or a 429 Response if rate-limited.
 */
export async function checkApiRateLimit(userId: string): Promise<Response | null> {
  const result = await apiRateLimiter.check(userId);
  if (!result.allowed) {
    return rateLimitResponse(result.resetAtMs);
  }
  return null;
}

interface RedisCheckResult {
  result: number | string;
}

interface RedisPipelineResponse {
  result: RedisCheckResult[];
}

interface RedisRateLimiterClient {
  check(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null>;
}

function createRedisRateLimiterClient(): RedisRateLimiterClient | null {
  const baseUrl = process.env.RATE_LIMIT_REDIS_REST_URL?.replace(/\/+$/, '');
  const token = process.env.RATE_LIMIT_REDIS_REST_TOKEN;
  if (!baseUrl || !token) return null;

  return {
    async check(key, limit, windowMs) {
      const bucket = `sentinel:rate-limit:${key}`;
      const now = Date.now();
      try {
        const response = await fetch(`${baseUrl}/pipeline`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            ['INCR', bucket],
            ['PTTL', bucket],
            ['PEXPIRE', bucket, String(windowMs), 'NX'],
          ]),
          cache: 'no-store',
        });
        if (!response.ok) return null;

        const payload = (await response.json()) as RedisPipelineResponse;
        const count = Number(payload.result?.[0]?.result ?? 0);
        const ttlMs = Number(payload.result?.[1]?.result ?? -1);
        const safeTtl = ttlMs > 0 ? ttlMs : windowMs;
        const resetAtMs = now + safeTtl;

        return {
          allowed: count <= limit,
          remaining: Math.max(0, limit - count),
          resetAtMs,
        };
      } catch {
        return null;
      }
    },
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────

/**
 * Build a 429 Response with standard `Retry-After` and `X-RateLimit-*` headers.
 */
export function rateLimitResponse(resetAtMs: number): Response {
  const retryAfterSeconds = Math.ceil((resetAtMs - Date.now()) / 1_000);
  return new Response(
    JSON.stringify({
      error: 'rate_limited',
      detail: 'Too many requests. Please slow down.',
      retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': '120',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(resetAtMs / 1_000)),
      },
    },
  );
}
