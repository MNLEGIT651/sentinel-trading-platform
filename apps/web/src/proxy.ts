import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/server';
import { proxyRateLimiter, rateLimitResponse } from '@/lib/server/rate-limiter';

// ─── Route classification ──────────────────────────────────────────────────

/** Page routes that are accessible without authentication. */
const PUBLIC_ROUTES = new Set(['/login', '/signup']);

/**
 * Path prefixes that bypass the auth gate.
 *
 * API routes under /api/ are intentionally excluded here — they handle
 * their own authentication and must return JSON errors, not HTML redirects.
 * Only truly public non-API paths belong in this list.
 */
const PUBLIC_PREFIXES = ['/auth/', '/api/health'];

/** Static assets and well-known files that never need auth. */
const PUBLIC_FILES = new Set(['/favicon.ico', '/robots.txt', '/sitemap.xml']);

/**
 * Returns true for paths that are API routes (start with /api/).
 *
 * API routes must never receive an HTML redirect — callers expect JSON.
 * When unauthenticated, the middleware returns a 401 JSON response instead
 * of a 3xx redirect; the route handler itself then further validates the
 * session for routes that need it (e.g. /api/agents/*).
 */
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  if (PUBLIC_FILES.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// ─── Middleware ────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate-limit API proxy routes before doing any auth work.
  // Use the forwarded IP (set by Vercel/load-balancer) as the client key;
  // fall back to a constant so local dev is never accidentally blocked.
  if (isApiRoute(pathname) && !isPublicRoute(pathname)) {
    const clientKey =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'localhost';
    const rl = proxyRateLimiter.check(clientKey);
    if (!rl.allowed) {
      return rateLimitResponse(rl.resetAtMs);
    }
  }

  // Always refresh session cookies (even on public routes) so Supabase
  // token rotation is handled transparently on every request.
  const { user, supabaseResponse } = await updateSession(request);

  // Authenticated users hitting auth pages → redirect to dashboard
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Public routes → allow through regardless of auth state
  if (isPublicRoute(pathname)) {
    return supabaseResponse;
  }

  // Unauthenticated users on API routes → JSON 401 (not HTML redirect).
  // Route handlers perform their own finer-grained auth checks; this is a
  // belt-and-suspenders guard so bare API calls never receive HTML.
  if (!user && isApiRoute(pathname)) {
    return NextResponse.json(
      { error: 'unauthorized', detail: 'Authentication required.' },
      { status: 401 },
    );
  }

  // Unauthenticated users on page routes → redirect to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Preserve the intended destination so we can redirect after sign-in
    if (pathname !== '/') {
      url.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
