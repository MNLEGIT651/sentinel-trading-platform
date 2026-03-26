# Contributing to Sentinel Trading Platform

Thank you for your interest in contributing! This document covers setup,
conventions, and the pull-request workflow.

## Prerequisites

| Tool | Version |
| ----- | ---------- |
| Node | 22+ |
| pnpm | 10.32.1+ |
| Python | 3.12+ |
| uv | 0.5+ |
| Docker | 24+ |

## Getting Started

```bash
# Clone and install
git clone https://github.com/stevenschling13/Trading-App.git
cd Trading-App
cp .env.example .env          # fill in required values
pnpm install

# Start Node services (web + agents)
pnpm dev

# Start engine separately
cd apps/engine
uv venv .venv && uv pip install -e ".[dev]"
.venv/bin/uvicorn src.api.main:app --reload --port 8000

# Or run the entire stack with Docker
docker compose up --build
```

## Repository Layout

```
apps/web/        Next.js dashboard (port 3000)
apps/engine/     Python FastAPI engine (port 8000)
apps/agents/     TypeScript agent orchestrator (port 3001)
packages/shared/ Shared TypeScript contracts
supabase/        PostgreSQL migrations & seed data
```

## Branch Naming

Use descriptive branch names with a category prefix:

```
feat/short-description
fix/short-description
docs/short-description
chore/short-description
```

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(web): add portfolio chart component
fix(engine): correct risk calculation rounding
docs: update deployment runbook
chore(ci): add timeout to scorecard workflow
```

## Validation Commands

Run the appropriate checks **before** opening a PR:

```bash
# Node workspaces (web + agents + shared)
pnpm lint
pnpm test

# Python engine
pnpm lint:engine
pnpm format:check:engine
pnpm test:engine

# Full build
pnpm build
```

See `docs/ai/commands.md` for the complete matrix.

## Pull Request Process

1. Create a feature branch from `main`.
2. Make focused changes — keep diffs minimal.
3. Ensure all relevant checks pass locally.
4. Open a PR using the template (`.github/PULL_REQUEST_TEMPLATE.md`).
5. Fill in **Summary**, **Scope**, and **Validation** sections.
6. A reviewer will be assigned via CODEOWNERS.

## Sensitive Paths

Changes to these files require extra review:

- `apps/web/src/lib/engine-fetch.ts`
- `apps/engine/src/api/main.py`
- `packages/shared/src/*`
- `supabase/migrations/*`
- `.github/workflows/ci.yml`
- `vercel.json`, `turbo.json`, `package.json`

## Code Style

- **TypeScript/JS** — Prettier (auto-formatted via lint-staged)
- **Python** — Ruff (lint + format)
- Keep comments minimal; prefer self-documenting code.

## Deployment

- **Web** deploys to Vercel on merge to `main`.
- **Engine & Agents** deploy to Railway on merge to `main`.
- See `docs/deployment.md` for the full guide.
