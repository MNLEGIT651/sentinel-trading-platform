# Authentication & Session Security

## Overview

Sentinel uses Supabase Auth for user authentication. All sessions are managed
via Supabase's built-in JWT + refresh-token mechanism with `@supabase/ssr`.

## Authentication Flow

1. **Login/Signup** — Users authenticate via email/password through Supabase Auth
2. **Session Storage** — Supabase SSR stores tokens in HTTP-only cookies
3. **Token Refresh** — The Next.js middleware refreshes tokens on every request
4. **Protected Routes** — Middleware redirects unauthenticated users to `/login`
5. **API Routes** — Return JSON `401` for unauthenticated API calls

## CSRF Protection

- **SameSite cookies** — Supabase SSR sets `SameSite=Lax` by default
- **State-changing operations** — All mutations go through server-side API routes
  that validate the Supabase session before proxying to engine/agents
- **No client-side tokens** — The browser never sees raw JWTs; all auth is
  cookie-based through the Next.js server

## Cookie Security

| Attribute | Value      | Rationale                                |
| --------- | ---------- | ---------------------------------------- |
| HttpOnly  | Yes        | Prevents XSS from reading session tokens |
| Secure    | Yes (prod) | Prevents MITM in production              |
| SameSite  | Lax        | Blocks cross-origin form submissions     |
| Path      | /          | Available to all routes                  |

## Internal Service Auth

- **Engine API Key** — `ENGINE_API_KEY` shared secret, passed via `Authorization: Bearer` or `X-API-Key` header
- **Agents → Engine** — Agents call engine with the same API key
- **Web → Engine/Agents** — Next.js server-side proxy adds auth headers; browser never sees backend URLs

## API Key Rotation

1. Generate a new `ENGINE_API_KEY` value
2. Update in Railway/Vercel environment variables for all 3 services
3. Restart services (engine first, then agents, then web)
4. Previous key is immediately invalid — no grace period

## Rate Limiting

- Web proxy middleware enforces per-IP rate limits on API routes
- Engine has its own in-memory rate limiter per endpoint
- Agent scheduler enforces cooldowns between agent runs

## Security Headers

Configured in `apps/web/next.config.ts`:

- Content-Security-Policy (strict, no unsafe-eval)
- Strict-Transport-Security (HSTS, production only)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: blocks camera, microphone, geolocation

## Row-Level Security (RLS)

All user-owned tables enforce `auth.uid() = user_id` via Supabase RLS policies.
Shared tables (instruments, market_data, strategies) are read-only for all authenticated users.

## Recommendations

- [ ] Consider adding 2FA via Supabase Auth providers
- [ ] Add session timeout (configurable idle timeout)
- [ ] Implement audit logging for admin actions
- [ ] Consider IP-based session binding for high-value accounts
