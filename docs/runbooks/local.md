# Local Development Runbook

## Prerequisites

- Node 22+ and pnpm 10.32.1
- Python 3.12+ and uv
- Docker (for full-stack mode)

## Environment Setup

```bash
cp .env.example .env
pnpm install
```

Fill in all required values in `.env`. At minimum:

| Variable                        | Where to get it                      |
| ------------------------------- | ------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase dashboard > Settings > API  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same location                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | Same location (secret)               |
| `POLYGON_API_KEY`               | polygon.io dashboard                 |
| `ALPACA_API_KEY`                | alpaca.markets dashboard (paper)     |
| `ALPACA_SECRET_KEY`             | Same location                        |
| `ANTHROPIC_API_KEY`             | console.anthropic.com                |
| `ENGINE_API_KEY`                | Any string (e.g. `sentinel-dev-key`) |

## Option 1: Node Workspaces Only

```bash
pnpm dev
```

Starts `apps/web` (port 3000) and `apps/agents` (port 3001) via Turborepo. Does **not** start the Python engine.

## Option 2: Engine Separately

```bash
cd apps/engine
uv venv .venv
uv pip install -e ".[dev]"
uv run python -m uvicorn src.api.main:app --reload --port 8000
```

Run this alongside `pnpm dev` for the full stack without Docker.

## Option 3: Full Stack via Docker Compose

```bash
docker compose up --build
```

Starts all three services:

| Service | Port | Internal URL         |
| ------- | ---- | -------------------- |
| web     | 3000 | `http://web:3000`    |
| engine  | 8000 | `http://engine:8000` |
| agents  | 3001 | `http://agents:3001` |

Compose wires internal URLs between containers automatically. The web app uses the same-origin proxy routes in the browser.

## Smoke Checks

After starting services, verify:

- http://localhost:3000 -- dashboard loads
- http://localhost:8000/health -- engine responds
- http://localhost:3001/health -- agents responds
- http://localhost:3000/api/settings/status -- all services connected

## Validation

```bash
pnpm lint                 # Node workspaces
pnpm test                 # Node workspaces
pnpm build                # Node workspaces (build check)
pnpm test:web             # web unit tests
pnpm test:agents          # agents unit tests
pnpm lint:engine          # ruff lint
pnpm format:check:engine  # ruff format check
pnpm test:engine          # pytest
```

## Gotchas

- `pnpm dev` does not start the engine. Start it separately or use Docker Compose.
- The browser should use `/api/engine/*` and `/api/agents/*` routes, not direct backend URLs.
- Never commit `.env`. It is gitignored.
- Keep `localhost`-based env values out of Vercel preview/production.
- If agents fail to start, check that `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ENGINE_URL` are set.
