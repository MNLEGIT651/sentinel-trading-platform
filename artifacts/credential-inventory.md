# Credential & Secrets Inventory — Trading-App

**Date:** 2026-04-07
**Auditor:** Release Engineering Audit

## Executive Summary

38 unique environment variables across 4 platforms (GitHub, Vercel, Railway, Supabase).
Variables are classified by platform, scope, and whether missing would block production.

---

## 1. GitHub Actions Secrets

| Variable                    | Workflows            | Required    | Purpose                                  | Blocking if Missing |
| --------------------------- | -------------------- | ----------- | ---------------------------------------- | :-----------------: |
| `RAILWAY_TOKEN`             | railway-deploy.yml   | Production  | Railway CLI auth for deploys             |       ✅ Yes        |
| `RAILWAY_ENGINE_SERVICE_ID` | railway-deploy.yml   | Production  | Identifies engine service for deploy     |       ✅ Yes        |
| `RAILWAY_ENGINE_URL`        | railway-deploy.yml   | Production  | Engine health-check endpoint post-deploy |       ✅ Yes        |
| `RAILWAY_AGENTS_SERVICE_ID` | railway-deploy.yml   | Production  | Identifies agents service for deploy     |       ✅ Yes        |
| `RAILWAY_AGENTS_URL`        | railway-deploy.yml   | Production  | Agents health-check endpoint post-deploy |       ✅ Yes        |
| `SUPABASE_ACCESS_TOKEN`     | supabase-typegen.yml | Conditional | Supabase CLI auth for typegen            | ⚠️ Skips gracefully |
| `SUPABASE_PROJECT_REF`      | supabase-typegen.yml | Conditional | Target project for typegen               | ⚠️ Skips gracefully |
| `VERCEL_PRODUCTION_URL`     | railway-deploy.yml   | Production  | Proxy verification post-deploy           |       ✅ Yes        |

### GitHub Actions Variables (non-secret)

| Variable                                       | Workflows                      | Purpose                         |
| ---------------------------------------------- | ------------------------------ | ------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                     | ci.yml, release-management.yml | Build-time Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | ci.yml, release-management.yml | Build-time Supabase public key  |
| `SUPABASE_SERVICE_ROLE_KEY`                    | ci.yml, release-management.yml | Server-side Supabase admin key  |

---

## 2. Vercel Environment Variables

### Client-Side (NEXT*PUBLIC*\*)

| Variable                                       | Scope                | Required | Purpose                  |
| ---------------------------------------------- | -------------------- | -------- | ------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`                     | Preview + Production | ✅ Yes   | Supabase project URL     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Preview + Production | ✅ Yes   | Supabase public/anon key |
| `NEXT_PUBLIC_VERCEL_URL`                       | Auto-set by Vercel   | Auto     | Current deployment URL   |

### Server-Side Only

| Variable                    | Scope                | Required | Purpose                              |
| --------------------------- | -------------------- | -------- | ------------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview + Production | ✅ Yes   | Admin DB access (server routes only) |
| `ENGINE_URL`                | Preview + Production | ✅ Yes   | Quant engine base URL                |
| `ENGINE_API_KEY`            | Preview + Production | ✅ Yes   | Web→engine authentication            |
| `CRON_SECRET`               | Production           | ✅ Yes   | Vercel cron endpoint protection      |

### Supabase Key Naming (compatibility chain)

The web app (`apps/web/src/lib/env.ts`) supports three Supabase key names with fallback:

1. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (newest format)
2. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (current standard)
3. `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy)

