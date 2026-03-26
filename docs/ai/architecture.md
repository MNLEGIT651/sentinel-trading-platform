# AI Architecture Guide

Use this file before changing code that crosses app boundaries.

## System Map

```text
apps/web     -> browser dashboard and Next.js routes
apps/engine  -> FastAPI quant engine and market/broker integrations
apps/agents  -> TypeScript agent orchestration service
packages/shared -> shared TypeScript contracts for web and agents
supabase     -> schema, RLS, realtime, seed data
```

## Dependency Boundaries

- `apps/web` talks to `apps/engine` over HTTP.
- `apps/agents` talks to `apps/engine` through its server-side `EngineClient`.
- `apps/web` and `apps/agents` share TypeScript contracts from `packages/shared`.
- Supabase is the persistence boundary and must stay aligned with both app behavior and any migrations.

## High-Risk Contracts

### Web <-> Engine

- Client-side engine calls must use `apps/web/src/lib/engine-fetch.ts`.
- Engine auth is enforced by `ApiKeyMiddleware` in `apps/engine/src/api/main.py`.
- Route handlers belong in `apps/engine/src/api/routes/`; business logic belongs in `apps/engine/src/`.

### Web UX Integrity

- Service status is driven by `apps/web/src/hooks/use-service-health.ts`.
- Global status state lives in `apps/web/src/stores/app-store.ts`.
- Outage states should keep `apps/web/src/components/ui/offline-banner.tsx` behavior intact.
- Simulated or fallback data should continue to use `apps/web/src/components/ui/simulated-badge.tsx`.

### Shared Contracts

- Shared types live in `packages/shared/src/`.
- Any change there can break both `apps/web` and `apps/agents`, so validate both sides.

### Persistence

- Migrations live in `supabase/migrations/`.
- Schema changes should be reviewed with the affected application flow in mind, not treated as isolated SQL edits.

## Change Heuristics

- If a change only touches `apps/web`, validate web lint/tests and usually a build.
- If a change touches `apps/engine`, validate Ruff plus pytest.
- If a change touches `packages/shared`, validate web and agents together.
- If a change touches `.github/workflows/ci.yml`, `package.json`, or `pnpm-lock.yaml`, assume it affects every collaborator.

## Sensitive Files

- `apps/web/src/lib/engine-fetch.ts`
- `apps/web/src/lib/engine-client.ts`
- `apps/web/src/hooks/use-service-health.ts`
- `apps/web/src/components/layout/app-shell.tsx`
- `apps/agents/src/engine-client.ts`
- `apps/engine/src/api/main.py`
- `apps/engine/src/config.py`
- `packages/shared/src/index.ts`
- `supabase/migrations/*`

## Trust Boundaries

```
Browser (untrusted)
  │
  ├─ NEXT_PUBLIC_* env vars only
  ├─ Supabase session cookies (HttpOnly, SameSite=Lax)
  │
  ▼
Next.js Server (trusted edge)
  │
  ├─ Rate limiting (middleware)
  ├─ Auth validation (Supabase getUser)
  ├─ Proxy to backends (server-side only)
  │
  ├──▶ Engine API (trusted internal)
  │     ├─ API key auth (ENGINE_API_KEY)
  │     ├─ CORS restricted
  │     ├─ Alpaca/Polygon external calls
  │     └─ Supabase service role
  │
  └──▶ Agents API (trusted internal)
        ├─ API key auth (ENGINE_API_KEY)
        ├─ CORS restricted
        ├─ Anthropic API calls
        └─ Supabase service role
```

## Notification Flow (Phase 4)

Agent cycle produces recommendations → stored in `agent_recommendations` table → Supabase Realtime pushes to web dashboard → NotificationCenter displays with badge count → User approves/rejects → Approved recommendations submitted to engine for execution.

## Security Automation (Phase 1)

CI pipeline includes: CodeQL SAST, Gitleaks secrets scanning, Trivy container scanning, OpenSSF Scorecard, OWASP ZAP DAST (manual trigger), SBOM generation on releases.

## Security & Notification Architecture

### Trust Boundaries

```
Browser ──► Next.js Server ──► Engine API (FastAPI)
                │                    │
                │                    ▼
                │              Alpaca/Polygon (3rd party)
                │
                ├──► Agents API (Express)
                │         │
                │         ▼
                │    Claude API (Anthropic)
                │
                └──► Supabase (PostgreSQL)
```

- Browser only communicates with Next.js origin (same-origin proxy)
- Engine and Agents are never exposed directly to browsers
- All inter-service auth uses `ENGINE_API_KEY` shared secret
- Supabase RLS enforces per-user data isolation

### Notification Flow

1. Agent generates recommendation/alert → writes to Supabase
2. Notification dispatcher (in agents) sends to configured channels:
   - **Email** via Resend API (when RESEND_API_KEY configured)
   - **In-app** via polling from web dashboard (30s interval)
   - **Push** via Web Push API (when VAPID keys configured)
3. User reviews in-app notification center or email
4. For trade recommendations: approve/reject triggers execution flow

### Security Automation

CI/CD pipeline runs 9 security-related workflows:

- Pre-merge: CodeQL SAST, Gitleaks secrets scan, dependency review
- Post-deploy: OWASP ZAP DAST baseline, Lighthouse audit
- Scheduled: Security safety audit (daily), container scan (weekly), Scorecard (weekly)
