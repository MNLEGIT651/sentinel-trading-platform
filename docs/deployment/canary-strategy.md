# Canary Deployment Strategy

This document describes the canary deployment approach for the Sentinel Trading Platform, covering all three services: the Next.js web app, the FastAPI engine, and the Express agents service.

## Architecture Overview

| Service    | Stack          | Host    | Deploy Trigger                                              |
| ---------- | -------------- | ------- | ----------------------------------------------------------- |
| **Web**    | Next.js 16     | Vercel  | Push to any branch (preview) / merge to `main` (production) |
| **Engine** | Python FastAPI | Railway | Push to `main` when `apps/engine/**` changes                |
| **Agents** | Node Express   | Railway | Push to `main` when `apps/agents/**` changes                |

## Web App — Vercel Preview as Canary

Vercel preview deployments act as built-in canary releases for the web app.

### How It Works

1. **Open a PR** — Vercel automatically creates a preview deployment with a unique URL.
2. **Validate** — QA, stakeholders, or automated tests run against the preview URL.
3. **Merge to `main`** — Vercel promotes the build to production automatically.
4. **Instant rollback** — If issues surface, roll back to a previous deployment from the Vercel dashboard in seconds.

### Benefits

- Every PR gets a fully isolated deployment — zero risk to production.
- Preview URLs are shareable for manual review.
- Branch-based environment variables let you test against staging backends.

## Railway Services — Rolling Deploys

Railway performs **rolling deployments** by default: a new container is started and health-checked before the old one is drained.

### Engine (FastAPI)

1. Code merged to `main` triggers the `Railway Deploy` workflow.
2. `railway up` pushes the new image.
3. Railway starts the new container and checks `GET /health`.
4. Traffic shifts to the new container once healthy; the old container shuts down gracefully.

### Agents (Express)

Same rolling deploy flow as the engine. The health endpoint is `GET /health`.

### Blue-Green Strategy (Optional Upgrade)

For zero-downtime deploys with instant rollback:

1. Maintain two Railway services per app: **blue** (active) and **green** (standby).
2. Deploy new code to the standby service.
3. Run smoke tests against the standby URL.
4. Swap the custom domain to point at the standby service.
5. The previously active service becomes the new standby.

> **Note:** This requires two Railway service instances per app and a DNS/proxy layer to swap traffic. Evaluate whether the added cost is justified for your traffic patterns.

## Rollback Procedures

### Vercel (Web App)

1. Open the [Vercel Dashboard → Deployments](https://vercel.com/dashboard).
2. Find the last known-good deployment.
3. Click **Promote to Production** — traffic shifts immediately.
4. No code revert needed; you can fix forward on a new branch.

### Railway (Engine & Agents)

**Option A — Redeploy previous commit:**

```bash
# Revert to the previous commit and push
git revert HEAD --no-edit
git push origin main
```

The deploy workflow will automatically deploy the reverted code.

**Option B — Railway dashboard rollback:**

1. Open the Railway project dashboard.
2. Select the service (engine or agents).
3. Go to **Deployments** and click **Rollback** on the last healthy deploy.

**Option C — CLI rollback:**

```bash
railway rollback --service <SERVICE_ID>
```

### Supabase (Database Migrations)

> ⚠️ Database rollbacks are the riskiest operation. Always prefer a forward-fix migration.

1. **Identify the bad migration** in `supabase/migrations/`.
2. **Write a reverse migration** that undoes the schema change (e.g., drop added columns, restore removed ones).
3. **Test locally** with `supabase db reset` against a local Postgres instance.
4. **Apply to production** via `supabase db push` or the Supabase dashboard SQL editor.
5. **Never** drop tables or columns in production without confirming they are unused — check application logs and query patterns first.

## Safe Deployment Checklist

Use this checklist before every production deploy:

### Pre-Deploy

- [ ] All CI checks pass on the PR (lint, type-check, unit tests, integration tests)
- [ ] Vercel preview deployment reviewed and smoke-tested
- [ ] Database migrations tested locally with `supabase db reset`
- [ ] Environment variables verified for all services (Vercel, Railway, Supabase)
- [ ] No secrets committed — verified with `git diff --cached` and secret scanning

### Deploy

- [ ] Merge PR to `main`
- [ ] Monitor Vercel deployment status (should auto-promote)
- [ ] Monitor Railway deployment logs for engine and agents
- [ ] Verify health endpoints respond with `200 OK`:
  - `GET <ENGINE_URL>/health`
  - `GET <AGENTS_URL>/health`

### Post-Deploy

- [ ] Spot-check critical user flows (login, data fetch, trade execution)
- [ ] Check error monitoring (Sentry / logging dashboards) for new exceptions
- [ ] Verify database migrations applied cleanly (check Supabase migration history)
- [ ] Confirm WebSocket / real-time connections re-establish (if applicable)
- [ ] Update deployment log or status page if your team maintains one

### If Something Goes Wrong

1. **Don't panic.** You have rollback options for every service.
2. **Assess scope:** Is it a full outage or a degraded feature?
3. **Rollback immediately** if the issue affects trading operations or data integrity.
4. **Communicate** — post in your team's incident channel.
5. **Fix forward** with a new PR once the root cause is understood.
