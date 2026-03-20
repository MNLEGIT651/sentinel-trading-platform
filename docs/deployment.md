# Sentinel Deployment Guide

This is the canonical deployment reference for the Sentinel Trading Platform.

## Goal

Make deployment easy to explain and safe to operate by defining:
- the supported runtime topology
- which services are public vs internal
- the current deployment assets in the repo
- environment-variable ownership by runtime
- first-production recommendations and open decisions

## Current runtime topology

Sentinel currently consists of three application services plus Supabase:

```text
browser -> web (Next.js, port 3000)
web -> engine (FastAPI, port 8000)
web -> agents (Express, port 3001)  [current code path exists]
agents -> engine
engine -> Supabase / external providers
agents -> Supabase / Anthropic / engine
```

## Current deployment assets

### Local multi-service stack
- `docker-compose.yml`
  - runs `engine`, `agents`, and `web`
  - wires internal service URLs between containers
  - exposes ports 8000, 3001, and 3000 locally

### Web deployment
- `vercel.json`
  - currently configures an `ignoreCommand` for web/shared changes
  - implies Vercel is expected to host the web app

### Engine deployment
- `apps/engine/railway.toml`
  - provides a Railway deployment definition for the engine

### Container assets
- `apps/web/Dockerfile`
- `apps/agents/Dockerfile`
- `apps/engine/Dockerfile`

These assets should be treated as one deployment system, not three unrelated deployment stories.

## Recommended deployment model

### First production recommendation

Use a split deployment model:
- **Public:** `web`
- **Private/internal:** `engine`
- **Optional for first production:** `agents` unless the human owner decides otherwise

### Why this is the easiest model

It minimizes:
- cross-origin browser configuration
- the number of public endpoints
- duplicated health-check and auth complexity
- the amount of deployment coordination required across providers

### Recommended target shape

```text
Public internet
  -> web (Vercel or equivalent)
       -> engine over internal/private URL
       -> agents over internal/private URL if enabled

Private services
  -> engine (Railway or container host)
  -> agents (same backend host class as engine, if enabled)
```

## Current reality vs recommended target

### Already present in the repo
- local Compose supports all three services
- web build/deploy behavior exists
- engine deploy behavior exists
- service configuration logic already supports internal server-side URLs through `ENGINE_URL` and `AGENTS_URL`

### Still to be completed
- browser-facing data access is not fully normalized behind same-origin web routes
- agents posture for first production remains a human decision
- a complete env ownership table is not yet reflected in `.env.example`
- runbooks for deploy/smoke-test/rollback still need to be added

## Service exposure model

### `web`
- **Audience:** public internet
- **Purpose:** browser UI and Next.js routes
- **Should know about:** internal `ENGINE_URL`, internal `AGENTS_URL` if enabled, public Supabase settings
- **Should expose:** only browser-safe `NEXT_PUBLIC_*` configuration

### `engine`
- **Audience:** internal callers and local development
- **Purpose:** quant engine, data/risk/portfolio APIs
- **Should know about:** provider credentials, broker credentials, Supabase server-side access, CORS config
- **Should not be public unless explicitly required**

### `agents`
- **Audience:** internal callers and local development
- **Purpose:** orchestration, alerts, recommendations
- **Should know about:** Anthropic key, engine URL, Supabase server-side access
- **Production posture:** pending explicit human decision

## Environment ownership matrix

| Variable | Runtime(s) | Visibility | Used for | Notes |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | web browser, web server | public | browser and server Supabase base URL | Safe for browser exposure. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web browser, web server | public | browser Supabase client auth | Safe for browser exposure. |
| `SUPABASE_SERVICE_ROLE_KEY` | web server, engine, agents | secret | privileged Supabase access | Never expose client-side. |
| `POLYGON_API_KEY` | engine, possibly web server status checks | secret | market data provider auth | Keep server-side. |
| `ALPACA_API_KEY` | engine, possibly web server status checks | secret | broker auth | Keep server-side. |
| `ALPACA_SECRET_KEY` | engine, possibly web server status checks | secret | broker auth | Keep server-side. |
| `ALPACA_BASE_URL` | engine, web server checks | internal | broker endpoint selection | Paper vs live must be explicit. |
| `BROKER_MODE` | engine | internal | broker mode selection | Prefer `paper` by default. |
| `ANTHROPIC_API_KEY` | agents, possibly web server status checks | secret | LLM provider auth | Keep server-side. |
| `NEXT_PUBLIC_ENGINE_URL` | web browser, web server | public/internal | direct browser engine calls in current implementation | Prefer same-origin web routes over long-term direct browser use. |
| `ENGINE_URL` | web server, agents | internal | server-to-engine calls | Preferred production path. |
| `ENGINE_API_KEY` | web server, agents | secret/internal | engine auth | Server-side preferred. |
| `NEXT_PUBLIC_ENGINE_API_KEY` | web browser | public | current browser engine auth path | Reduce or remove from browser exposure where feasible. |
| `CORS_ORIGINS` | engine | internal | allowed origins for engine | Must match deployed web origin(s). |
| `NEXT_PUBLIC_AGENTS_URL` | web browser, web server | public/internal | current browser agents calls | Prefer same-origin web proxy or mark agents optional. |
| `AGENTS_URL` | web server | internal | server-to-agents calls | Preferred production path. |
| `AGENTS_PORT` | agents | internal | agents service port | Used by local and container runtime. |
| `DATA_INGESTION_INTERVAL_MINUTES` | engine | internal | engine scheduling | Operational tuning. |
| `SIGNAL_GENERATION_INTERVAL_MINUTES` | engine | internal | engine scheduling | Operational tuning. |
| `RISK_UPDATE_INTERVAL_MINUTES` | engine | internal | engine scheduling | Operational tuning. |

## Supported deployment modes

### Mode 1 — Local development
Use `docker compose up --build` when you want the full local multi-service stack with service health checks.

### Mode 2 — Web preview deployment
Deploy `web` as the public entry point, but only if reachable backend URLs and required env values are configured.

### Mode 3 — First production deployment
Recommended baseline:
- web deployed publicly
- engine deployed privately
- agents either deployed privately or intentionally disabled until the owner confirms it is required

## Health checks

### Existing health endpoints
- engine: `/health`
- agents: `/health`
- web: homepage response used in Docker health check

### Operational recommendation
For production smoke tests, verify:
1. web loads successfully
2. web server can reach engine health
3. web server can reach agents health if agents is enabled
4. required external credentials are present in the correct runtime

## Open decisions

### Decision 1 — Is `agents` required for first production?
Owner decision required.

Impact:
- determines whether first production includes a third runtime
- affects README wording, web behavior, and route proxy requirements

### Decision 2 — Preferred backend hosting style
Owner decision required:
- Vercel + Railway
- Vercel + general container host
- full container-host deployment

Impact:
- shapes runbook examples
- determines recommended internal networking assumptions

## Implementation follow-ups

The next practical implementation steps are:
1. inventory browser calls that still hit engine or agents directly
2. proxy those calls through Next.js routes where appropriate
3. centralize service URL/auth/timeout logic in the web server layer
4. add deploy, smoke-test, and rollback runbooks
5. align `.env.example` comments with the ownership matrix above

Track those tasks in `docs/ai/state/project-state.md` and the roadmap in `docs/ai/roadmaps/2026-03-20-deployment-readme-roadmap.md`.