**Recommendation:** Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` everywhere. CI already does.

---

## 3. Railway Environment Variables

### Engine Service (`apps/engine`)

| Variable                    | Required | Purpose                                     |
| --------------------------- | -------- | ------------------------------------------- |
| `SUPABASE_URL`              | ✅ Yes   | Database connection URL                     |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes   | Admin DB access                             |
| `ENGINE_API_KEY`            | ✅ Yes   | Authenticate requests from web              |
| `POLYGON_API_KEY`           | ✅ Yes   | Market data provider                        |
| `ALPACA_API_KEY`            | ✅ Yes   | Trading API key                             |
| `ALPACA_SECRET_KEY`         | ✅ Yes   | Trading API secret                          |
| `ALPACA_BASE_URL`           | Optional | Default: `https://paper-api.alpaca.markets` |
| `BROKER_MODE`               | Optional | Default: `paper`                            |
| `CORS_ORIGINS`              | Optional | Default: `http://localhost:3000`            |
| `PORT`                      | Optional | Default: `8000`                             |

### Agents Service (`apps/agents`)

| Variable                    | Required | Purpose                                                   |
| --------------------------- | -------- | --------------------------------------------------------- |
| `SUPABASE_URL`              | ✅ Yes   | Database connection URL                                   |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes   | Admin DB access                                           |
| `ENGINE_URL`                | ✅ Yes   | Quant engine URL (can use Railway private networking)     |
| `ENGINE_API_KEY`            | ✅ Yes   | Authenticate to engine                                    |
| `ANTHROPIC_API_KEY`         | ✅ Yes   | Claude AI API access                                      |
| `WEB_URL`                   | Optional | CORS origin for agents (default: `http://localhost:3000`) |
| `PORT`                      | Optional | Default: `3001`                                           |

### Railway Private Networking Note

Engine URL can use Railway's private networking: `http://sentinel-engine.railway.internal:8000`
This bypasses public internet for inter-service communication.

---

## 4. Supabase Dashboard Settings

| Setting            | Location                        | Purpose                        |        Repo-Verifiable        |
| ------------------ | ------------------------------- | ------------------------------ | :---------------------------: |
| Auth redirect URLs | Dashboard → Auth → URL Config   | OAuth/magic-link callback URLs |       ❌ Dashboard only       |
| RLS policies       | Dashboard → Database → Policies | Row-level security rules       | ⚠️ Partially (via migrations) |
| API keys           | Dashboard → Settings → API      | Project keys for client/server |       ❌ Dashboard only       |
| Service role key   | Dashboard → Settings → API      | Admin access key               |       ❌ Dashboard only       |

### Required Redirect URLs

- `https://<production-domain>/auth/callback`
- `https://*-<vercel-team>.vercel.app/auth/callback` (preview deployments)
- `http://localhost:3000/auth/callback` (local dev)

---

## 5. Variables in Workflows but NOT in .env.example

| Variable                   | Where Used        | Status                           |
| -------------------------- | ----------------- | -------------------------------- |
| `ANTHROPIC_API_KEY`        | agents runtime    | ⚠️ **Missing from .env.example** |
| `WEB_URL`                  | agents runtime    | ⚠️ **Missing from .env.example** |
| `ALPACA_BROKER_API_KEY`    | engine (optional) | ⚠️ **Missing from .env.example** |
| `ALPACA_BROKER_API_SECRET` | engine (optional) | ⚠️ **Missing from .env.example** |
| `ALPACA_BROKER_API_URL`    | engine (optional) | ⚠️ **Missing from .env.example** |
| `PORT`                     | engine/agents     | ℹ️ Has defaults, not critical    |

---

## 6. Blocking vs Non-Blocking

### Production Blocking (deploy will fail or be broken)

- All Railway secrets (RAILWAY_TOKEN, service IDs, URLs)
- Supabase keys (URL, service role, public key)
- ENGINE_URL, ENGINE_API_KEY
- POLYGON_API_KEY, ALPACA_API_KEY, ALPACA_SECRET_KEY
- CRON_SECRET

### Non-Blocking (feature degradation only)

- SUPABASE_ACCESS_TOKEN (typegen skips gracefully)
- BROKER_MODE, CORS_ORIGINS, PORT (have defaults)
- ALPACA*BROKER*\* (optional account provisioning)

### Dashboard-Only (cannot verify from repo)

- Supabase auth redirect URLs
- Supabase RLS policies
- Vercel env var values (only names are verifiable)
- Railway env var values
