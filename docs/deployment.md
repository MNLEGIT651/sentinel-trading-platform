# Sentinel Deployment Guide

Canonical deployment reference. One supported production topology. No ambiguity.

## Production Topology

```text
browser -> Vercel (apps/web)
              |
              +-- /api/engine/* --> Railway engine
              +-- /api/agents/* --> Railway agents

engine  -> Supabase, Polygon, Alpaca
agents  -> engine, Supabase, Anthropic
```

- **Web** runs on Vercel. It is the only public origin.
- **Engine** runs on Railway. Internal only.
- **Agents** runs on Railway. Internal only. **Required in production.**
- **Docker Compose** is local development only. Not a production path.
- The browser never calls backend services directly. All backend traffic flows through same-origin `/api/engine/*` and `/api/agents/*` route handlers.

## Environment Ownership by Runtime

### Vercel (apps/web) -- Browser-Safe

| Variable                        | Purpose               |
| ------------------------------- | --------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase API endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public auth  |

### Vercel (apps/web) -- Server-Side Only

| Variable                    | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `ENGINE_URL`                | Railway engine URL (e.g. `https://engine.up.railway.app`) |
| `ENGINE_API_KEY`            | Engine authentication key                                 |
| `AGENTS_URL`                | Railway agents URL (e.g. `https://agents.up.railway.app`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged Supabase access                                |

### Railway Engine (apps/engine)

| Variable                    | Purpose                         |
| --------------------------- | ------------------------------- |
| `POLYGON_API_KEY`           | Market data provider            |
| `ALPACA_API_KEY`            | Broker authentication           |
| `ALPACA_SECRET_KEY`         | Broker secret                   |
| `ALPACA_BASE_URL`           | Paper vs live endpoint          |
| `BROKER_MODE`               | `paper` or `live`               |
| `SUPABASE_SERVICE_ROLE_KEY` | Database access                 |
| `NEXT_PUBLIC_SUPABASE_URL`  | Database endpoint               |
| `ENGINE_API_KEY`            | Validates inbound auth          |
| `CORS_ORIGINS`              | Allowed origins (Vercel domain) |
| `PORT`                      | Railway-assigned port (auto)    |

### Railway Agents (apps/agents)

| Variable                    | Purpose                      |
| --------------------------- | ---------------------------- |
| `ENGINE_URL`                | Engine service URL           |
| `ANTHROPIC_API_KEY`         | LLM provider                 |
| `SUPABASE_SERVICE_ROLE_KEY` | Database access              |
| `SUPABASE_URL`              | Database endpoint            |
| `PORT`                      | Railway-assigned port (auto) |

### Deprecated (Remove After Cutover)

| Variable                     | Replacement                    |
| ---------------------------- | ------------------------------ |
| `NEXT_PUBLIC_ENGINE_URL`     | `ENGINE_URL` (server-side)     |
| `NEXT_PUBLIC_ENGINE_API_KEY` | `ENGINE_API_KEY` (server-side) |
| `NEXT_PUBLIC_AGENTS_URL`     | `AGENTS_URL` (server-side)     |

These exist only during migration. The browser must not depend on them in production.

## Service Configuration

All upstream URL resolution, auth headers, timeouts, and retries are centralized in `apps/web/src/lib/server/service-config.ts`. No other file should duplicate this logic.

### Timeout Policy

| Route Pattern             | Timeout | Retries |
| ------------------------- | ------- | ------- |
| `/health`                 | 4s      | 1       |
| `/api/v1/strategies/scan` | 70s     | 2 (GET) |
| `/api/v1/backtest/run`    | 45s     | 2 (GET) |
| `/api/v1/data/quotes`     | 15s     | 2 (GET) |
| Engine GET (default)      | 10s     | 2       |
| Engine POST (default)     | 15s     | 1       |
| Agents GET (default)      | 6s      | 2       |
| Agents POST (default)     | 8s      | 1       |

### Production Safety

- `localhost` and `127.0.0.1` URLs are rejected in production (`NODE_ENV=production` or `VERCEL=1`).
- Missing `ENGINE_URL` or `AGENTS_URL` returns `not_configured` errors, not silent fallback.
- `OfflineBanner` and `SimulatedBadge` remain the user-facing outage UX.

## Health Endpoints

| Service | Endpoint                   | Expected                    |
| ------- | -------------------------- | --------------------------- |
| Engine  | `GET /health`              | 200                         |
| Agents  | `GET /health`              | 200                         |
| Agents  | `GET /status`              | 200 + orchestrator state    |
| Web     | `GET /api/health`          | 200                         |
| Web     | `GET /api/settings/status` | Service connectivity report |

## Deployment Assets

| File                       | Purpose                         | Environment |
| -------------------------- | ------------------------------- | ----------- |
| `docker-compose.yml`       | Full local stack                | Local only  |
| `apps/web/Dockerfile`      | Web container                   | Local / CI  |
| `apps/engine/Dockerfile`   | Engine container                | Railway     |
| `apps/agents/Dockerfile`   | Agents container                | Railway     |
| `vercel.json`              | Change-detection ignore command | Vercel      |
| `apps/engine/railway.toml` | Health check + restart policy   | Railway     |

## Cutover Order

1. Verify local tests pass (all three apps)
2. Deploy engine to Railway, confirm `/health` returns 200
3. Deploy agents to Railway, confirm `/health` returns 200
4. Set `ENGINE_URL`, `ENGINE_API_KEY`, `AGENTS_URL` on Vercel (preview + production)
5. Deploy Vercel preview
6. Run preview smoke tests (see [Release Checklist](runbooks/release-checklist.md))
7. Deploy Vercel production
8. Run production smoke tests
9. Remove deprecated `NEXT_PUBLIC_ENGINE_URL`, `NEXT_PUBLIC_ENGINE_API_KEY`, `NEXT_PUBLIC_AGENTS_URL` from Vercel
10. Decommission stale Railway services

Do not remove old env vars or stale services until both preview and production pass smoke tests.

## Rollback

### Vercel

Redeploy the previous production build from the Vercel dashboard (Deployments > previous READY build > Promote to Production).

### Railway

Each Railway deployment is versioned. Roll back to the previous deployment from the Railway dashboard.

### Config Rollback

If the failure is env-related, restore the previous env values in the Vercel/Railway dashboard and redeploy.

## Smoke Tests

After every deploy, verify:

| Check          | URL                    | Expected                            |
| -------------- | ---------------------- | ----------------------------------- |
| Engine health  | `/api/engine/health`   | 200                                 |
| Agents health  | `/api/agents/health`   | 200                                 |
| Agents status  | `/api/agents/status`   | 200 + agent states                  |
| Service status | `/api/settings/status` | engine + agents connected           |
| Settings page  | `/settings`            | All services show connected         |
| Agents page    | `/agents`              | Controls enabled, no offline banner |
| Dashboard      | `/`                    | No localhost fallback in UI         |

Also verify in Vercel runtime logs:

- No `not_configured` errors
- No `localhost` in upstream URLs
- No leaked auth headers

## Port Binding

| Service | Priority                           | Default |
| ------- | ---------------------------------- | ------- |
| Engine  | Dockerfile `--port 8000`           | 8000    |
| Agents  | `PORT` > `AGENTS_PORT` > hardcoded | 3001    |
| Web     | Next.js default                    | 3000    |

Railway sets `PORT` automatically. Both backend Dockerfiles must respect it.

## Appendix: Engine Docker Context And Packaging Follow-Up

The current repository layout standardizes the engine container on an `apps/engine` build context:

- local Compose uses `build.context: apps/engine` with `dockerfile: Dockerfile`
- Railway resolves `apps/engine/railway.toml`, which points at the in-directory `Dockerfile`

Because that context starts inside `apps/engine`, any immediate Dockerfile correctness fix should use context-relative paths:

```dockerfile
COPY pyproject.toml ./
COPY src ./src
```

Do **not** keep `apps/engine/` prefixes in that variant, because `COPY apps/engine/pyproject.toml ./` and `COPY apps/engine/src ./src` only work when the build context is the monorepo root. If the team later wants a monorepo-root Docker context instead, update Compose and Railway to build from the repo root in the same change rather than mixing the two approaches.

For deterministic installs, treat this as a two-step plan:

1. **Short-term:** fix the Docker `COPY` paths only so the current `apps/engine` build context matches the repository layout.
2. **Medium-term:** refactor `apps/engine/pyproject.toml` and imports into a conventional package layout, then switch the Docker build to a lockfile-first `uv sync` flow.

Do **not** recommend `uv sync --no-editable` in the short-term patch unless packaging is also updated so the local application code is installed correctly. The current runtime entrypoint is `src.api.main:app`, so packaging changes and Docker install strategy are coupled.
