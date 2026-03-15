# Sentinel Trading Platform

Evidence-based systematic trading platform. Monorepo with three apps.

## Structure

- `apps/web` - Next.js 15 dashboard (port 3000)
- `apps/engine` - Python FastAPI quant engine (port 8000)
- `apps/agents` - Claude AI agent orchestrator (Phase 4)
- `packages/shared` - Shared TypeScript types
- `supabase/` - Database migrations

## Commands

### Web (apps/web)

- `pnpm dev` - Start dev server
- `pnpm test` - Run Vitest unit/component tests
- `pnpm test:e2e` - Run Playwright E2E tests
- `pnpm build` - Production build

### Engine (apps/engine)

- `.venv/Scripts/python -m uvicorn src.api.main:app --reload --port 8000` - Start dev server
- `.venv/Scripts/python -m pytest` - Run all tests
- `.venv/Scripts/python -m pytest --cov=src` - Run tests with coverage

### Monorepo

- `pnpm dev` - Start all dev servers via Turborepo
- `pnpm test` - Run all tests
- `pnpm build` - Build all apps

## Tech Stack

- Next.js 15, TypeScript 5, Tailwind CSS 4, shadcn/ui
- Python 3.14, FastAPI, NumPy, Pandas
- Supabase (PostgreSQL + Realtime)
- TradingView Lightweight Charts
- Vitest, pytest, Playwright

## Environment

Copy `.env.example` to `.env` and fill in credentials.
Required for dev: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
