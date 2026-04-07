# Production Deployment Runbook

Production runs on one public origin with private backend services. Agents are required.

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
  - `node scripts/validate-railway-supabase-env.mjs --profile=web --production --project-ref=<supabase-project-ref>`
  - `node scripts/validate-railway-supabase-env.mjs --profile=engine --project-ref=<supabase-project-ref>`
  - `node scripts/validate-railway-supabase-env.mjs --profile=agents --production --project-ref=<supabase-project-ref> --require-private-engine`
- [ ] Vercel production env vars are set:
  - `ENGINE_URL` = Railway engine URL
  - `ENGINE_API_KEY` = engine auth key
  - `AGENTS_URL` = Railway agents URL
  - `NEXT_PUBLIC_SUPABASE_URL` = Supabase URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase anon key
  - `SUPABASE_SERVICE_ROLE_KEY` = Supabase service role key

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
