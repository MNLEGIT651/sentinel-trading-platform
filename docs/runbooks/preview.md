# Preview Deployment Runbook

Preview should behave identically to production. Same topology, same proxy routes, different URLs.

## Topology

```text
Vercel preview URL -> Railway engine -> Supabase / Polygon / Alpaca
                   -> Railway agents -> engine / Supabase / Anthropic
```

## Pre-Deploy Checklist

- [ ] Railway engine is deployed and `/health` returns 200
- [ ] Railway agents is deployed and `/health` returns 200
- [ ] Vercel preview env vars set:
  - `ENGINE_URL` = Railway engine public URL
  - `ENGINE_API_KEY` = engine auth key
  - `AGENTS_URL` = Railway agents public URL
  - `NEXT_PUBLIC_SUPABASE_URL` = Supabase API URL
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` = Supabase publishable key (`sb_publishable_*`)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = legacy fallback only (optional)
  - `SUPABASE_SERVICE_ROLE_KEY` = Supabase service role key

## Deploy

1. Push to a feature branch or open a PR.
2. Vercel auto-creates a preview deployment (if `apps/web` or `packages/shared` changed).
3. Wait for the Vercel build to complete.

If Vercel skips the deployment, it means the commit didn't touch `apps/web` or `packages/shared` (the `ignoreCommand` in `vercel.json`).

## Smoke Tests

Check these on the preview URL:

| Check          | Path                   | Expected                  |
| -------------- | ---------------------- | ------------------------- |
| Engine health  | `/api/engine/health`   | 200                       |
| Agents health  | `/api/agents/health`   | 200                       |
| Agents status  | `/api/agents/status`   | 200 + orchestrator state  |
| Service status | `/api/settings/status` | engine + agents connected |

### Page Smoke

- `/` -- dashboard loads, no offline banner
- `/settings` -- engine and agents show connected
- `/agents` -- controls enabled, agent states visible
- `/portfolio` -- loads without errors
- `/signals` -- loads without errors
- `/backtest` -- loads without errors

### Verify No Direct Backend Access

Open browser DevTools Network tab. Confirm:

- No requests to Railway URLs from the browser
- All engine/agents traffic goes through `/api/engine/*` and `/api/agents/*`
- No `NEXT_PUBLIC_ENGINE_URL` or `NEXT_PUBLIC_AGENTS_URL` in client JS bundle

## Rollback

1. Redeploy the previous Vercel preview build from the dashboard.
2. If the issue is backend-side, roll Railway back to the previous deployment.
3. Re-check `/api/settings/status` and `/api/agents/health`.
