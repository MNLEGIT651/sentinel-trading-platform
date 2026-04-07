# Production Deployment Runbook

Production runs on one public origin with private backend services. Agents are required.

Before release, complete the [platform verification checklist](platform-verification-checklist.md) for dashboard-level controls.

## Topology

```text
Public:   Vercel (apps/web)
Private:  Railway engine, Railway agents
Database: Supabase (us-east-1)
```

## Pre-Deploy Checklist

- [ ] All CI checks pass on the branch being deployed
- [ ] Preview deployment passes all smoke tests (see [preview runbook](preview.md))
- [ ] Railway engine is healthy (`/health` returns 200)
- [ ] Railway agents is healthy (`/health` returns 200)
- [ ] Vercel production env vars are set:
  - `ENGINE_URL` = Railway engine URL
  - `ENGINE_API_KEY` = engine auth key
  - `AGENTS_URL` = Railway agents URL
  - `NEXT_PUBLIC_SUPABASE_URL` = Supabase URL
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (preferred) or `NEXT_PUBLIC_SUPABASE_ANON_KEY` (fallback)
  - `SUPABASE_SERVICE_ROLE_KEY` = Supabase service role key

## Deploy Order

1. Confirm Railway engine and agents are healthy.
2. Merge the PR to `main` (or push to `main`).
3. Vercel auto-deploys production (if `apps/web` or `packages/shared` changed).
4. Wait for the Vercel build to reach `READY` state.
5. Run production smoke tests.

If you need to force a deploy without a commit:

```bash
cd apps/web && vercel --prod
```

## Production Smoke Tests

| Check          | Path                   | Expected                                 |
| -------------- | ---------------------- | ---------------------------------------- |
| Engine health  | `/api/engine/health`   | 200                                      |
| Agents health  | `/api/agents/health`   | 200                                      |
| Agents status  | `/api/agents/status`   | 200 + orchestrator state                 |
| Service status | `/api/settings/status` | engine + agents connected                |
| Settings page  | `/settings`            | All services connected                   |
| Agents page    | `/agents`              | Controls enabled                         |
| Dashboard      | `/`                    | No offline banner, no localhost fallback |

### Verify in Logs

Check Vercel runtime logs for:

- No `not_configured` errors
- No `localhost` in upstream URLs
- No auth header leakage in responses

Check Railway logs for:

- Clean startup messages
- Correct port binding (`PORT` env var)
- Health check responses

## Cutover Rules

- Do not remove deprecated env vars until production passes smoke tests.
- Keep the previous Vercel deployment available for instant rollback.
- Keep the previous Railway deployment available until the new backend is confirmed stable.

## Post-Cutover Cleanup

After production is verified stable:

1. Remove deprecated Vercel env vars:
   - `NEXT_PUBLIC_ENGINE_URL`
   - `NEXT_PUBLIC_ENGINE_API_KEY`
   - `NEXT_PUBLIC_AGENTS_URL`
2. Decommission stale Railway services (placeholder or duplicate services).
3. Verify that removing deprecated vars doesn't break anything by redeploying.

## Rollback

### Vercel

1. Go to Vercel Dashboard > Deployments.
2. Find the last `READY` deployment before the broken one.
3. Click "..." > "Promote to Production."

Or via CLI:

```bash
vercel rollback <deployment-id>
```

### Railway

1. Go to Railway Dashboard > Service > Deployments.
2. Click the previous healthy deployment > "Redeploy."

### Config Rollback

If the failure is env-related:

1. Restore previous env values in Vercel/Railway dashboards.
2. Trigger a redeploy (env changes require redeployment to take effect).
3. Re-run smoke tests.
