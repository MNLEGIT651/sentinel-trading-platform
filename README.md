# Sentinel Trading Platform

Evidence-based systematic trading platform built as a Turborepo monorepo with a Next.js dashboard, a Python quant engine, a TypeScript agent orchestrator, and shared contracts.

## What this repo is today

Sentinel already contains:
- a runnable Next.js dashboard in `apps/web`
- a FastAPI quant engine in `apps/engine`
- an Express-based agent orchestration service in `apps/agents`
- shared TypeScript contracts in `packages/shared`
- Supabase schema and seed data in `supabase`

Sentinel is **not yet a finished production trading system**. Some flows still rely on fallback or staged behavior, and deployment guidance should be read together with `docs/deployment.md` before treating the system as production-ready.

## Repository map

```text
apps/web/        Next.js 16 dashboard (TypeScript, port 3000)
apps/engine/     Python FastAPI quant engine (port 8000)
apps/agents/     TypeScript agent orchestrator (port 3001)
packages/shared/ Shared TypeScript contracts (@sentinel/shared)
supabase/        PostgreSQL migrations and seed data
docs/            AI guidance, plans, analysis, and deployment docs
```

## Architecture at a glance

```text
browser -> apps/web (Next.js)
              |\
              | server-side service calls
              v
          apps/engine (FastAPI) <--- apps/agents (Express)
              |
              v
           Supabase
```

### Current app boundaries
- `apps/web` talks to `apps/engine` over HTTP.
- `apps/agents` talks to `apps/engine` through its server-side `EngineClient`.
- `apps/web` and `apps/agents` share contracts from `packages/shared`.
- Supabase is the persistence boundary for application data. See `docs/ai/architecture.md` for the more detailed version used in implementation work.

## Recommended deployment model

The simplest deployment target for Sentinel is:
- **public:** `apps/web`
- **private/internal:** `apps/engine`
- **optional for first production:** `apps/agents`, unless the human owner chooses to make it required

The repo currently includes:
- `docker-compose.yml` for local multi-service development
- `vercel.json` for web deployment behavior
- `apps/engine/railway.toml` for engine deployment on Railway

Read `docs/deployment.md` for the canonical deployment guide, current platform assumptions, environment ownership, and rollout guidance.

## Quick start

### Prerequisites
- Node 22+
- pnpm 10.32.1
- Python 3.12+
- an engine virtualenv at `apps/engine/.venv`
- a populated `.env` created from `.env.example`

### Setup
```bash
cp .env.example .env
pnpm install
```

Then populate required Supabase, Polygon, Alpaca, Anthropic, engine, and agents values in `.env`.

### Start local services
```bash
pnpm dev
```

For a full local multi-service container stack, use:
```bash
docker compose up --build
```

## Validation commands

### Canonical root commands
```bash
pnpm dev
pnpm lint
pnpm test
pnpm build
pnpm test:web
pnpm test:web:e2e
pnpm test:agents
pnpm lint:engine
pnpm format:check:engine
pnpm test:engine
```

### Important validation note
`pnpm lint`, `pnpm test`, and `pnpm build` cover the Node/Turborepo workspaces only. The Python engine must be validated separately with the engine commands above.

## Environment model

Use `.env.example` as the source list of variables.

Broadly:
- `NEXT_PUBLIC_*` values are browser-exposed and should be treated as public configuration
- `ENGINE_URL`, `AGENTS_URL`, API keys, service-role keys, and broker credentials are server-side values
- production deployments should prefer internal URLs between `web`, `engine`, and `agents` whenever possible

The full environment ownership and deployment matrix lives in `docs/deployment.md`.

## Deployment assets in this repo

- `docker-compose.yml` — local development stack for `web`, `engine`, and `agents`
- `apps/web/Dockerfile` — web container build
- `apps/agents/Dockerfile` — agents container build
- `apps/engine/Dockerfile` — engine container build
- `vercel.json` — Vercel deployment behavior for the web app
- `apps/engine/railway.toml` — Railway deployment config for the engine

## Contributor guardrails

Before changing code, read:
1. `AGENTS.md`
2. `docs/ai/working-agreement.md`
3. `docs/ai/architecture.md`
4. `docs/ai/commands.md`
5. `docs/ai/review-checklist.md`
6. `docs/ai/state/project-state.md`
7. `docs/ai/agent-ops.md`

Key rules:
- do not casually modify migrations, shared contracts, package manager files, or deployment-critical config
- web-to-engine requests must follow the approved fetch path
- preserve `OfflineBanner` and `SimulatedBadge` behavior
- prefer minimal diffs and explicit validation reporting

## Known gaps / maturity notes

Sentinel is still in an implementation phase. Known categories of incomplete or evolving work include:
- deployment simplification and runbooks
- centralization of service URL and health-check behavior
- README and operator documentation expansion
- decisions on whether `apps/agents` is mandatory for first production

Track current work in `docs/ai/state/project-state.md` and the deployment/readme roadmap in `docs/ai/roadmaps/2026-03-20-deployment-readme-roadmap.md`.

## Additional docs

- `docs/deployment.md` — canonical deployment guide
- `docs/ai/working-agreement.md` — collaboration rules
- `docs/ai/architecture.md` — system boundaries and sensitive paths
- `docs/ai/commands.md` — canonical validation commands
- `docs/ai/review-checklist.md` — handoff/review checklist
- `docs/ai/agent-ops.md` — Claude Code + Codex operating rules
- `docs/ai/state/project-state.md` — live project state ledger
