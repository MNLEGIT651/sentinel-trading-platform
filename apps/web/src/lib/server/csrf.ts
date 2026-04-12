/**
 * CSRF protection for state-changing API routes.
 *
 * ## Strategy: Origin header validation
 *
 * OWASP-recommended approach for cookie-based auth APIs. Works because:
 *
 * 1. Browsers always include the `Origin` header on cross-origin mutating
 *    requests (POST/PUT/PATCH/DELETE). Attackers cannot forge it from JS.
 * 2. For same-origin requests the `Origin` header matches the app's own URL.
 * 3. If `Origin` is absent (e.g. older browsers, privacy extensions) we
 *    fall back to the `Referer` header.
 * 4. If neither header is present, a custom `X-Requested-With` header is
 *    required. This blocks plain HTML form POSTs (which cannot set custom
 *    headers) while still allowing programmatic API clients that opt-in.
 *
 * ## When to use
 *
 * Call `checkCsrf(request)` at the top of every state-changing route handler
 * (POST, PUT, PATCH, DELETE) alongside `requireAuth` and `checkApiRateLimit`.
 *
 * ```ts
 * const csrf = checkCsrf(request);
 * if (csrf) return csrf;
 * ```
 *
 * GET and HEAD routes do NOT need CSRF protection because they should never
 * produce side-effects.
 *
 * ## Non-goals
 *
 * Token-based CSRF (synchronizer tokens / double-submit cookies) is not
 * needed here because:
 * - All state-changing routes require Supabase cookie-based auth
 * - The SPA exclusively uses `fetch()` with JSON bodies (not form POSTs)
 * - Origin validation is sufficient for this threat model
 */

import { getRequestOrigin } from '@/lib/auth/url';

// ─── Types ────────────────────────────────────────────────────────────────

export interface CsrfValidationResult {
  allowed: boolean;
  reason?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Validate that a mutating request originates from the same site.
 *
 * @returns `null` if the request passes CSRF validation, or a `403 Response`
 *          if the request appears to be a cross-origin forgery attempt.
 */
export function checkCsrf(request: Request): Response | null {
  const result = validateOrigin(request);
  if (result.allowed) return null;

  return new Response(
    JSON.stringify({
      error: 'csrf_rejected',
      detail: result.reason ?? 'Cross-origin request blocked.',
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

/**
 * Pure validation logic (exported for testability).
 *
 * Checks in order:
 * 1. `Origin` header matches expected origin → allow
 * 2. `Referer` header origin matches expected origin → allow
 * 3. `X-Requested-With` header is present → allow (programmatic client)
 * 4. Otherwise → reject
 */
export function validateOrigin(request: Request): CsrfValidationResult {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  // Derive expected origin from the request's own URL (OWASP target-origin
  // matching).  This correctly handles raw Vercel deployment URLs, preview
  // deployments, and canonical production aliases — the browser's Origin
  // header will match the host the user is actually on.
  const expectedOrigin = getRequestOrigin(request);

  // 1. Check Origin header (most reliable — set by all modern browsers)
  if (origin) {
    if (isSameOrigin(origin, expectedOrigin)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Origin mismatch: got "${origin}", expected "${expectedOrigin}".`,
    };
  }

  // 2. Fall back to Referer header
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (isSameOrigin(refererOrigin, expectedOrigin)) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Referer origin mismatch: got "${refererOrigin}", expected "${expectedOrigin}".`,
      };
    } catch {
      return { allowed: false, reason: 'Malformed Referer header.' };
    }
  }

  // 3. Accept requests with a custom header (non-browser programmatic clients)
  const xRequestedWith = request.headers.get('x-requested-with');
  if (xRequestedWith) {
    return { allowed: true };
  }

  // 4. No provenance header at all — block
  return {
    allowed: false,
    reason: 'Missing Origin, Referer, and X-Requested-With headers.',
  };
}

// ─── Internals ────────────────────────────────────────────────────────────

/** Case-insensitive origin comparison. */
function isSameOrigin(provided: string, expected: string): boolean {
  return provided.toLowerCase() === expected.toLowerCase();
}

// ─── Mutation rate limiter ─────────────────────────────────────────────────
//
// State-changing routes get a tighter rate limit than the general API limiter
// (20/min vs 60/min) to reduce blast radius from compromised sessions or
// runaway automation hitting order submission, journal writes, etc.
//
// Usage (alongside the general `checkApiRateLimit`):
//
//   const mrl = checkMutationRateLimit(user.id);
//   if (mrl) return mrl;

import { RateLimiter, rateLimitResponse } from '@/lib/server/rate-limiter';

/**
 * Stricter rate limiter for state-changing routes only.
 * 20 requests per minute per user — enough for interactive use,
 * tight enough to limit automated abuse.
 */
export const mutationRateLimiter = new RateLimiter(20, 60_000);

/**
 * Check mutation-specific rate limit for an authenticated user.
 * Returns `null` if allowed, or a `429 Response` if rate-limited.
 */
export function checkMutationRateLimit(userId: string): Response | null {
  const result = mutationRateLimiter.check(userId);
  if (!result.allowed) {
    return rateLimitResponse(result.resetAtMs);
  }
  return null;
}
