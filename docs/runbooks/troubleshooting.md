# Troubleshooting Runbook

## First Response

1. Identify the environment: local, preview, or production.
2. Check `/api/settings/status` for a connectivity report.
3. Check `/api/engine/health` and `/api/agents/health`.
4. Read Vercel runtime logs (if Vercel deployment).
5. Read Railway service logs (if backend issue).

## Common Symptoms

### `not_configured`

The web server cannot find a valid upstream URL for the service.

**Causes:**

- `ENGINE_URL` or `AGENTS_URL` missing from Vercel env vars.
- URL is set to `localhost` in a production/preview environment.
- Env var was added but Vercel was not redeployed (env changes require redeployment).

**Fix:**

1. Check Vercel project settings > Environment Variables.
2. Confirm `ENGINE_URL` and `AGENTS_URL` point to Railway public URLs.
3. Redeploy after adding/changing env vars.

### `504 Gateway Timeout`

The upstream service is too slow or unreachable.

**Causes:**

- Railway service is down or still starting.
- Service is not listening on the Railway-assigned `PORT`.
- Network connectivity between Vercel and Railway is interrupted.

**Fix:**

1. Check Railway dashboard for service status.
2. Check Railway logs for startup errors or port binding issues.
3. Verify `PORT` env var is being read by the service entry point.
4. Try hitting the Railway service URL directly: `curl https://<service>.up.railway.app/health`.

### `401` or `403` from Engine

The engine rejected the request due to auth mismatch.

**Causes:**

- `ENGINE_API_KEY` in Vercel doesn't match `ENGINE_API_KEY` in Railway engine.
- Auth header format mismatch (expects `Bearer` token or `X-API-Key`).

**Fix:**

1. Confirm the key value matches between Vercel server-side and Railway engine.
2. Check `service-config.ts` sends both `Authorization: Bearer <key>` and `X-API-Key: <key>`.

### `Offline` Banner in UI

The web app's health polling detected a backend as unreachable.

**Causes (if incorrect):**

- Service is actually up but health probe is timing out (4s timeout).
- Proxy route is misconfigured.
- Service URL is localhost in production.

**Fix:**

1. Check `/api/settings/status` for the specific service state.
2. Check Vercel runtime logs for proxy errors.
3. Confirm the service responds to `/health` within 4 seconds.

### Vercel Build Failure

**Common causes:**

| Error                                     | Cause                                     | Fix                                         |
| ----------------------------------------- | ----------------------------------------- | ------------------------------------------- |
| `Type error: ...`                         | TypeScript error in `apps/web`            | Fix the type error locally, push            |
| `Cannot find module '@sentinel/shared'`   | Shared package not resolved               | Check `pnpm install` and turbo dependencies |
| `NEXT_PUBLIC_SUPABASE_URL is not defined` | Missing build-time env var                | Add to Vercel project settings              |
| Build skipped                             | `ignoreCommand` in `vercel.json` exited 0 | Expected if commit didn't touch `apps/web`  |

### Railway Deployment Failure

**Common causes:**

| Error                          | Cause                           | Fix                                             |
| ------------------------------ | ------------------------------- | ----------------------------------------------- |
| `ModuleNotFoundError` (engine) | Missing Python dependency       | Add to `pyproject.toml`, rebuild                |
| `Cannot find module` (agents)  | Missing Node dependency         | Add to `package.json`, rebuild                  |
| Port conflict                  | Not using Railway `PORT`        | Ensure entry point reads `process.env.PORT`     |
| Health check timeout           | App starts slowly or wrong path | Check health endpoint and increase start period |

## Log Inspection

### Vercel Runtime Logs

Via MCP:

```
Tool: get_runtime_logs
projectId: prj_IOPutSQDIkXYF1LHfjMQxyMoo5tG
teamId: team_1jHeAEF8oKm2Z46fqRMdu5uL
```

Via CLI:

```bash
vercel logs <deployment-url> --follow
```

### Railway Logs

Via Railway dashboard: Service > Deployments > View Logs.

### Supabase Logs

Via Supabase dashboard: Project > Logs > Postgres.

Or via MCP:

```
Tool: get_logs
project_id: luwyjfwauljwsfsnwiqb
service: postgres
```

## Engine Timeout Debugging

1. Verify engine is running: `curl https://<engine>.up.railway.app/health`
2. Check the specific failing route with the same auth headers.
3. Look at engine logs for slow query or external API timeout.
4. Check timeout policy in `service-config.ts` -- some routes have generous timeouts (backtest: 45s, scan: 70s).

## Agents Timeout Debugging

1. Verify agents is running: `curl https://<agents>.up.railway.app/health`
2. Check `/status` for orchestrator state (is it mid-cycle?).
3. Confirm `ENGINE_URL` is set in Railway agents env (agents need to reach engine).
4. Check if `ANTHROPIC_API_KEY` is valid (agents call Claude during cycles).

## Nuclear Option

If everything is broken and you need to get back to a working state:

1. Roll back Vercel to the last known good deployment.
2. Roll back Railway services to their last known good deployments.
3. Restore previous env var values if they were changed.
4. Re-run smoke tests before investigating the root cause.
