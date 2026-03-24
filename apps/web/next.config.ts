import type { NextConfig } from 'next';

// ─── Content-Security-Policy ──────────────────────────────────────────────────
//
// The CSP is strict but allows Next.js to function on Vercel.
//
// Directives summary:
//  default-src   'self'                          — block everything by default
//  script-src    'self' 'unsafe-inline'          — Next.js requires inline scripts for hydration;
//                https://va.vercel-scripts.com     Vercel Analytics loader
//  style-src     'self' 'unsafe-inline'          — Tailwind injects styles at runtime
//  img-src       'self' data: blob:              — base64 data URIs (charts), blob (canvas exports)
//  connect-src   'self' wss: https://*.supabase.co — Supabase REST + Realtime WebSocket
//                https://vitals.vercel-insights.com  — Vercel Analytics beacon
//                https://va.vercel-scripts.com       — Vercel Analytics script
//  font-src      'self'                          — no external font CDNs (next/font serves locally)
//  frame-src     'none'                          — no iframes (mirrors X-Frame-Options: DENY)
//  object-src    'none'                          — no plugins
//  base-uri      'self'                          — prevent base-tag injection
//  form-action   'self'                          — forms may only POST to the same origin
//  upgrade-insecure-requests                     — upgrade http: sub-resources to https:
//
// NOTE: 'unsafe-inline' in script-src is required because Next.js injects inline
// <script> tags for hydration and chunk loading. To harden further, implement
// nonce-based CSP via a Next.js Proxy file (see Next.js docs on CSP with nonces).
//
// IMPORTANT: When adding a new third-party integration (analytics, maps, etc.)
// update connect-src and/or script-src here with the specific domain.

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' wss: https://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "font-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
]
  .join('; ')
  .trim();

// ─── HTTP security headers ────────────────────────────────────────────────────

const securityHeaders = [
  // Referrer: send origin only, never full URL across origins
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // Prevent MIME-type sniffing (XSS vector)
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Block embedding this app in foreign iframes (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },

  // Restrict access to sensitive browser features
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },

  // Force HTTPS for 1 year; include subdomains; submit to preload list
  // Only applied in production — dev runs on http://localhost so HSTS would break it.
  // Vercel strips this header automatically on non-HTTPS requests, but we guard via
  // the conditional below to be explicit.
  ...(process.env.NODE_ENV === 'production'
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains; preload',
        },
      ]
    : []),

  // Content Security Policy (see above for directive documentation)
  { key: 'Content-Security-Policy', value: CSP },
];

// ─── Next.js config ───────────────────────────────────────────────────────────

const nextConfig: NextConfig = {
  // 'standalone' is required for Docker builds (copies only needed node_modules).
  // On Vercel, standard output is expected — standalone causes 404s.
  // Set STANDALONE_BUILD=1 in Docker (or any non-Vercel) builds.
  ...(process.env.STANDALONE_BUILD === '1' ? { output: 'standalone' } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
