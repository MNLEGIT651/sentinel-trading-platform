# Sentinel Trading Platform — CLAUDE.md

This file gives Claude Code (and any developer) full context to work on Sentinel without needing to explore the codebase first.

## Project Overview

Evidence-based systematic trading platform. Three-app pnpm monorepo:

| App           | Stack                                           | Port | Purpose                                |
| ------------- | ----------------------------------------------- | ---- | -------------------------------------- |
| `apps/web`    | Next.js 15, TypeScript 5, Tailwind 4, shadcn/ui | 3000 | Trading dashboard                      |
| `apps/engine` | Python 3.14, FastAPI 0.115, NumPy/Pandas        | 8000 | Quant engine (signals, backtest, risk) |
| `apps/agents` | TypeScript, Express 4, Anthropic SDK            | 3001 | AI agent orchestrator                  |

**Database**: Supabase (PostgreSQL + Realtime + RLS + Auth)
**Broker**: Alpaca Markets (paper trading by default — `BROKER_MODE=paper`)
**Market Data**: Polygon.io (5 req/min free tier — rate limited in engine)
**AI Layer**: Anthropic Claude API (agent reasoning)

---

## Repository Structure

```
apps/
  web/            # Next.js dashboard (App Router)
  engine/         # FastAPI quant engine
  agents/         # TypeScript AI orchestrator
packages/
  shared/         # Shared TypeScript types
supabase/
  migrations/     # 3 PostgreSQL migration files
  seed.sql        # Default instruments & strategies
docs/
  deployment-guide.md   # Production deployment runbook
  superpowers/plans/    # Implementation plans (this session)
.github/workflows/
  ci.yml          # 4-job CI: test-web, test-engine, test-agents, secrets-scan
```

---

## Commands

### Web (`apps/web`)

```bash
pnpm dev                    # Dev server (port 3000)
pnpm test                   # Vitest unit + component tests
pnpm test:e2e               # Playwright E2E tests
pnpm build                  # Production build
pnpm lint                   # ESLint
```

### Engine (`apps/engine`)

```bash
# Always run from apps/engine/ — the .venv lives there
.venv/Scripts/python -m uvicorn src.api.main:app --reload --port 8000   # Dev server
.venv/Scripts/python -m pytest                                           # All tests
.venv/Scripts/python -m pytest --cov=src                                # With coverage
.venv/Scripts/python -m pytest tests/unit/test_foo.py -v               # Single file
uv pip install --python .venv/Scripts/python.exe -e ".[dev]"           # Reinstall deps
```

### Agents (`apps/agents`)

```bash
pnpm dev          # Dev server (port 3001, hot reload via tsx)
pnpm test         # Vitest tests
pnpm build        # TypeScript compile
pnpm lint         # tsc --noEmit
```

### Monorepo (run from root)

```bash
pnpm dev          # Start all apps via Turborepo
pnpm test         # Run all tests
pnpm build        # Build all apps
pnpm lint         # Lint all apps
docker compose up --build   # Full local stack (engine + agents + web)
```

---

## Environment Setup

Copy `.env.example` to `.env`. Required keys:

| Variable                               | Source                              | Purpose                                                            |
| -------------------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase dashboard → Settings → API | Supabase project URL                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Supabase dashboard                  | Public JWT key                                                     |
| `SUPABASE_SERVICE_ROLE_KEY`            | Supabase dashboard                  | Server-side key (bypass RLS)                                       |
| `POLYGON_API_KEY`                      | polygon.io                          | Market data (free: 5 req/min)                                      |
| `ALPACA_API_KEY` + `ALPACA_SECRET_KEY` | app.alpaca.markets                  | Broker API                                                         |
| `ANTHROPIC_API_KEY`                    | console.anthropic.com               | AI agents                                                          |
| `ENGINE_ENVIRONMENT`                   | —                                   | `development` (default) or `production` (disables Swagger UI)      |
| `BROKER_MODE`                          | —                                   | `paper` (default) or `live`                                        |
| `CORS_ORIGINS`                         | —                                   | Comma-separated allowed origins (production: set to Vercel domain) |

---

## Tech Stack Details

### Frontend (`apps/web`)

- **Next.js 15** (App Router, standalone output)
- **React 19**, TypeScript 5 strict mode
- **Tailwind CSS 4** + **shadcn/ui** + **Base UI** for components
- **Zustand 5** for state management
- **TradingView Lightweight Charts 5** for price charts
- **Supabase JS 2** for real-time data subscriptions
- **Vitest 3** + **React Testing Library 16** for unit tests
- **Playwright** for E2E tests (configured, not yet wired to CI)

