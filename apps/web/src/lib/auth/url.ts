/**
 * Canonical URL helpers for auth redirects.
 *
 * Resolution order:
 * 1. NEXT_PUBLIC_SITE_URL  (explicit override — production domain)
 * 2. NEXT_PUBLIC_VERCEL_URL (auto-set by Vercel on every deployment)
 * 3. http://localhost:3000  (local development fallback)
 *
 * All returned URLs are normalized: https protocol (except localhost),
 * no trailing slash.
 */

/** Returns the canonical site URL without a trailing slash. */
export function getCanonicalUrl(): string {
  // Explicit override — always wins
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return normalizeUrl(siteUrl);

  // Vercel auto-sets this on every deployment (preview + production)
  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercelUrl) return normalizeUrl(vercelUrl);

  return 'http://localhost:3000';
}

/** Build the full email confirmation redirect URL. */
export function getEmailRedirectUrl(path = '/auth/callback'): string {
  return `${getCanonicalUrl()}${path}`;
}

/** Build the full password recovery redirect URL. */
export function getPasswordRecoveryRedirectUrl(): string {
  return `${getCanonicalUrl()}/auth/callback?next=/reset-password`;
}

/**
 * Sanitize a redirect target to prevent open-redirect attacks.
 *
 * Only allows relative same-origin paths. Returns '/' for anything
 * that looks like an absolute URL, protocol-relative URL, or
 * contains backslashes.
 */
export function sanitizeRedirectPath(next: string | null | undefined): string {
  if (!next) return '/';
  const trimmed = next.trim();
  if (!trimmed.startsWith('/')) return '/';
  if (trimmed.startsWith('//')) return '/';
  if (trimmed.includes('://')) return '/';
  if (trimmed.includes('\\')) return '/';
  // Prevent null-byte injection
  if (trimmed.includes('\0')) return '/';
  return trimmed;
}

/**
 * Alias for getCanonicalUrl — used when the intent is clearly SEO/metadata.
 * Helps distinguish from request-based origin logic (getRequestOrigin).
 */
export const getCanonicalSiteUrl = getCanonicalUrl;

/**
 * Derive the origin of the current request from its URL.
 *
 * Uses the standard URL.origin property which returns protocol + host of
 * the request target. This is the OWASP-recommended approach for CSRF
 * "target origin" matching — it correctly handles raw Vercel deployment
 * URLs, preview deployments, and canonical production aliases.
 *
 * Falls back to getCanonicalUrl() if the request URL cannot be parsed
 * (should not happen in practice with well-formed Request objects).
 */
export function getRequestOrigin(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return getCanonicalUrl();
  }
}

/**
 * Returns the canonical production hostname (without protocol or path).
 * Derived from NEXT_PUBLIC_SITE_URL. Returns null if not set.
 */
export function getCanonicalHost(): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return null;
  try {
    return new URL(normalizeUrl(siteUrl)).hostname;
  } catch {
    return null;
  }
}

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  // NEXT_PUBLIC_VERCEL_URL doesn't include protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  // Strip trailing slash
  return url.replace(/\/+$/, '');
}
