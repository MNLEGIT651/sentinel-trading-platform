# Sentinel Trading Platform

A systematic trading dashboard with a quantitative engine and AI agent layer.

## Architecture

| App           | Technology         | Port |
| ------------- | ------------------ | ---- |
| `apps/web`    | Next.js 15         | 3000 |
| `apps/engine` | Python FastAPI     | 8000 |
| `apps/agents` | TypeScript Express | 3001 |

**Database**: Supabase (PostgreSQL + Realtime + Auth)
**Broker**: Alpaca Markets (paper & live)
**Market Data**: Polygon.io
**AI**: Anthropic Claude API

## Prerequisites

- Node.js 22 (`fnm install --lts`)
- Python 3.14 (`uv` for env management)
- pnpm 10 (`npm install -g pnpm@10`)
- Docker Desktop (for containerized local dev)
- Supabase CLI (`npm install -g supabase`)

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/MNLEGIT651/sentinel-trading-platform.git
cd sentinel-trading-platform
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in all [REQUIRED] values in .env
```

Required keys:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `POLYGON_API_KEY` — Polygon.io market data key
- `ALPACA_API_KEY` + `ALPACA_SECRET_KEY` — Alpaca broker credentials
- `ANTHROPIC_API_KEY` — Claude AI key

### 3. Apply database migrations

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 4. Start all services (Docker)

```bash
docker compose up --build
```

Or start individually:

```bash
# Terminal 1 — Engine
cd apps/engine
uv venv .venv && uv pip install --python .venv/Scripts/python.exe -e ".[dev]"
.venv/Scripts/python -m uvicorn src.api.main:app --reload --port 8000

# Terminal 2 — Agents
cd apps/agents && pnpm dev

# Terminal 3 — Web
cd apps/web && pnpm dev
```

## Testing

```bash
# All tests
pnpm test

# Web only
pnpm --filter web test

# Engine only (from apps/engine)
.venv/Scripts/python -m pytest tests/ -v

# Agents only
pnpm --filter agents test
```

## Deployment

See [docs/deployment-guide.md](docs/deployment-guide.md) for full production deployment steps.

**Quick deploy (web only)**:

```bash
vercel --prod
```

## Project Structure

```
apps/
  web/        # Next.js dashboard
  engine/     # FastAPI quant engine
  agents/     # TypeScript AI agent orchestrator
packages/
  shared/     # Shared TypeScript types
supabase/
  migrations/ # PostgreSQL migration files
  seed.sql    # Default instruments & strategies
docs/         # Architecture docs, research, deployment guides
```