### Backend (`apps/engine`)

- **FastAPI 0.115** + **Uvicorn** + **Pydantic v2**
- **SlowAPI 0.1.9** for rate limiting (5 req/min on `/ingest`, 5 req/min on `/scan`)
- **NumPy 2 + Pandas 2** for quant calculations
- **httpx** for async HTTP (Polygon client has built-in 429 retry/backoff)
- **APScheduler** for background data ingestion jobs
- **pytest 8** + **pytest-asyncio** + **hypothesis** + **respx**
- **Ruff** for linting/formatting (target: py312, line-length: 100)

### Agent Orchestrator (`apps/agents`)

- **Express 4** + **TypeScript 5** + **tsx** for dev
- **Anthropic SDK 0.78** for Claude AI integration
- **Zod 4** for schema validation
- **node-cron 3** for market-hours scheduling
- **Vitest 3** + **supertest 7** for tests

### Infrastructure

- **Supabase**: 3 migration files, RLS on all tables, Realtime on signals/orders/trades/positions
- **Docker**: Multi-stage builds, non-root users (uid 1001), health checks on all services
- **pnpm 10.32.1** (pinned in `packageManager` field and all Dockerfiles)
- **Turborepo 2** for build caching
- **GitHub Actions**: 4 jobs (test-web, test-engine, test-agents, secrets-scan via Gitleaks)
- **Vercel**: Web app auto-deploys on push to main (after all CI jobs pass)

---

## Architecture Decisions

### Rate Limiting

All external-facing expensive routes are rate-limited via SlowAPI:

- `POST /api/v1/data/ingest` — 5 req/min (triggers Polygon API calls)
- `POST /api/v1/strategies/scan` — 5 req/min (triggers Polygon + compute)
- Default global limit: 60 req/min
- Implementation: `apps/engine/src/api/limiter.py` (shared singleton to avoid circular imports)

### Security Headers (web)

`apps/web/next.config.ts` sets:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` (restricts scripts, styles, connections to known origins)
- `Permissions-Policy` (blocks camera, microphone, geolocation)

### Supabase RLS

Every table has Row Level Security enabled. Policies restrict access to `auth.uid() = user_id`. The `instruments` table is public (no auth required). Service role key bypasses RLS (used by engine/agents only — never exposed to frontend).

### CORS

Engine CORS is configured via `CORS_ORIGINS` env var (default: `http://localhost:3000`). In production, set to your Vercel domain.

### OpenAPI Docs

Swagger UI (`/docs`) and ReDoc (`/redoc`) are disabled when `ENGINE_ENVIRONMENT=production`. Always accessible in development and staging.

### Broker Safety

`BROKER_MODE=paper` is the default. Never set to `live` without explicit intent. Paper trading uses Alpaca's paper environment with no real money.

---

## Database

### Migrations (in order)

1. `00001_initial_schema.sql` — accounts, instruments, ohlc_data, strategies, signals, orders, trades, positions, risk_metrics, recommendations, agent_state
2. `00002_indexes_rls_realtime.sql` — performance indexes, RLS policies, Realtime publication
3. `00003_agent_tables.sql` — agent_runs, agent_logs

### Apply migrations

```bash
supabase link --project-ref <your-project-ref>
supabase db push
psql "$DATABASE_URL" < supabase/seed.sql   # seed default instruments + strategies
```

---

## CI/CD Pipeline

**File**: `.github/workflows/ci.yml`

| Job            | Triggers                      | What it does                              |
| -------------- | ----------------------------- | ----------------------------------------- |
| `test-web`     | push/PR                       | pnpm test + build (Node 22, pnpm 10.32.1) |
| `test-engine`  | push/PR                       | pytest (Python 3.12, uv)                  |
| `test-agents`  | push/PR                       | pnpm test (Node 22, pnpm 10.32.1)         |
| `secrets-scan` | push/PR                       | Gitleaks full-history scan                |
| `deploy-web`   | push to main (after all pass) | vercel --prod                             |

**Note**: Engine and agents Docker builds are currently deployed manually (see `docs/deployment-guide.md`).

---

## Testing Strategy

### Web (94 tests)

- Component tests: React Testing Library, jsdom
- Page-level integration: full page render tests
- Hook tests: async action hooks
- Config tests: next.config.ts header assertions
- All in `apps/web/tests/`

### Engine (244+ tests)

