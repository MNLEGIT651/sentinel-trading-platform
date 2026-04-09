/**
 * Next.js Middleware — Global security enforcement.
 *
 * Applies to all `/api/` routes and enforces:
 * 1. CSRF protection on state-changing methods (POST, PUT, PATCH, DELETE)
 * 2. Skips CSRF for webhook routes (they use HMAC signature verification)
 * 3. Skips CSRF for health/internal/GET routes
 *
 * This centralises security checks so individual route handlers don't need
 * to call `checkCsrf()` manually — new routes are protected automatically.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getCanonicalUrl } from '@/lib/auth/url';

/** Methods that mutate state and therefore require CSRF validation. */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * API route prefixes exempt from CSRF checks.
 * - Webhooks: authenticated by HMAC signature, not browser cookies
 * - Internal cron: authenticated by bearer token
 * - Health: read-only status endpoints
 */
const CSRF_EXEMPT_PREFIXES = ['/api/webhooks/', '/api/internal/', '/api/health'];

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isSameOrigin(provided: string, expected: string): boolean {
  return provided.toLowerCase() === expected.toLowerCase();
}

function getExpectedOrigin(): string {
  return getCanonicalUrl().replace(/\/$/, '');
}

function validateCsrf(request: NextRequest): { allowed: boolean; reason?: string } {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const expected = getExpectedOrigin();

  if (origin) {
    return isSameOrigin(origin, expected)
      ? { allowed: true }
      : { allowed: false, reason: `Origin mismatch: got "${origin}", expected "${expected}".` };
  }

  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      return isSameOrigin(refererOrigin, expected)
        ? { allowed: true }
        : {
            allowed: false,
            reason: `Referer origin mismatch: got "${refererOrigin}", expected "${expected}".`,
          };
    } catch {
      return { allowed: false, reason: 'Malformed Referer header.' };
    }
  }

  if (request.headers.get('x-requested-with')) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Missing Origin, Referer, and X-Requested-With headers.' };
}

export function middleware(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;

  // Only enforce CSRF on API mutation routes
  if (
    pathname.startsWith('/api/') &&
    MUTATION_METHODS.has(request.method) &&
    !isCsrfExempt(pathname)
  ) {
    const result = validateCsrf(request);
    if (!result.allowed) {
      return NextResponse.json(
        { error: 'csrf_rejected', detail: result.reason ?? 'Cross-origin request blocked.' },
        { status: 403 },
      );
    }
  }

  return undefined;
}

export const config = {
  matcher: '/api/:path*',
};
