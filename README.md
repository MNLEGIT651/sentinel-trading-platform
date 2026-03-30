# Sentinel Trading Platform

[![CI](https://github.com/stevenschling13/sentinel-trading-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/stevenschling13/sentinel-trading-platform/actions/workflows/ci.yml)
[![Vercel](https://img.shields.io/badge/Vercel-deployed-brightgreen?logo=vercel)](https://sentinel-trading-platform-agents.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-22-green?logo=node.js)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://python.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_17-3ECF8E?logo=supabase)](https://supabase.com)
[![Turborepo](https://img.shields.io/badge/Turborepo-monorepo-EF4444?logo=turborepo)](https://turbo.build)

Systematic trading control plane built as a Turborepo monorepo: Next.js dashboard, Python quant engine, TypeScript agent orchestrator, and Supabase-backed state.

## Production Topology

```text
browser -> Vercel (apps/web)
              |
              +-- /api/engine/* --> Railway (apps/engine)
              +-- /api/agents/* --> Railway (apps/agents)
              |
              +-- Supabase (client-side, anon key)

engine  -> Supabase / Polygon / Alpaca
agents  -> engine / Supabase / Anthropic
```

- `apps/web` runs on **Vercel** and is the only public origin.
- `apps/engine` runs on **Railway** as the quant backend.
- `apps/agents` runs on **Railway** and is **required** in production.
- The browser never calls backend services directly. All backend traffic flows through same-origin Next.js route handlers (`/api/engine/*`, `/api/agents/*`).
- Docker Compose is for **local development only**.

## Repository Map

```text
apps/web/        Next.js 16 dashboard (TypeScript, port 3000)
apps/engine/     Python FastAPI quant engine (port 8000)
apps/agents/     TypeScript agent orchestrator (port 3001)
packages/shared/ Shared TypeScript contracts (@sentinel/shared)
supabase/        PostgreSQL migrations and seed data
docs/            Deployment guides, runbooks, and AI collaboration docs
```

## Quick Start

### Prerequisites

- Node 22+ and pnpm 10.32.1
- Python 3.12+ and uv
- A populated `.env` (copy from `.env.example`)

### Setup

```bash
cp .env.example .env    # fill in credentials
pnpm install
```

### Local Development

**Node workspaces only** (web + agents):

```bash
pnpm dev
```

**Engine separately** (Python, not managed by Turborepo):

```bash
cd apps/engine
uv run python -m uvicorn src.api.main:app --reload --port 8000
```

**Full local stack** (all three services via Docker):

```bash
docker compose up --build
```

## Validation

```bash
pnpm lint               # Node workspaces
pnpm test               # Node workspaces
pnpm build              # Node workspaces
pnpm test:web           # web unit tests
pnpm test:agents        # agents unit tests
pnpm lint:engine        # ruff lint
pnpm format:check:engine # ruff format check
pnpm test:engine        # pytest
```

`pnpm lint`, `pnpm test`, and `pnpm build` cover Node workspaces only. The engine must be validated separately.

## Deployment

| Service | Host    | Entry Point                       |
| ------- | ------- | --------------------------------- |
| Web     | Vercel  | Public (browser)                  |
| Engine  | Railway | Private (Vercel server-side only) |
| Agents  | Railway | Private (Vercel server-side only) |

See [docs/deployment.md](docs/deployment.md) for the full deployment guide, environment ownership, cutover order, and smoke tests.

## Runbooks

- [Local Development](docs/runbooks/local.md)
- [Preview Deployment](docs/runbooks/preview.md)
- [Production Deployment](docs/runbooks/production.md)
- [Troubleshooting](docs/runbooks/troubleshooting.md)
- [Release Checklist](docs/runbooks/release-checklist.md)

## Contributor Guardrails

Before changing code, read:

1. `AGENTS.md`
2. `docs/ai/working-agreement.md`
3. `docs/ai/architecture.md`
4. `docs/ai/commands.md`

Key rules:

- Do not modify migrations, shared contracts, or deployment config without review.
- Web-to-engine requests must go through `/api/engine/*` proxy routes.
- Preserve `OfflineBanner` and `SimulatedBadge` outage UX.
- Prefer minimal diffs and explicit validation reporting.
