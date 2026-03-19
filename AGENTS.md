# Sentinel Trading Platform

> Universal agent instructions. Read by Codex CLI, Claude Code, and other AI coding tools.
> Keep this file under 200 lines. Put tool-specific config in CLAUDE.md or .codex/.

Evidence-based systematic trading platform. Turborepo monorepo, three apps, shared types.

## Repository Structure

```
apps/web/          Next.js 16 dashboard (TypeScript, port 3000)
apps/engine/       Python FastAPI quant engine (port 8000)
apps/agents/       AI agent orchestrator (Phase 4, port 3001)
packages/shared/   Shared TypeScript types (@sentinel/shared)
supabase/          Database migrations (PostgreSQL)
```

## Commands

### Web (`apps/web`)

```bash
pnpm dev                    # Start dev server (port 3000)
pnpm test                   # Run Vitest unit/component tests
pnpm test:e2e               # Run Playwright E2E tests
pnpm build                  # Production build
pnpm lint                   # ESLint
```

### Engine (`apps/engine`)

```bash
cd apps/engine
.venv/Scripts/python -m uvicorn src.api.main:app --reload --port 8000   # Dev server
.venv/Scripts/python -m pytest                                           # All tests
.venv/Scripts/python -m pytest --cov=src                                 # Tests + coverage
.venv/Scripts/ruff check src tests                                       # Lint
.venv/Scripts/ruff format src tests                                      # Format
```

### Monorepo (root)

```bash
pnpm dev                    # Start all apps via Turborepo
pnpm test                   # Run all test suites
pnpm build                  # Build everything
```

## Tech Stack

| Layer       | Technologies                                                                        |
| ----------- | ----------------------------------------------------------------------------------- |
| Frontend    | Next.js 16, TypeScript 5, Tailwind CSS 4, shadcn/ui, TradingView Lightweight Charts |
| Backend     | Python 3.12+, FastAPI, NumPy, Pandas, httpx                                         |
| Database    | Supabase (PostgreSQL + Realtime)                                                    |
| Broker      | Alpaca (paper trading default)                                                      |
| Market Data | Polygon.io                                                                          |
| Testing     | Vitest + Testing Library (web), pytest + hypothesis (engine), Playwright (e2e)      |
| CI/Quality  | Husky, lint-staged, commitlint (conventional commits), ESLint, Ruff, Prettier       |

## Environment Setup

1. Copy `.env.example` to `.env` and fill in credentials
2. Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. Required for live data: `POLYGON_API_KEY`, `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`
4. Engine API key: `ENGINE_API_KEY` (server) and `NEXT_PUBLIC_ENGINE_API_KEY` (client) must match
5. Web app reads `NEXT_PUBLIC_ENGINE_URL` and `NEXT_PUBLIC_AGENTS_URL` for service discovery

## Architecture Conventions

### Engine (Python)

- All routes live in `apps/engine/src/api/routes/` as FastAPI `APIRouter` instances
- Business logic goes in `apps/engine/src/` modules (not in route handlers)
- `ApiKeyMiddleware` enforces `X-API-Key` header on all routes except `/health`, `/docs`, `/openapi.json`
- Config via `pydantic-settings` in `src/config.py`, loaded from `.env`
- Tests: unit tests in `tests/unit/`, integration tests in `tests/integration/`
- All test clients must include `X-API-Key` header (see `tests/conftest.py`)

### Web (TypeScript)

- `'use client'` pages in `apps/web/src/app/` — Next.js App Router
- Global state via Zustand store (`stores/app-store.ts`)
- Engine calls go through `engineUrl()` / `engineHeaders()` from `lib/engine-fetch.ts` — never raw `fetch` to engine
- Components in `components/`, hooks in `hooks/`, utilities in `lib/`
- UI components from shadcn/ui — run `npx shadcn@latest add <component>` to add new ones
- All pages show `OfflineBanner` when engine/agents are unreachable
- Fallback data is labeled with `SimulatedBadge` — never present fake data as real

### Shared Types

- TypeScript types shared between web and agents live in `packages/shared/src/`
- Import as `@sentinel/shared`

## Coding Standards

- **Conventional commits**: `feat|fix|chore|docs|style|refactor|test|ci|perf|revert(scope): message`
- **No secrets in code**: All credentials via `.env` — never hardcode keys, tokens, or passwords
- **ESLint zero warnings**: `--max-warnings=0` enforced by pre-commit hook
- **Ruff**: Python linting and formatting enforced by pre-commit hook
- **Tests required**: New features need tests. Run the relevant test suite before committing.
- **Minimal changes**: Fix what's asked. Don't refactor surrounding code, add comments to unchanged code, or over-engineer.

## Git Workflow

- Pre-commit: lint-staged runs Prettier, ESLint, Ruff on staged files
- Commit messages validated by commitlint (conventional format required)
- Branch from `main`, PR back to `main`

## Multi-Agent Collaboration

When multiple AI agents work on this repo simultaneously:

- **Use git worktrees** to avoid file conflicts: `git worktree add ../sentinel-<task> -b <branch>`
- **Claim your work**: Create a feature branch before making changes
- **Don't modify shared config** (package.json, tsconfig, .env.example) without coordinating
- **Run tests before committing**: `pnpm test` (web) and `.venv/Scripts/python -m pytest` (engine)
- **One agent per file**: Avoid editing the same file concurrently
