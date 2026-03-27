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

### Railway Private Networking

Services on the same Railway project can communicate over an internal private network using `<service>.railway.internal` hostnames. This is faster (no public internet round-trip) and more secure (traffic never leaves Railway's network).

**How it works:**

- Engine and Agents both run on Railway, so Agents → Engine calls use the private network.
- Vercel (Web) is outside Railway, so Web → Engine and Web → Agents must use public Railway URLs.

**Environment variable configuration:**

| Service          | Variable     | Value                                                          | Network  |
| ---------------- | ------------ | -------------------------------------------------------------- | -------- |
| Railway Agents   | `ENGINE_URL` | `http://sentinel-engine-trading.railway.internal:8000`         | Private  |
| Vercel Web       | `ENGINE_URL` | `https://<engine>.up.railway.app`                              | Public   |
| Vercel Web       | `AGENTS_URL` | `https://<agents>.up.railway.app`                              | Public   |

> **Note:** Private network hostnames use `http` (not `https`) and the Railway-assigned `PORT`. Public URLs use `https` and do not need a port suffix.

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
