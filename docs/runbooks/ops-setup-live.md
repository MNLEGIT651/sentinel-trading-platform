# Live Production Ops Setup

_Last updated: 2026-04-12_

Step-by-step guide for completing the infrastructure setup required to go live.
These are **one-time ops tasks** that cannot be done via code — they require
dashboard access to Sentry, Railway, Vercel, GitHub, and Supabase.

---

## 1. Sentry Error Tracking

### 1.1 Create Sentry Project

1. Go to [sentry.io](https://sentry.io) → Create Organization (or use existing)
2. Create Project → Platform: **Python** → Framework: **FastAPI**
3. Copy the **DSN** from Project Settings → Client Keys (DSN)
   - Format: `https://<key>@<org>.ingest.sentry.io/<project-id>`

### 1.2 Set Railway Engine Secrets

In Railway Dashboard → `sentinel-engine` → Variables:

```
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project-id>
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### 1.3 Verify

After Railway redeploys:
- Engine logs show: `Sentry initialised (env=production, sample_rate=0.10)`
- Trigger a test error → appears in Sentry dashboard within seconds

---

## 2. GitHub CI Secrets

In GitHub → Settings → Secrets and variables → Actions → New repository secret:

### 2.1 VERCEL_PREVIEW_SMOKE_URL

This is the URL of your Vercel preview deployment used by the Synthetic Proxy
Smoke CI workflow.

```
Name:  VERCEL_PREVIEW_SMOKE_URL
Value: https://<your-project>.vercel.app
```

To find your preview URL:
1. Go to Vercel Dashboard → your project → Deployments
2. Copy the URL of any preview deployment (not production)
3. Or use the project-level URL: `https://<project-name>.vercel.app`

### 2.2 Verify

Push any commit to a PR branch — the "Synthetic Proxy Smoke" check should now
pass (or fail on actual smoke test failures rather than missing secret).

---

## 3. Supabase Migration

Run migration `00034_reconciliation_snapshots.sql` to create the audit table.

### Option A: Supabase CLI (if available locally)

```bash
supabase db push
```

### Option B: Supabase Studio SQL Editor

1. Go to Supabase Dashboard → SQL Editor
2. Paste contents of `supabase/migrations/00034_reconciliation_snapshots.sql`
3. Click "Run"

### Option C: Via linked Supabase project

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### Verify

```sql
SELECT count(*) FROM reconciliation_snapshots;
-- Should return 0 (table exists, no rows yet)
```

---

## 4. Railway Environment Variables (Complete Matrix)

All variables for `sentinel-engine` in Railway production:

| Variable | Value | Notes |
|----------|-------|-------|
| `SUPABASE_URL` | `https://<ref>.supabase.co` | From Supabase Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | From Supabase Settings → API |
| `ENGINE_API_KEY` | `<strong-random-string>` | Must match Vercel's `ENGINE_API_KEY` |
| `POLYGON_API_KEY` | `<polygon-key>` | polygon.io dashboard |
| `ALPACA_API_KEY` | `<paper-or-live-key>` | Alpaca dashboard |
| `ALPACA_SECRET_KEY` | `<paper-or-live-secret>` | Alpaca dashboard |
| `ALPACA_BASE_URL` | `https://paper-api.alpaca.markets` | Change to `https://api.alpaca.markets` for live |
| `BROKER_MODE` | `paper` | Change to `live` when ready |
| `CORS_ORIGINS` | `https://<your-domain>.vercel.app` | Production domain |
| `SENTRY_DSN` | `https://...@sentry.io/...` | From §1 above |
| `SENTRY_ENVIRONMENT` | `production` | |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | Increase for debugging, keep low in steady-state |
| `ORDER_RECONCILIATION_INTERVAL_SECONDS` | `30` | Default; 0 to disable |
| `PORTFOLIO_RECONCILIATION_INTERVAL_SECONDS` | `3600` | Default 1h; 86400 for nightly |
| `LOG_LEVEL` | `INFO` | `DEBUG` for troubleshooting |
| `RATE_LIMIT_PER_MINUTE` | `100` | Increase if legitimate traffic exceeds |

---

## 5. Vercel Environment Variables

In Vercel Dashboard → your project → Settings → Environment Variables:

| Variable | Environment | Value |
|----------|-------------|-------|
| `ENGINE_URL` | Production + Preview | `https://<railway-engine-url>` |
| `ENGINE_API_KEY` | Production + Preview | Must match Railway's `ENGINE_API_KEY` |
| `AGENTS_URL` | Production + Preview | `https://<railway-agents-url>` |
| `SENTRY_DSN` | Production + Preview | Same DSN (or separate web project) |

---

## 6. Live Trading Activation (When Ready)

> **This is a one-way door.** Only proceed after paper trading is validated.

See `docs/runbooks/release-checklist.md` §5.4 for the full activation checklist.

Summary:
1. Rotate Alpaca credentials to **live** keys in Railway
2. Change `ALPACA_BASE_URL` to `https://api.alpaca.markets`
3. Redeploy engine, verify health
4. Dry-run: confirm `POST /orders` returns 403 (gate still blocking)
5. Flip gate: `PATCH /api/system-controls { "live_execution_enabled": true, "global_mode": "live" }`
6. Submit $1 smoke order
7. Monitor order reconciliation logs

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-04-12 | Claude | Initial ops setup guide covering Sentry, GitHub secrets, Supabase migration, Railway/Vercel env matrix, live activation summary |
