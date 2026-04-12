# Vercel Host & Origin Policy

> Canonical reference for how the Sentinel web app handles hostnames,
> CSRF origin validation, and production/preview URL behavior.

## Canonical Production Hostname

```
https://sentinel-trading-platform.vercel.app
```

Configured via `NEXT_PUBLIC_SITE_URL` in the Vercel project environment variables.

## Host Policy Summary

| Environment                                          | Behavior                                              |
| ---------------------------------------------------- | ----------------------------------------------------- |
| **Production** (page GET/HEAD on non-canonical host) | 308 redirect to canonical host                        |
| **Production** (API on non-canonical host)           | No redirect — CSRF uses request-based origin matching |
| **Production** (canonical host)                      | Normal request flow                                   |
| **Preview**                                          | No redirect — works on its own deployment hostname    |
| **Local dev**                                        | No redirect — `http://localhost:3000`                 |

## CSRF Origin Validation

The CSRF layer uses **OWASP target-origin matching**: it compares the
browser's `Origin` header against the origin derived from the request's
own URL (`new URL(request.url).origin`).

This means:

- On the canonical host, Origin must match `https://sentinel-trading-platform.vercel.app`
- On a raw deployment URL, Origin must match that deployment's origin
- On a preview branch URL, Origin must match that preview's origin
- Cross-origin requests (e.g., `https://evil.com`) are always blocked

### Why not compare against a fixed canonical URL?

The previous approach used `getCanonicalUrl()` (from `NEXT_PUBLIC_SITE_URL`)
as the single expected origin. This broke when users landed on raw Vercel
deployment URLs — the browser sends the deployment URL as the Origin, but the
server expected the canonical URL, causing 403 rejections on all mutations.

## URL Helper Architecture

Two distinct concepts, two distinct helpers:

### `getCanonicalUrl()` / `getCanonicalSiteUrl()` — SEO & metadata

Used by:

- `layout.tsx` → `metadataBase`
- `sitemap.ts` → sitemap URLs
- `getEmailRedirectUrl()` → auth email callbacks
- `getPasswordRecoveryRedirectUrl()` → password reset callbacks

Always returns the canonical production URL. **Not used for CSRF.**

### `getRequestOrigin(request)` — CSRF & runtime origin

Used by:

- `csrf.ts` → `validateOrigin()` target-origin matching

Derives the origin from the request's own URL. Correctly handles any
host that reaches the application.

### `getCanonicalHost()` — production redirect logic

Used by:

- `proxy.ts` → canonical host redirect

Returns just the hostname from `NEXT_PUBLIC_SITE_URL` for comparison
against the incoming request host.

## Environment Variables

| Variable                 | Purpose                                  | Set by             |
| ------------------------ | ---------------------------------------- | ------------------ |
| `NEXT_PUBLIC_SITE_URL`   | Canonical production URL                 | Vercel project env |
| `NEXT_PUBLIC_VERCEL_URL` | Per-deployment URL (auto)                | Vercel platform    |
| `VERCEL_ENV`             | `production` / `preview` / `development` | Vercel platform    |

## Trust Boundary

On Vercel, only domains configured in the project's domain settings can
route traffic to a deployment. Random external domains cannot reach the
app. The CSRF model trusts that `request.url` reflects a legitimate
Vercel-routed host.

## How to Verify

1. **Production canonical URL works:**

   ```
   curl -I https://sentinel-trading-platform.vercel.app
   ```

2. **Raw deployment URL redirects to canonical (pages):**

   ```
   curl -I https://trading-<hash>.vercel.app/portfolio
   # Should return 308 → sentinel-trading-platform.vercel.app/portfolio
   ```

3. **API requests on raw deployment URL work (no redirect):**

   ```
   curl -X POST https://trading-<hash>.vercel.app/api/signals/scan \
     -H "Origin: https://trading-<hash>.vercel.app" \
     -H "Content-Type: application/json"
   # Should NOT redirect; CSRF passes because Origin matches request host
   ```

4. **Cross-origin attack is blocked:**
   ```
   curl -X POST https://sentinel-trading-platform.vercel.app/api/signals/scan \
     -H "Origin: https://evil.com" \
     -H "Content-Type: application/json"
   # Should return 403 csrf_rejected
   ```

## Files

- `apps/web/src/lib/auth/url.ts` — URL helpers (canonical + request-based)
- `apps/web/src/lib/server/csrf.ts` — CSRF validation logic
- `apps/web/src/proxy.ts` — Middleware (canonical redirect + CSRF enforcement)
- `apps/web/src/app/layout.tsx` — Uses canonical URL for `metadataBase`
- `apps/web/src/app/sitemap.ts` — Uses canonical URL for sitemap
