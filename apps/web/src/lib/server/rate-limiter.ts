/**
 * Lightweight in-process sliding-window rate limiter for Next.js API routes.
 *
 * ## Design constraints and trade-offs
 *
 * This is an **in-process** implementation — state lives in a module-level
 * Map that is local to a single Node.js worker. On Vercel, each region runs
 * multiple serverless function instances concurrently, so the effective
 * limit seen by a single client is `LIMIT_PER_WINDOW × number_of_instances`.
 *
 * This is acceptable for a single-tenant trading platform where the primary
 * goal is to prevent runaway agent loops and accidental hammering, not to
 * enforce strict per-user metering at scale.
 *
 * **If you need globally consistent rate limiting** (e.g. for a public API),
 * replace `WindowStore` with a Redis-backed implementation using Upstash or
 * Vercel KV and the same `RateLimiter` interface.
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
  check(key: string): RateLimitResult {
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
export function checkApiRateLimit(userId: string): Response | null {
  const result = apiRateLimiter.check(userId);
  if (!result.allowed) {
    return rateLimitResponse(result.resetAtMs);
  }
  return null;
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
