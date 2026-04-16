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
- [ ] Environment contract passes automated validation for each runtime profile
  - `node scripts/validate-railway-supabase-env.mjs --profile=web --production --project-ref=<supabase-project-ref> --env-file=<web-env-file>`
  - `node scripts/validate-railway-supabase-env.mjs --profile=engine --project-ref=<supabase-project-ref> --env-file=<engine-env-file>`
  - `node scripts/validate-railway-supabase-env.mjs --profile=agents --production --project-ref=<supabase-project-ref> --require-private-engine --env-file=<agents-env-file>`
  - `node --test scripts/validate-railway-supabase-env.test.mjs`
- [ ] Vercel production env vars are set:
  - `ENGINE_URL` = Railway engine URL
  - `ENGINE_API_KEY` = engine auth key
  - `AGENTS_URL` = Railway agents URL
  - `NEXT_PUBLIC_SUPABASE_URL` = Supabase URL
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (preferred) or `NEXT_PUBLIC_SUPABASE_ANON_KEY` (fallback)
  - `SUPABASE_SERVICE_ROLE_KEY` = Supabase service role key
- [ ] Distributed rate limiter env vars are set consistently on web + engine:
  - `RATE_LIMIT_REDIS_REST_URL`
  - `RATE_LIMIT_REDIS_REST_TOKEN`

### Railway ↔ Supabase Pro Standard

Use this as the minimum production bar before deploy approval:

1. **Single Supabase project identity across services**
   - `NEXT_PUBLIC_SUPABASE_URL` (web) and `SUPABASE_URL` (engine/agents) must resolve to the same host.
2. **Exact project-ref verification**
   - Pass `--project-ref=<ref>` to `validate-railway-supabase-env.mjs` to enforce dashboard/project alignment.
3. **Private networking for agents → engine**
   - Railway agents `ENGINE_URL` should be `http://<engine-service>.railway.internal:<port>` (not the public URL).
4. **No localhost in production**
   - Web `ENGINE_URL` and `AGENTS_URL` must be public Railway HTTPS URLs.
5. **Supabase auth secrets present in every required runtime**
   - Web: `SUPABASE_SERVICE_ROLE_KEY`
   - Engine: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - Agents: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
6. **Key and secret quality checks**
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` should use `sb_publishable_...` format.
   - Supabase anon/service-role tokens should be JWT-shaped.
   - `ENGINE_API_KEY` should be at least 24 characters.
   - `SUPABASE_JWT_SECRET` should be at least 32 characters.

## Deploy Order

1. Confirm Railway engine and agents are healthy.
2. Merge the PR to `main` (or push to `main`).
3. Vercel auto-deploys production on every push to `main` (ignore command bypasses diff check for production).
4. Wait for the Vercel build to reach `READY` state.
5. Run production smoke tests.
6. Confirm both Railway services are running 2 healthy replicas after deploy.

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
- Replica balancing (requests served by both instances, no crash-looping replica)

## Availability and Failover Expectations

- Railway services (`engine`, `agents`) run with `numReplicas = 2`.
- Expected behavior during single-replica failure:
  - Service remains available (degraded capacity, no full outage).
  - `/health` remains 200 while at least one replica is healthy.
  - p95 latency may increase up to 2x temporarily during rescheduling.
- SLO guidance during failover window (15 minutes):
  - Engine/Agents availability should remain >= 99.0%.
  - 5xx proxy error rate should remain <= 1%.

## Cutover Rules

- Do not remove deprecated env vars until production passes smoke tests.
- Keep the previous Vercel deployment available for instant rollback.
- Keep the previous Railway deployment available until the new backend is confirmed stable.

## Post-Cutover Cleanup (Completed Q2 2026)

The same-origin proxy migration is complete. The following deprecated browser-facing
variables have been replaced by server-side equivalents and should no longer exist
in any environment:

- ~~`NEXT_PUBLIC_ENGINE_URL`~~ → `ENGINE_URL`
- ~~`NEXT_PUBLIC_ENGINE_API_KEY`~~ → `ENGINE_API_KEY`
- ~~`NEXT_PUBLIC_AGENTS_URL`~~ → `AGENTS_URL`

If found in Vercel or Railway env settings, remove them.

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