- Unit tests: `tests/unit/` — each module tested in isolation with mocks
- Integration tests: `tests/integration/` — FastAPI TestClient, stubbed env vars
- Property tests: hypothesis for strategy calculations
- Key mocking patterns:
  - Mock `src.api.routes.data.PolygonClient` (not `src.data.polygon_client.PolygonClient`)
  - Mock `src.api.routes.data.DataIngestionService` for ingest endpoint tests
  - Use `TestClient(app, raise_server_exceptions=False)` for rate limiting tests

### Agents (8 test files)

- Vitest + supertest for HTTP endpoint tests
- Mocked Supabase and engine clients

---

## Code Conventions

### Python (engine)

- Ruff: `select = ["E", "F", "I", "N", "W", "UP"]`, `line-length = 100`, `target-version = "py312"`
- Pydantic v2 for all request/response models
- `async def` for all route handlers
- Route functions that use SlowAPI must have `request: Request` as first param (Starlette Request, not Pydantic body)
- Error shape: `{"error": "error_key", "detail": "human message"}`

### TypeScript (web + agents)

- Strict mode: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- Prettier: 2-space indent, trailing commas, 100 char width
- ESLint: `eslint-config-next` (core-web-vitals + typescript)
- Zod for runtime validation in agents

### Git

- Conventional commits: `feat:`, `fix:`, `docs:`, `ci:`, `chore:`, `refactor:`, `test:`
- Scopes: `(web)`, `(engine)`, `(agents)`, `(ci)`, `(db)`
- Pre-commit: Prettier + ESLint (web) + Ruff (engine) via lint-staged
- Commit-msg: commitlint validates conventional commit format

---

## What Was Done in the Deployment Readiness Session (2026-03-16)

This session hardened the project from development-quality to production-ready:

| Change                                       | Files                                                        | Why                           |
| -------------------------------------------- | ------------------------------------------------------------ | ----------------------------- |
| Fixed pnpm@9 → pnpm@10.32.1 in Dockerfiles   | `apps/web/Dockerfile`, `apps/agents/Dockerfile`              | Docker builds were broken     |
| Pinned pnpm in CI via `pnpm/action-setup@v4` | `.github/workflows/ci.yml`                                   | Reproducible CI builds        |
| Fixed Windows-only ruff path in lint-staged  | `package.json`                                               | Cross-platform dev            |
| Fixed Husky commit-msg `$1` quoting          | `.husky/commit-msg`                                          | Spaces in path                |
| Added Gitleaks secrets scanning to CI        | `.github/workflows/ci.yml`                                   | Prevent secret leaks          |
| Added SlowAPI rate limiting to engine        | `apps/engine/src/api/limiter.py`, `data.py`, `strategies.py` | API abuse + Polygon quota     |
| Fixed pre-existing test mock paths           | `apps/engine/tests/unit/test_data_routes.py`                 | Tests were failing            |
| Added root README.md                         | `README.md`                                                  | Project was undocumented      |
| Added environment-gated OpenAPI docs         | `apps/engine/src/api/main.py`, `config.py`                   | Swagger hidden in production  |
| Added production deployment guide            | `docs/deployment-guide.md`                                   | No runbook existed            |
| Added correlation ID middleware              | `apps/engine/src/api/middleware.py`                          | Cross-service tracing         |
| Added React error boundary                   | `apps/web/src/components/error-boundary.tsx`                 | Graceful UI error handling    |
| Added Content Security Policy                | `apps/web/next.config.ts`                                    | XSS prevention                |
| Added circuit breaker (tenacity)             | `apps/engine/src/utils/circuit_breaker.py`                   | Polygon/Alpaca resilience     |
| Added Vercel CD job to CI                    | `.github/workflows/ci.yml`                                   | Automated deploys             |
| Added Supabase migration CI validation       | `.github/workflows/ci.yml`                                   | Catch broken migrations early |

---

## Deployment

See `docs/deployment-guide.md` for the full runbook.

Quick reference:

- **Web**: push to `main` → CI runs → auto-deploys to Vercel
- **Engine**: `docker build -t sentinel-engine . && docker run -e ENGINE_ENVIRONMENT=production ...`
- **Agents**: same Docker pattern
- **DB**: `supabase db push`

---

## Known Gaps (Future Work)

- Docker CD automation (build/push to GHCR/ECR + remote restart) — needs a provisioned host
- Distributed tracing with OpenTelemetry across all 3 services
- Error monitoring service (Sentry)
- Playwright E2E tests not yet wired to CI
- `apps/agents` is Phase 4 — partially implemented, not all features complete
