# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Sentinel monorepo with all infrastructure, database schema, market data ingestion, basic dashboard with live prices, and paper broker skeleton.

**Architecture:** pnpm monorepo with Turborepo orchestration. Three apps (web/Next.js, engine/Python FastAPI, agents/TypeScript stub). Supabase for Postgres + Realtime. Data flows from Polygon.io → engine → Supabase → dashboard via Realtime subscriptions.

**Tech Stack:** pnpm, Turborepo, Next.js 15 (App Router), TypeScript 5, Tailwind CSS 4, shadcn/ui, Python 3.14, FastAPI, Supabase, Vitest, pytest, Playwright

**Spec:** `docs/superpowers/specs/2026-03-14-sentinel-trading-platform-design.md`

---

## File Structure

```
sentinel/  (root = "C:/Users/steve/Projects/personal/Stock Trading App")
├── .env.example
├── .gitignore
├── CLAUDE.md
├── package.json                    # Root package.json (workspaces, scripts)
├── pnpm-workspace.yaml             # Workspace config
├── turbo.json                      # Turborepo pipeline config
├── .claude/
│   └── launch.json                 # Dev server configurations
│
├── supabase/
│   └── migrations/
│       └── 00001_initial_schema.sql # All tables, indexes, RLS
│
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.mjs
│   │   ├── vitest.config.ts
│   │   ├── playwright.config.ts
│   │   ├── components.json          # shadcn/ui config
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx       # Root layout: sidebar, dark theme, providers
│   │   │   │   ├── page.tsx         # Command center dashboard
│   │   │   │   ├── globals.css      # Tailwind imports + custom vars
│   │   │   │   ├── markets/
│   │   │   │   │   └── page.tsx     # Watchlist + price charts
│   │   │   │   └── (other pages are Phase 2-6)
│   │   │   ├── components/
│   │   │   │   ├── ui/              # shadcn/ui components (generated)
│   │   │   │   ├── layout/
│   │   │   │   │   ├── sidebar.tsx
│   │   │   │   │   └── header.tsx
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── metric-card.tsx
│   │   │   │   │   ├── price-ticker.tsx
│   │   │   │   │   └── alert-feed.tsx
│   │   │   │   └── charts/
│   │   │   │       └── price-chart.tsx  # TradingView Lightweight Charts wrapper
│   │   │   ├── lib/
│   │   │   │   ├── supabase/
│   │   │   │   │   ├── client.ts    # Browser Supabase client
│   │   │   │   │   └── server.ts    # Server-side Supabase client
│   │   │   │   ├── engine-client.ts # Typed client for engine API
│   │   │   │   └── utils.ts         # Shared utilities (cn, formatters)
│   │   │   ├── hooks/
│   │   │   │   ├── use-realtime.ts  # Supabase Realtime subscription hook
│   │   │   │   └── use-market-data.ts
│   │   │   └── stores/
│   │   │       └── app-store.ts     # Zustand store
│   │   └── tests/
│   │       ├── unit/
│   │       │   ├── utils.test.ts
│   │       │   └── stores.test.ts
│   │       ├── components/
│   │       │   ├── metric-card.test.tsx
│   │       │   └── price-ticker.test.tsx
│   │       └── e2e/
│   │           └── dashboard.spec.ts
│   │
│   ├── engine/
│   │   ├── pyproject.toml
│   │   ├── requirements.txt
│   │   ├── src/
│   │   │   ├── __init__.py
│   │   │   ├── config.py             # pydantic-settings config
│   │   │   ├── db.py                 # Supabase client wrapper
│   │   │   ├── api/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── main.py           # FastAPI app + scheduler setup
│   │   │   │   ├── deps.py           # Dependency injection
│   │   │   │   └── routes/
│   │   │   │       ├── __init__.py
│   │   │   │       ├── data.py       # Data ingestion endpoints
│   │   │   │       ├── portfolio.py  # Portfolio endpoints
│   │   │   │       └── health.py     # Health check
│   │   │   ├── data/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── polygon_client.py # Polygon.io API wrapper
│   │   │   │   └── ingestion.py      # Data ingestion orchestrator
│   │   │   └── execution/
│   │   │       ├── __init__.py
│   │   │       ├── broker_interface.py # Abstract broker protocol
│   │   │       └── paper_broker.py    # Paper trading engine
│   │   └── tests/
│   │       ├── __init__.py
│   │       ├── conftest.py
│   │       ├── unit/
│   │       │   ├── __init__.py
│   │       │   ├── test_config.py
│   │       │   ├── test_polygon_client.py
│   │       │   ├── test_ingestion.py
│   │       │   ├── test_paper_broker.py
│   │       │   └── test_cost_model.py
│   │       └── integration/
│   │           ├── __init__.py
│   │           └── test_data_pipeline.py
│   │
│   └── agents/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts              # Stub entry point (Phase 4)
│
└── packages/
    └── shared/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts
            └── types.ts              # Shared TypeScript types (DB row types)
```

---

## Chunk 1: Monorepo Scaffolding

### Task 1: Initialize monorepo root

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "sentinel",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "clean": "turbo clean"
  },
  "devDependencies": {
    "turbo": "^2"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
.next/
dist/
.turbo/
.env
.env.local
*.pyc
__pycache__/
.venv/
*.egg-info/
.pytest_cache/
.coverage
htmlcov/
.vercel/
```

- [ ] **Step 5: Create .env.example**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Market Data
POLYGON_API_KEY=

# AI (Phase 4)
ANTHROPIC_API_KEY=

# Broker
BROKER_MODE=paper
ALPACA_API_KEY=
ALPACA_SECRET_KEY=
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Engine
ENGINE_URL=http://localhost:8000
ENGINE_API_KEY=sentinel-dev-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 6: Install turbo and verify**

```bash
pnpm install
pnpm turbo --version
```

Expected: Turbo version prints successfully.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize monorepo with pnpm workspaces + Turborepo"
```

---

### Task 2: Create shared package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: Create packages/shared/package.json**

```json
{
  "name": "@sentinel/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create packages/shared/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/shared/src/types.ts**

These types mirror the database schema rows and are used by both the web app and agents app.

```typescript
// Database row types matching Supabase schema

export interface Instrument {
  id: string;
  ticker: string;
  name: string;
  asset_class: 'equity' | 'etf' | 'option' | 'future' | 'fx' | 'crypto';
  exchange: string | null;
  sector: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MarketDataRow {
  instrument_id: string;
  timestamp: string;
  timeframe: '1m' | '5m' | '15m' | '1h' | '1d' | '1w';
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number | null;
  adjusted_close: number | null;
  source: string;
  created_at: string;
}

export interface OHLCV {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  broker: 'paper' | 'alpaca';
  initial_capital: number;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

export interface Signal {
  id: string;
  user_id: string;
  account_id: string;
  instrument_id: string;
  strategy_id: string;
  direction: 'long' | 'short' | 'flat';
  strength: number;
  confidence: number | null;
  metadata: Record<string, unknown>;
  generated_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export interface Order {
  id: string;
  user_id: string;
  account_id: string;
  instrument_id: string;
  signal_id: string | null;
  side: 'buy' | 'sell';
  order_type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  limit_price: number | null;
  stop_price: number | null;
  status: 'pending' | 'submitted' | 'partial' | 'filled' | 'cancelled' | 'rejected';
  broker: 'paper' | 'alpaca';
  fill_price: number | null;
  fill_quantity: number | null;
  commission: number;
  slippage: number | null;
  submitted_at: string | null;
  filled_at: string | null;
  created_at: string;
}

export interface PortfolioPosition {
  id: string;
  user_id: string;
  account_id: string;
  instrument_id: string;
  quantity: number;
  avg_entry_price: number;
  realized_pnl: number;
  side: 'long' | 'short';
  opened_at: string;
  updated_at: string;
  // Computed (from view join):
  current_price?: number;
  unrealized_pnl?: number;
}

export interface PortfolioSnapshot {
  id: number;
  user_id: string;
  account_id: string;
  timestamp: string;
  total_equity: number;
  cash: number;
  positions_value: number;
  daily_pnl: number | null;
  daily_return: number | null;
  cumulative_pnl: number | null;
  cumulative_return: number | null;
  drawdown: number | null;
  max_drawdown: number | null;
  num_positions: number;
}

export interface RiskMetrics {
  id: number;
  user_id: string;
  account_id: string;
  timestamp: string;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  calmar_ratio: number | null;
  max_drawdown: number | null;
  current_drawdown: number | null;
  annualized_volatility: number | null;
  annualized_return: number | null;
  var_95: number | null;
  cvar_95: number | null;
  beta: number | null;
  win_rate: number | null;
  profit_factor: number | null;
  avg_win: number | null;
  avg_loss: number | null;
  turnover: number | null;
  metadata: Record<string, unknown>;
}

export interface Alert {
  id: string;
  user_id: string;
  type: 'signal' | 'risk' | 'execution' | 'system' | 'agent';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  instrument_id: string | null;
  strategy_id: string | null;
  metadata: Record<string, unknown>;
  acknowledged: boolean;
  created_at: string;
}

export interface Strategy {
  id: string;
  name: string;
  family: 'trend' | 'momentum' | 'value' | 'mean_reversion' | 'pairs' | 'composite';
  description: string | null;
  parameters: Record<string, unknown>;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

// API response types for engine communication
export interface EngineResponse<T> {
  data: T;
  error?: string;
}

export interface IngestResult {
  ingested: number;
  errors: string[];
}

export interface LatestPrices {
  prices: Record<string, OHLCV>;
}
```

- [ ] **Step 4: Create packages/shared/src/index.ts**

```typescript
export * from './types';
```

- [ ] **Step 5: Run type check**

```bash
cd packages/shared && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types package with all database row types"
```

---

### Task 3: Scaffold Next.js web app

**Files:**
- Create: `apps/web/` (via create-next-app)
- Modify: `apps/web/package.json` (add workspace dep)

- [ ] **Step 1: Create Next.js app with create-next-app**

```bash
cd apps && pnpm create next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

- [ ] **Step 2: Add workspace dependency and dev tools to apps/web/package.json**

Add to dependencies:
```json
{
  "@sentinel/shared": "workspace:*"
}
```

Add to devDependencies:
```json
{
  "vitest": "^3",
  "@testing-library/react": "^16",
  "@testing-library/jest-dom": "^6",
  "jsdom": "^26",
  "@playwright/test": "^1"
}
```

- [ ] **Step 3: Create apps/web/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4: Create apps/web/tests/setup.ts**

```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Add test script to apps/web/package.json**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 6: Install all dependencies from root**

```bash
cd ../.. && pnpm install
```

- [ ] **Step 7: Verify Next.js builds**

```bash
cd apps/web && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add apps/web/
git commit -m "feat: scaffold Next.js 15 web app with Vitest + Playwright"
```

---

### Task 4: Install shadcn/ui and base components

**Files:**
- Create: `apps/web/components.json`
- Create: `apps/web/src/components/ui/` (generated by shadcn)
- Create: `apps/web/src/lib/utils.ts`

- [ ] **Step 1: Initialize shadcn/ui**

```bash
cd apps/web && pnpm dlx shadcn@latest init -d
```

This creates `components.json` and sets up the UI component infrastructure.

- [ ] **Step 2: Add core UI components**

```bash
pnpm dlx shadcn@latest add button card badge separator tooltip scroll-area sheet avatar dropdown-menu tabs sonner
```

- [ ] **Step 3: Verify the cn utility exists at src/lib/utils.ts**

Should contain the `cn` function combining clsx and tailwind-merge.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: install shadcn/ui with core component library"
```

---

### Task 5: Scaffold Python engine app

**Files:**
- Create: `apps/engine/pyproject.toml`
- Create: `apps/engine/requirements.txt`
- Create: `apps/engine/src/__init__.py`
- Create: `apps/engine/src/config.py`
- Create: `apps/engine/src/db.py`
- Create: `apps/engine/src/api/__init__.py`
- Create: `apps/engine/src/api/main.py`
- Create: `apps/engine/src/api/deps.py`
- Create: `apps/engine/src/api/routes/__init__.py`
- Create: `apps/engine/src/api/routes/health.py`
- Create: `apps/engine/tests/conftest.py`
- Create: `apps/engine/tests/__init__.py`

- [ ] **Step 1: Create apps/engine/pyproject.toml**

```toml
[project]
name = "sentinel-engine"
version = "0.1.0"
description = "Sentinel Trading Platform - Quant Engine"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.34",
    "pydantic>=2",
    "pydantic-settings>=2",
    "supabase>=2",
    "httpx>=0.28",
    "numpy>=2",
    "pandas>=2",
    "scipy>=1.14",
    "apscheduler>=3.10",
    "python-dotenv>=1",
]

[project.optional-dependencies]
dev = [
    "pytest>=8",
    "pytest-asyncio>=0.24",
    "pytest-cov>=6",
    "hypothesis>=6",
    "respx>=0.22",
    "ruff>=0.8",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
addopts = "-v --tb=short"

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]
```

- [ ] **Step 2: Create apps/engine/requirements.txt**

```
fastapi>=0.115
uvicorn[standard]>=0.34
pydantic>=2
pydantic-settings>=2
supabase>=2
httpx>=0.28
numpy>=2
pandas>=2
scipy>=1.14
apscheduler>=3.10
python-dotenv>=1
```

- [ ] **Step 3: Create apps/engine/src/__init__.py**

Empty file.

- [ ] **Step 4: Create apps/engine/src/config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Market Data
    polygon_api_key: str = ""

    # Engine
    engine_api_key: str = "sentinel-dev-key"

    # Broker
    broker_mode: str = "paper"  # "paper" | "live"

    # Scheduler
    data_ingestion_interval_minutes: int = 1440  # Default: daily (free tier)
    signal_generation_interval_minutes: int = 15
    risk_update_interval_minutes: int = 5

    model_config = {"env_file": "../../.env", "env_file_encoding": "utf-8"}


settings = Settings()
```

- [ ] **Step 5: Create apps/engine/src/db.py**

```python
from supabase import create_client, Client

from src.config import settings


def get_supabase_client() -> Client:
    """Create a Supabase client using the service role key."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. "
            "Copy .env.example to .env and fill in your Supabase credentials."
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
```

- [ ] **Step 6: Create apps/engine/src/api/__init__.py**

Empty file.

- [ ] **Step 7: Create apps/engine/src/api/deps.py**

```python
from functools import lru_cache

from src.config import Settings


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 8: Create apps/engine/src/api/routes/__init__.py**

Empty file.

- [ ] **Step 9: Create apps/engine/src/api/routes/health.py**

```python
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    return {"status": "ok", "service": "sentinel-engine"}
```

- [ ] **Step 10: Create apps/engine/src/api/main.py**

```python
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import health


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup: initialize scheduler, connections
    yield
    # Shutdown: cleanup


app = FastAPI(
    title="Sentinel Engine",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")
```

- [ ] **Step 11: Create apps/engine/tests/__init__.py and conftest.py**

`tests/__init__.py`: Empty file.

`tests/conftest.py`:

```python
import pytest
from fastapi.testclient import TestClient

from src.api.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
```

- [ ] **Step 12: Create apps/engine/tests/unit/__init__.py**

Empty file.

- [ ] **Step 13: Create apps/engine/tests/integration/__init__.py**

Empty file.

- [ ] **Step 14: Create virtual environment and install**

```bash
cd apps/engine && python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"
```

- [ ] **Step 15: Create first test: tests/unit/test_config.py**

```python
from src.config import Settings


def test_settings_defaults():
    s = Settings(supabase_url="http://test", supabase_service_role_key="key")
    assert s.broker_mode == "paper"
    assert s.data_ingestion_interval_minutes == 1440
    assert s.engine_api_key == "sentinel-dev-key"
```

- [ ] **Step 16: Run tests**

```bash
cd apps/engine && .venv/Scripts/python -m pytest tests/unit/test_config.py -v
```

Expected: 1 test passes.

- [ ] **Step 17: Test health endpoint**

Create `tests/unit/test_health.py`:

```python
def test_health_check(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "sentinel-engine"
```

Run:
```bash
.venv/Scripts/python -m pytest tests/unit/test_health.py -v
```

Expected: PASS.

- [ ] **Step 18: Commit**

```bash
git add apps/engine/
git commit -m "feat: scaffold Python FastAPI engine with config, health endpoint, and tests"
```

---

### Task 6: Scaffold agents app (stub)

**Files:**
- Create: `apps/agents/package.json`
- Create: `apps/agents/tsconfig.json`
- Create: `apps/agents/src/index.ts`

- [ ] **Step 1: Create apps/agents/package.json**

```json
{
  "name": "@sentinel/agents",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@sentinel/shared": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4",
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

- [ ] **Step 2: Create apps/agents/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create apps/agents/src/index.ts**

```typescript
console.log('[Sentinel Agents] Stub - agent orchestrator will be implemented in Phase 4');
console.log('[Sentinel Agents] Available agents: Market Sentinel, Strategy Analyst, Risk Monitor, Research, Execution Monitor');
```

- [ ] **Step 4: Install and verify**

```bash
cd ../.. && pnpm install
```

- [ ] **Step 5: Commit**

```bash
git add apps/agents/
git commit -m "feat: scaffold agents app stub (Phase 4 implementation)"
```

---

### Task 7: Create CLAUDE.md and launch.json

**Files:**
- Update: `CLAUDE.md` (root)
- Create: `.claude/launch.json`

- [ ] **Step 1: Create root CLAUDE.md**

```markdown
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
```

- [ ] **Step 2: Create .claude/launch.json**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "Web Dashboard",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@sentinel/web", "dev"],
      "port": 3000
    },
    {
      "name": "Quant Engine",
      "runtimeExecutable": "python",
      "runtimeArgs": ["-m", "uvicorn", "src.api.main:app", "--reload", "--port", "8000"],
      "port": 8000
    },
    {
      "name": "Agents (stub)",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@sentinel/agents", "dev"],
      "port": 3001
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md .claude/
git commit -m "docs: add CLAUDE.md and dev server launch configurations"
```

---

## Chunk 2: Database Schema

### Task 8: Create Supabase migration

**Files:**
- Create: `supabase/migrations/00001_initial_schema.sql`

- [ ] **Step 1: Create the migration file**

Write the complete SQL from the spec (sections 3.0-3.3) into `supabase/migrations/00001_initial_schema.sql`. This includes:

1. `accounts` table
2. `instruments` table
3. `market_data` table (non-partitioned, natural PK)
4. `strategies` table
5. `signals` table (with user_id, account_id)
6. `orders` table (with user_id, account_id)
7. `portfolio_positions` table (with user_id, account_id)
8. `portfolio_snapshots` table (with user_id, account_id)
9. `risk_metrics` table (with user_id, account_id)
10. `agent_logs` table
11. `alerts` table (with user_id)
12. `watchlists` table (with user_id)
13. `watchlist_items` junction table
14. `trades` table (with user_id, account_id)
15. `backtest_results` table
16. All indexes from spec section 3.2
17. RLS policies from spec section 3.3
18. `portfolio_positions_live` view

The full SQL should be copied from the spec's SQL blocks, with these additions:

```sql
-- Additional indexes for new tables
CREATE INDEX idx_trades_account ON trades (account_id, closed_at DESC);
CREATE INDEX idx_trades_strategy ON trades (strategy_id, closed_at DESC);
CREATE INDEX idx_watchlist_items_instrument ON watchlist_items (instrument_id);

-- RLS policies for all user-scoped tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_accounts" ON accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_signals" ON signals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_orders" ON orders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE portfolio_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_positions" ON portfolio_positions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_snapshots" ON portfolio_snapshots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE risk_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_risk_metrics" ON risk_metrics FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_alerts" ON alerts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_watchlists" ON watchlists FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_trades" ON trades FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Shared reference tables: read for authenticated, write for service role
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "instruments_read" ON instruments FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_data_read" ON market_data FOR SELECT USING (auth.role() = 'authenticated');

-- Strategies are readable by all authenticated, writable by owner (no user_id, service role writes)
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "strategies_read" ON strategies FOR SELECT USING (auth.role() = 'authenticated');

-- Portfolio positions live view
CREATE OR REPLACE VIEW portfolio_positions_live AS
SELECT
  pp.*,
  md.close AS current_price,
  (md.close - pp.avg_entry_price) * pp.quantity *
    CASE pp.side WHEN 'long' THEN 1 ELSE -1 END AS unrealized_pnl,
  CASE
    WHEN pp.avg_entry_price > 0 THEN
      ((md.close - pp.avg_entry_price) / pp.avg_entry_price) * 100 *
      CASE pp.side WHEN 'long' THEN 1 ELSE -1 END
    ELSE 0
  END AS unrealized_pnl_pct
FROM portfolio_positions pp
LEFT JOIN LATERAL (
  SELECT close FROM market_data
  WHERE instrument_id = pp.instrument_id AND timeframe = '1d'
  ORDER BY timestamp DESC LIMIT 1
) md ON true;
```

- [ ] **Step 2: Apply migration to Supabase**

Using the Supabase MCP tool:
```
apply_migration with name "initial_schema" and the SQL content
```

- [ ] **Step 3: Verify tables exist**

Using the Supabase MCP tool:
```
list_tables to confirm all 15 tables are created
```

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add complete database schema migration with RLS policies"
```

---

### Task 9: Seed default data

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Create seed data**

```sql
-- Default instruments (major US equities + ETFs)
INSERT INTO instruments (ticker, name, asset_class, exchange, sector) VALUES
  ('AAPL', 'Apple Inc.', 'equity', 'NASDAQ', 'Technology'),
  ('MSFT', 'Microsoft Corporation', 'equity', 'NASDAQ', 'Technology'),
  ('GOOGL', 'Alphabet Inc.', 'equity', 'NASDAQ', 'Technology'),
  ('AMZN', 'Amazon.com Inc.', 'equity', 'NASDAQ', 'Consumer Discretionary'),
  ('NVDA', 'NVIDIA Corporation', 'equity', 'NASDAQ', 'Technology'),
  ('META', 'Meta Platforms Inc.', 'equity', 'NASDAQ', 'Technology'),
  ('TSLA', 'Tesla Inc.', 'equity', 'NASDAQ', 'Consumer Discretionary'),
  ('JPM', 'JPMorgan Chase & Co.', 'equity', 'NYSE', 'Financials'),
  ('V', 'Visa Inc.', 'equity', 'NYSE', 'Financials'),
  ('JNJ', 'Johnson & Johnson', 'equity', 'NYSE', 'Healthcare'),
  ('SPY', 'SPDR S&P 500 ETF Trust', 'etf', 'NYSE', null),
  ('QQQ', 'Invesco QQQ Trust', 'etf', 'NASDAQ', null),
  ('IWM', 'iShares Russell 2000 ETF', 'etf', 'NYSE', null),
  ('TLT', 'iShares 20+ Year Treasury Bond ETF', 'etf', 'NASDAQ', null),
  ('GLD', 'SPDR Gold Shares', 'etf', 'NYSE', null),
  ('VIX', 'CBOE Volatility Index', 'etf', 'CBOE', null)
ON CONFLICT (ticker) DO NOTHING;

-- Default strategies (Phase 2 implements these)
INSERT INTO strategies (name, family, description, parameters) VALUES
  ('Trend Following (Multi-Horizon)', 'trend', 'Time-series momentum with 1/3/12-month lookbacks and volatility scaling', '{"lookbacks": [21, 63, 252], "vol_window": 20, "vol_target": 0.15}'),
  ('Cross-Sectional Momentum', 'momentum', 'Rank by 3-12 month returns, buy winners / sell losers, skip recent month', '{"formation_months": 12, "skip_months": 1, "holding_months": 1, "top_pct": 0.2, "bottom_pct": 0.2}'),
  ('Value (Fundamental)', 'value', 'Buy cheap vs sell expensive based on valuation ratios', '{"metrics": ["pe_ratio", "pb_ratio", "ev_ebitda"], "rebalance_months": 3}'),
  ('Mean Reversion (RSI)', 'mean_reversion', 'Short-horizon reversal using RSI oversold/overbought', '{"rsi_period": 14, "oversold": 30, "overbought": 70, "holding_days": 5}'),
  ('Pairs Trading', 'pairs', 'Cointegration-based pairs with spread z-score entry/exit', '{"formation_days": 126, "entry_zscore": 2.0, "exit_zscore": 0.5, "stop_zscore": 4.0}'),
  ('Composite Signal', 'composite', 'Weighted combination of all active strategy signals', '{"weights": "inverse_volatility", "min_strategies": 2}')
ON CONFLICT (name) DO NOTHING;
```

- [ ] **Step 2: Apply seed data**

Using Supabase MCP `execute_sql` with the seed SQL.

- [ ] **Step 3: Verify data**

```sql
SELECT ticker, name, asset_class FROM instruments ORDER BY ticker;
SELECT name, family FROM strategies ORDER BY name;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat: add seed data for default instruments and strategies"
```

---

## Chunk 3: Market Data Pipeline

### Task 10: Polygon.io API client

**Files:**
- Create: `apps/engine/src/data/__init__.py`
- Create: `apps/engine/src/data/polygon_client.py`
- Test: `apps/engine/tests/unit/test_polygon_client.py`

- [ ] **Step 1: Create apps/engine/src/data/__init__.py**

Empty file.

- [ ] **Step 2: Write the failing test**

`apps/engine/tests/unit/test_polygon_client.py`:

```python
import pytest
from datetime import date
from unittest.mock import AsyncMock, patch

from src.data.polygon_client import PolygonClient, PolygonBar


class TestPolygonClient:
    def setup_method(self):
        self.client = PolygonClient(api_key="test-key")

    def test_init_requires_api_key(self):
        with pytest.raises(ValueError, match="API key"):
            PolygonClient(api_key="")

    def test_build_bars_url(self):
        url = self.client._build_bars_url(
            ticker="AAPL",
            timeframe="1d",
            start=date(2026, 1, 1),
            end=date(2026, 1, 31),
        )
        assert "AAPL" in url
        assert "2026-01-01" in url
        assert "2026-01-31" in url
        assert "day" in url

    def test_parse_bar_response(self):
        raw = {
            "results": [
                {
                    "t": 1704067200000,  # 2024-01-01 UTC ms
                    "o": 100.0,
                    "h": 105.0,
                    "l": 99.0,
                    "c": 103.0,
                    "v": 1000000,
                    "vw": 102.5,
                }
            ]
        }
        bars = self.client._parse_bars(raw)
        assert len(bars) == 1
        assert bars[0].open == 100.0
        assert bars[0].close == 103.0
        assert bars[0].volume == 1000000
        assert bars[0].vwap == 102.5

    def test_parse_empty_response(self):
        bars = self.client._parse_bars({"results": []})
        assert bars == []

    def test_parse_missing_results(self):
        bars = self.client._parse_bars({})
        assert bars == []

    def test_timeframe_mapping(self):
        assert self.client._map_timeframe("1d") == ("1", "day")
        assert self.client._map_timeframe("1h") == ("1", "hour")
        assert self.client._map_timeframe("5m") == ("5", "minute")
        with pytest.raises(ValueError):
            self.client._map_timeframe("invalid")
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd apps/engine && .venv/Scripts/python -m pytest tests/unit/test_polygon_client.py -v
```

Expected: FAIL (module not found).

- [ ] **Step 4: Implement PolygonClient**

`apps/engine/src/data/polygon_client.py`:

```python
from dataclasses import dataclass
from datetime import date, datetime, timezone
import httpx


@dataclass(frozen=True)
class PolygonBar:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int
    vwap: float | None = None


TIMEFRAME_MAP = {
    "1m": ("1", "minute"),
    "5m": ("5", "minute"),
    "15m": ("15", "minute"),
    "1h": ("1", "hour"),
    "1d": ("1", "day"),
    "1w": ("1", "week"),
}


class PolygonClient:
    """Client for the Polygon.io REST API."""

    BASE_URL = "https://api.polygon.io"

    def __init__(self, api_key: str) -> None:
        if not api_key:
            raise ValueError("API key is required for Polygon.io")
        self._api_key = api_key
        self._http = httpx.AsyncClient(
            base_url=self.BASE_URL,
            params={"apiKey": api_key},
            timeout=30.0,
        )

    def _map_timeframe(self, timeframe: str) -> tuple[str, str]:
        if timeframe not in TIMEFRAME_MAP:
            raise ValueError(
                f"Invalid timeframe '{timeframe}'. Must be one of: {list(TIMEFRAME_MAP.keys())}"
            )
        return TIMEFRAME_MAP[timeframe]

    def _build_bars_url(
        self, ticker: str, timeframe: str, start: date, end: date
    ) -> str:
        multiplier, span = self._map_timeframe(timeframe)
        return (
            f"/v2/aggs/ticker/{ticker}/range/{multiplier}/{span}"
            f"/{start.isoformat()}/{end.isoformat()}"
        )

    def _parse_bars(self, data: dict) -> list[PolygonBar]:
        results = data.get("results", [])
        bars = []
        for r in results:
            ts = datetime.fromtimestamp(r["t"] / 1000, tz=timezone.utc)
            bars.append(
                PolygonBar(
                    timestamp=ts,
                    open=float(r["o"]),
                    high=float(r["h"]),
                    low=float(r["l"]),
                    close=float(r["c"]),
                    volume=int(r["v"]),
                    vwap=float(r["vw"]) if "vw" in r else None,
                )
            )
        return bars

    async def get_bars(
        self,
        ticker: str,
        timeframe: str = "1d",
        start: date | None = None,
        end: date | None = None,
        limit: int = 5000,
    ) -> list[PolygonBar]:
        """Fetch OHLCV bars from Polygon.io."""
        if start is None:
            start = date(2020, 1, 1)
        if end is None:
            end = date.today()

        url = self._build_bars_url(ticker, timeframe, start, end)
        response = await self._http.get(url, params={"limit": limit, "adjusted": "true"})
        response.raise_for_status()
        return self._parse_bars(response.json())

    async def get_latest_price(self, ticker: str) -> PolygonBar | None:
        """Fetch the most recent daily bar."""
        response = await self._http.get(f"/v2/aggs/ticker/{ticker}/prev")
        response.raise_for_status()
        bars = self._parse_bars(response.json())
        return bars[0] if bars else None

    async def close(self) -> None:
        await self._http.aclose()
```

- [ ] **Step 5: Run tests**

```bash
.venv/Scripts/python -m pytest tests/unit/test_polygon_client.py -v
```

Expected: All 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/engine/src/data/ apps/engine/tests/unit/test_polygon_client.py
git commit -m "feat: add Polygon.io API client with bar fetching and parsing"
```

---

### Task 11: Data ingestion orchestrator

**Files:**
- Create: `apps/engine/src/data/ingestion.py`
- Test: `apps/engine/tests/unit/test_ingestion.py`

- [ ] **Step 1: Write the failing test**

`apps/engine/tests/unit/test_ingestion.py`:

```python
import pytest
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from src.data.ingestion import DataIngestionService
from src.data.polygon_client import PolygonBar


@pytest.fixture
def mock_polygon():
    return AsyncMock()


@pytest.fixture
def mock_supabase():
    mock = MagicMock()
    mock.table.return_value.upsert.return_value.execute.return_value = MagicMock(data=[])
    mock.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"id": "inst-1", "ticker": "AAPL"}]
    )
    return mock


@pytest.fixture
def service(mock_polygon, mock_supabase):
    return DataIngestionService(polygon=mock_polygon, db=mock_supabase)


class TestDataIngestionService:
    async def test_ingest_ticker_fetches_and_stores(self, service, mock_polygon):
        mock_polygon.get_bars.return_value = [
            PolygonBar(
                timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc),
                open=100, high=105, low=99, close=103, volume=1000000, vwap=102.5,
            )
        ]
        result = await service.ingest_ticker("AAPL", timeframe="1d")
        assert result.ingested == 1
        assert result.errors == []
        mock_polygon.get_bars.assert_called_once()

    async def test_ingest_ticker_handles_empty_data(self, service, mock_polygon):
        mock_polygon.get_bars.return_value = []
        result = await service.ingest_ticker("AAPL")
        assert result.ingested == 0

    async def test_ingest_ticker_handles_api_error(self, service, mock_polygon):
        mock_polygon.get_bars.side_effect = Exception("API rate limit")
        result = await service.ingest_ticker("AAPL")
        assert result.ingested == 0
        assert len(result.errors) == 1
        assert "API rate limit" in result.errors[0]

    async def test_ingest_batch(self, service, mock_polygon):
        mock_polygon.get_bars.return_value = [
            PolygonBar(
                timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc),
                open=100, high=105, low=99, close=103, volume=1000000,
            )
        ]
        result = await service.ingest_batch(["AAPL", "MSFT"])
        assert result.ingested == 2
        assert mock_polygon.get_bars.call_count == 2
```

- [ ] **Step 2: Run test to verify it fails**

```bash
.venv/Scripts/python -m pytest tests/unit/test_ingestion.py -v
```

Expected: FAIL.

- [ ] **Step 3: Implement DataIngestionService**

`apps/engine/src/data/ingestion.py`:

```python
from dataclasses import dataclass, field
from datetime import date
import logging

from supabase import Client

from src.data.polygon_client import PolygonClient, PolygonBar

logger = logging.getLogger(__name__)


@dataclass
class IngestionResult:
    ingested: int = 0
    errors: list[str] = field(default_factory=list)


class DataIngestionService:
    """Orchestrates market data ingestion from Polygon.io into Supabase."""

    def __init__(self, polygon: PolygonClient, db: Client) -> None:
        self._polygon = polygon
        self._db = db

    def _resolve_instrument_id(self, ticker: str) -> str | None:
        """Look up instrument UUID by ticker."""
        result = (
            self._db.table("instruments")
            .select("id")
            .eq("ticker", ticker)
            .execute()
        )
        if result.data:
            return result.data[0]["id"]
        return None

    def _bars_to_rows(
        self, bars: list[PolygonBar], instrument_id: str, timeframe: str, source: str = "polygon"
    ) -> list[dict]:
        return [
            {
                "instrument_id": instrument_id,
                "timestamp": bar.timestamp.isoformat(),
                "timeframe": timeframe,
                "open": bar.open,
                "high": bar.high,
                "low": bar.low,
                "close": bar.close,
                "volume": bar.volume,
                "vwap": bar.vwap,
                "adjusted_close": bar.close,
                "source": source,
            }
            for bar in bars
        ]

    async def ingest_ticker(
        self,
        ticker: str,
        timeframe: str = "1d",
        start: date | None = None,
        end: date | None = None,
    ) -> IngestionResult:
        """Ingest market data for a single ticker."""
        result = IngestionResult()

        try:
            instrument_id = self._resolve_instrument_id(ticker)
            if not instrument_id:
                result.errors.append(f"Instrument not found: {ticker}")
                return result

            bars = await self._polygon.get_bars(
                ticker=ticker, timeframe=timeframe, start=start, end=end
            )

            if not bars:
                return result

            rows = self._bars_to_rows(bars, instrument_id, timeframe)

            self._db.table("market_data").upsert(
                rows,
                on_conflict="instrument_id,timestamp,timeframe",
            ).execute()

            result.ingested = len(rows)
            logger.info(f"Ingested {len(rows)} bars for {ticker} ({timeframe})")

        except Exception as e:
            error_msg = f"Failed to ingest {ticker}: {e}"
            result.errors.append(error_msg)
            logger.error(error_msg)

        return result

    async def ingest_batch(
        self,
        tickers: list[str],
        timeframe: str = "1d",
        start: date | None = None,
        end: date | None = None,
    ) -> IngestionResult:
        """Ingest market data for multiple tickers."""
        combined = IngestionResult()

        for ticker in tickers:
            ticker_result = await self.ingest_ticker(ticker, timeframe, start, end)
            combined.ingested += ticker_result.ingested
            combined.errors.extend(ticker_result.errors)

        return combined
```

- [ ] **Step 4: Run tests**

```bash
.venv/Scripts/python -m pytest tests/unit/test_ingestion.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/engine/src/data/ingestion.py apps/engine/tests/unit/test_ingestion.py
git commit -m "feat: add data ingestion service with batch support and error handling"
```

---

### Task 12: Data API routes

**Files:**
- Create: `apps/engine/src/api/routes/data.py`
- Modify: `apps/engine/src/api/main.py`
- Test: `apps/engine/tests/unit/test_data_routes.py`

- [ ] **Step 1: Write the failing test**

`apps/engine/tests/unit/test_data_routes.py`:

```python
from unittest.mock import AsyncMock, patch, MagicMock

from src.data.ingestion import IngestionResult


def test_health_ok(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200


@patch("src.api.routes.data.get_ingestion_service")
def test_ingest_endpoint(mock_get_service, client):
    mock_service = AsyncMock()
    mock_service.ingest_batch.return_value = IngestionResult(ingested=10, errors=[])
    mock_get_service.return_value = mock_service

    r = client.post("/api/v1/data/ingest", json={"tickers": ["AAPL", "MSFT"], "timeframe": "1d"})
    assert r.status_code == 200
    data = r.json()
    assert data["ingested"] == 10
    assert data["errors"] == []


@patch("src.api.routes.data.get_ingestion_service")
def test_ingest_validates_tickers(mock_get_service, client):
    r = client.post("/api/v1/data/ingest", json={"tickers": [], "timeframe": "1d"})
    assert r.status_code == 422  # Validation error: empty tickers
```

- [ ] **Step 2: Implement the data routes**

`apps/engine/src/api/routes/data.py`:

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.config import settings
from src.data.polygon_client import PolygonClient
from src.data.ingestion import DataIngestionService
from src.db import get_supabase_client

router = APIRouter(prefix="/data", tags=["data"])


class IngestRequest(BaseModel):
    tickers: list[str] = Field(..., min_length=1)
    timeframe: str = "1d"
    start_date: str | None = None
    end_date: str | None = None


class IngestResponse(BaseModel):
    ingested: int
    errors: list[str]


def get_ingestion_service() -> DataIngestionService:
    polygon = PolygonClient(api_key=settings.polygon_api_key)
    db = get_supabase_client()
    return DataIngestionService(polygon=polygon, db=db)


@router.post("/ingest", response_model=IngestResponse)
async def ingest_data(request: IngestRequest) -> IngestResponse:
    """Trigger data ingestion for specified tickers."""
    service = get_ingestion_service()
    result = await service.ingest_batch(
        tickers=request.tickers,
        timeframe=request.timeframe,
    )
    return IngestResponse(ingested=result.ingested, errors=result.errors)
```

- [ ] **Step 3: Register the route in main.py**

Add to `apps/engine/src/api/main.py`:

```python
from src.api.routes import health, data

# After existing health router:
app.include_router(data.router, prefix="/api/v1")
```

- [ ] **Step 4: Run tests**

```bash
.venv/Scripts/python -m pytest tests/unit/test_data_routes.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/engine/src/api/ apps/engine/tests/unit/test_data_routes.py
git commit -m "feat: add data ingestion API endpoint with validation"
```

---

## Chunk 4: Paper Broker & Portfolio

### Task 13: Broker interface and paper broker

**Files:**
- Create: `apps/engine/src/execution/__init__.py`
- Create: `apps/engine/src/execution/broker_interface.py`
- Create: `apps/engine/src/execution/paper_broker.py`
- Test: `apps/engine/tests/unit/test_paper_broker.py`

- [ ] **Step 1: Create apps/engine/src/execution/__init__.py**

Empty file.

- [ ] **Step 2: Write the failing test**

`apps/engine/tests/unit/test_paper_broker.py`:

```python
import pytest
from src.execution.broker_interface import OrderRequest
from src.execution.paper_broker import PaperBroker


class TestPaperBroker:
    def setup_method(self):
        self.broker = PaperBroker(initial_capital=100_000.0)

    async def test_initial_state(self):
        account = await self.broker.get_account()
        assert account["cash"] == 100_000.0
        assert account["equity"] == 100_000.0

    async def test_submit_market_buy_order(self):
        order = OrderRequest(
            instrument_id="inst-1",
            side="buy",
            order_type="market",
            quantity=100,
        )
        result = await self.broker.submit_order(order, current_price=150.0)
        assert result.status == "filled"
        assert result.fill_price is not None
        assert result.fill_quantity == 100
        assert result.slippage is not None

    async def test_buy_reduces_cash(self):
        order = OrderRequest(
            instrument_id="inst-1",
            side="buy",
            order_type="market",
            quantity=10,
        )
        await self.broker.submit_order(order, current_price=100.0)
        account = await self.broker.get_account()
        # Cash reduced by ~10 * 100 + slippage + commission
        assert account["cash"] < 100_000.0

    async def test_get_positions(self):
        order = OrderRequest(
            instrument_id="inst-1",
            side="buy",
            order_type="market",
            quantity=50,
        )
        await self.broker.submit_order(order, current_price=200.0)
        positions = await self.broker.get_positions()
        assert len(positions) == 1
        assert positions[0]["instrument_id"] == "inst-1"
        assert positions[0]["quantity"] == 50

    async def test_sell_closes_position(self):
        buy = OrderRequest(instrument_id="inst-1", side="buy", order_type="market", quantity=50)
        await self.broker.submit_order(buy, current_price=100.0)

        sell = OrderRequest(instrument_id="inst-1", side="sell", order_type="market", quantity=50)
        await self.broker.submit_order(sell, current_price=110.0)

        positions = await self.broker.get_positions()
        assert len(positions) == 0

    async def test_insufficient_cash_rejected(self):
        order = OrderRequest(
            instrument_id="inst-1",
            side="buy",
            order_type="market",
            quantity=100_000,
        )
        result = await self.broker.submit_order(order, current_price=100.0)
        assert result.status == "rejected"

    async def test_cancel_nonexistent_order(self):
        with pytest.raises(ValueError, match="not found"):
            await self.broker.cancel_order("nonexistent-id")

    async def test_slippage_model_applies(self):
        order = OrderRequest(
            instrument_id="inst-1",
            side="buy",
            order_type="market",
            quantity=100,
        )
        result = await self.broker.submit_order(order, current_price=100.0)
        # Market buy should fill slightly above the price (slippage)
        assert result.fill_price >= 100.0
```

- [ ] **Step 3: Run test to verify it fails**

```bash
.venv/Scripts/python -m pytest tests/unit/test_paper_broker.py -v
```

Expected: FAIL.

- [ ] **Step 4: Implement broker interface**

`apps/engine/src/execution/broker_interface.py`:

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class OrderRequest:
    instrument_id: str
    side: str  # "buy" | "sell"
    order_type: str  # "market" | "limit" | "stop" | "stop_limit"
    quantity: float
    limit_price: float | None = None
    stop_price: float | None = None


@dataclass(frozen=True)
class OrderResult:
    order_id: str
    status: str  # "filled" | "rejected" | "cancelled" | "pending"
    fill_price: float | None = None
    fill_quantity: float | None = None
    commission: float = 0.0
    slippage: float | None = None


class BrokerAdapter(ABC):
    @abstractmethod
    async def submit_order(self, order: OrderRequest, **kwargs) -> OrderResult: ...

    @abstractmethod
    async def cancel_order(self, order_id: str) -> None: ...

    @abstractmethod
    async def get_positions(self) -> list[dict]: ...

    @abstractmethod
    async def get_account(self) -> dict: ...
```

- [ ] **Step 5: Implement paper broker**

`apps/engine/src/execution/paper_broker.py`:

```python
import uuid
import random
from dataclasses import dataclass, field

from src.execution.broker_interface import BrokerAdapter, OrderRequest, OrderResult


@dataclass
class _Position:
    instrument_id: str
    quantity: float
    avg_entry_price: float
    side: str  # "long" | "short"


class PaperBroker(BrokerAdapter):
    """Simulated broker for paper trading with realistic slippage model."""

    def __init__(
        self,
        initial_capital: float = 100_000.0,
        slippage_bps: float = 5.0,
        commission_per_share: float = 0.0,
    ) -> None:
        self._cash = initial_capital
        self._initial_capital = initial_capital
        self._positions: dict[str, _Position] = {}
        self._orders: dict[str, OrderResult] = {}
        self._slippage_bps = slippage_bps
        self._commission_per_share = commission_per_share

    def _simulate_fill_price(self, price: float, side: str) -> tuple[float, float]:
        """Simulate fill with slippage. Returns (fill_price, slippage)."""
        # Random slippage between 0 and slippage_bps
        slip_pct = random.uniform(0, self._slippage_bps) / 10_000
        if side == "buy":
            fill = price * (1 + slip_pct)
        else:
            fill = price * (1 - slip_pct)
        slippage = abs(fill - price) * 1  # per share
        return round(fill, 4), round(slippage, 4)

    async def submit_order(self, order: OrderRequest, **kwargs) -> OrderResult:
        current_price = kwargs.get("current_price")
        if current_price is None:
            raise ValueError("PaperBroker requires current_price kwarg")

        order_id = str(uuid.uuid4())

        if order.order_type != "market":
            # For Phase 1, only market orders are supported
            result = OrderResult(order_id=order_id, status="rejected")
            self._orders[order_id] = result
            return result

        fill_price, slippage = self._simulate_fill_price(current_price, order.side)
        commission = self._commission_per_share * order.quantity
        total_cost = fill_price * order.quantity + commission

        if order.side == "buy":
            if total_cost > self._cash:
                result = OrderResult(order_id=order_id, status="rejected")
                self._orders[order_id] = result
                return result

            self._cash -= total_cost

            if order.instrument_id in self._positions:
                pos = self._positions[order.instrument_id]
                total_qty = pos.quantity + order.quantity
                pos.avg_entry_price = (
                    (pos.avg_entry_price * pos.quantity + fill_price * order.quantity) / total_qty
                )
                pos.quantity = total_qty
            else:
                self._positions[order.instrument_id] = _Position(
                    instrument_id=order.instrument_id,
                    quantity=order.quantity,
                    avg_entry_price=fill_price,
                    side="long",
                )

        elif order.side == "sell":
            if order.instrument_id in self._positions:
                pos = self._positions[order.instrument_id]
                pos.quantity -= order.quantity
                self._cash += fill_price * order.quantity - commission
                if pos.quantity <= 0:
                    del self._positions[order.instrument_id]
            else:
                # Short selling
                self._positions[order.instrument_id] = _Position(
                    instrument_id=order.instrument_id,
                    quantity=order.quantity,
                    avg_entry_price=fill_price,
                    side="short",
                )
                self._cash += fill_price * order.quantity - commission

        result = OrderResult(
            order_id=order_id,
            status="filled",
            fill_price=fill_price,
            fill_quantity=order.quantity,
            commission=commission,
            slippage=slippage,
        )
        self._orders[order_id] = result
        return result

    async def cancel_order(self, order_id: str) -> None:
        if order_id not in self._orders:
            raise ValueError(f"Order {order_id} not found")
        # Paper orders fill instantly, so cancellation is only for pending (future limit orders)

    async def get_positions(self) -> list[dict]:
        return [
            {
                "instrument_id": pos.instrument_id,
                "quantity": pos.quantity,
                "avg_entry_price": pos.avg_entry_price,
                "side": pos.side,
            }
            for pos in self._positions.values()
        ]

    async def get_account(self) -> dict:
        positions_value = sum(
            pos.quantity * pos.avg_entry_price for pos in self._positions.values()
        )
        return {
            "cash": round(self._cash, 2),
            "positions_value": round(positions_value, 2),
            "equity": round(self._cash + positions_value, 2),
            "initial_capital": self._initial_capital,
        }
```

- [ ] **Step 6: Run tests**

```bash
.venv/Scripts/python -m pytest tests/unit/test_paper_broker.py -v
```

Expected: All 9 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/engine/src/execution/ apps/engine/tests/unit/test_paper_broker.py
git commit -m "feat: add broker interface and paper trading engine with slippage model"
```

---

### Task 14: Portfolio API routes

**Files:**
- Create: `apps/engine/src/api/routes/portfolio.py`
- Modify: `apps/engine/src/api/main.py`

- [ ] **Step 1: Create portfolio routes**

`apps/engine/src/api/routes/portfolio.py`:

```python
from fastapi import APIRouter

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/{account_id}")
async def get_portfolio(account_id: str) -> dict:
    """Get current portfolio state for an account. Placeholder for Phase 3."""
    return {
        "account_id": account_id,
        "positions": [],
        "cash": 100_000.0,
        "equity": 100_000.0,
        "message": "Full implementation in Phase 3",
    }
```

- [ ] **Step 2: Register in main.py**

```python
from src.api.routes import health, data, portfolio

app.include_router(portfolio.router, prefix="/api/v1")
```

- [ ] **Step 3: Test**

```bash
.venv/Scripts/python -m pytest tests/ -v
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/engine/src/api/
git commit -m "feat: add portfolio API route placeholder"
```

---

## Chunk 5: Web Dashboard Foundation

### Task 15: Supabase client setup

**Files:**
- Create: `apps/web/src/lib/supabase/client.ts`
- Create: `apps/web/src/lib/supabase/server.ts`

- [ ] **Step 1: Install Supabase client**

```bash
cd apps/web && pnpm add @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Create browser client**

`apps/web/src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Create server client**

`apps/web/src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/supabase/
git commit -m "feat: add Supabase client setup for browser and server"
```

---

### Task 16: Engine API client

**Files:**
- Create: `apps/web/src/lib/engine-client.ts`
- Test: `apps/web/tests/unit/engine-client.test.ts`

- [ ] **Step 1: Write failing test**

`apps/web/tests/unit/engine-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EngineClient } from '@/lib/engine-client';

describe('EngineClient', () => {
  let client: EngineClient;

  beforeEach(() => {
    client = new EngineClient('http://localhost:8000', 'test-key');
  });

  it('constructs correct base URL', () => {
    expect(client.baseUrl).toBe('http://localhost:8000');
  });

  it('builds correct headers', () => {
    const headers = client.getHeaders();
    expect(headers['Authorization']).toBe('Bearer test-key');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('builds correct endpoint URLs', () => {
    expect(client.url('/data/ingest')).toBe('http://localhost:8000/api/v1/data/ingest');
  });
});
```

- [ ] **Step 2: Implement engine client**

`apps/web/src/lib/engine-client.ts`:

```typescript
import type { IngestResult, LatestPrices, OHLCV, EngineResponse } from '@sentinel/shared';

export class EngineClient {
  readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  url(path: string): string {
    return `${this.baseUrl}/api/v1${path}`;
  }

  async ingestData(tickers: string[], timeframe = '1d'): Promise<IngestResult> {
    const res = await fetch(this.url('/data/ingest'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ tickers, timeframe }),
    });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async getHealth(): Promise<{ status: string }> {
    const res = await fetch(this.url('/health'), { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }
}

export function getEngineClient(): EngineClient {
  return new EngineClient(
    process.env.ENGINE_URL || 'http://localhost:8000',
    process.env.ENGINE_API_KEY || 'sentinel-dev-key',
  );
}
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && pnpm test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/engine-client.ts apps/web/tests/unit/engine-client.test.ts
git commit -m "feat: add typed engine API client with tests"
```

---

### Task 17: Dashboard layout (sidebar + header)

**Files:**
- Create: `apps/web/src/components/layout/sidebar.tsx`
- Create: `apps/web/src/components/layout/header.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Install dependencies**

```bash
cd apps/web && pnpm add lucide-react zustand
```

- [ ] **Step 2: Update globals.css for dark theme**

`apps/web/src/app/globals.css`:

Set up Tailwind with a dark-first trading terminal aesthetic. Use dark background colors (slate-950/zinc-950), with accent colors for buy/sell (green/red), signals, and metrics.

- [ ] **Step 3: Create sidebar component**

`apps/web/src/components/layout/sidebar.tsx`:

Navigation sidebar with links to: Dashboard (/), Markets (/markets), Strategies (/strategies), Signals (/signals), Portfolio (/portfolio), Backtest (/backtest), Agents (/agents), Settings (/settings). Use lucide-react icons. Collapsible. Active route highlighting.

- [ ] **Step 4: Create header component**

`apps/web/src/components/layout/header.tsx`:

Top bar showing: "Sentinel" branding, connection status indicator (green dot when Supabase connected), current time (ET market time), market status (Open/Closed based on time).

- [ ] **Step 5: Update root layout**

`apps/web/src/app/layout.tsx`:

Wrap children with sidebar + header layout. Dark theme via `className="dark"` on html element. Add Sonner toast provider.

- [ ] **Step 6: Verify dev server renders**

```bash
cd apps/web && pnpm dev
```

Open http://localhost:3000 and confirm sidebar + header render.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/
git commit -m "feat: add dashboard layout with sidebar navigation and header"
```

---

### Task 18: Dashboard command center page

**Files:**
- Create: `apps/web/src/components/dashboard/metric-card.tsx`
- Create: `apps/web/src/components/dashboard/alert-feed.tsx`
- Create: `apps/web/src/components/dashboard/price-ticker.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Test: `apps/web/tests/components/metric-card.test.tsx`

- [ ] **Step 1: Write failing test for MetricCard**

`apps/web/tests/components/metric-card.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '@/components/dashboard/metric-card';

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard label="Total Equity" value="$100,000" />);
    expect(screen.getByText('Total Equity')).toBeInTheDocument();
    expect(screen.getByText('$100,000')).toBeInTheDocument();
  });

  it('renders positive change with green indicator', () => {
    render(<MetricCard label="Daily P&L" value="$1,250" change={1.25} />);
    expect(screen.getByText('+1.25%')).toBeInTheDocument();
  });

  it('renders negative change with red indicator', () => {
    render(<MetricCard label="Daily P&L" value="-$500" change={-0.5} />);
    expect(screen.getByText('-0.50%')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement MetricCard**

`apps/web/src/components/dashboard/metric-card.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string;
  change?: number;
  icon?: React.ReactNode;
}

export function MetricCard({ label, value, change, icon }: MetricCardProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-zinc-400">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-zinc-100">{value}</div>
        {change !== undefined && (
          <p className={cn(
            'text-xs mt-1',
            change >= 0 ? 'text-emerald-500' : 'text-red-500',
          )}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Run test**

```bash
cd apps/web && pnpm test
```

Expected: MetricCard tests PASS.

- [ ] **Step 4: Implement AlertFeed and PriceTicker components**

`alert-feed.tsx`: Scrollable list of recent alerts with severity badges (info=blue, warning=yellow, critical=red) and timestamps.

`price-ticker.tsx`: Horizontal scrolling ticker showing instrument prices with green/red based on daily change direction.

- [ ] **Step 5: Build the command center page**

`apps/web/src/app/page.tsx`:

Grid layout with:
- Row 1: 4 MetricCards (Total Equity, Daily P&L, Sharpe Ratio, Max Drawdown) -- using placeholder values for now
- Row 2: PriceTicker spanning full width
- Row 3: Left column = "Active Signals" placeholder card, Right column = AlertFeed

- [ ] **Step 6: Verify in browser**

```bash
pnpm dev
```

Expected: Dashboard renders with metric cards, price ticker, and alert feed.

- [ ] **Step 7: Commit**

```bash
git add apps/web/
git commit -m "feat: add command center dashboard with metric cards, price ticker, and alert feed"
```

---

### Task 19: Markets page with TradingView chart

**Files:**
- Create: `apps/web/src/components/charts/price-chart.tsx`
- Create: `apps/web/src/app/markets/page.tsx`
- Create: `apps/web/src/hooks/use-market-data.ts`

- [ ] **Step 1: Install TradingView Lightweight Charts**

```bash
cd apps/web && pnpm add lightweight-charts
```

- [ ] **Step 2: Create PriceChart component**

`apps/web/src/components/charts/price-chart.tsx`:

A React wrapper around TradingView's `createChart` API. Takes OHLCV data as props and renders a candlestick chart with volume overlay. Dark theme styling to match the dashboard. Handles resize via ResizeObserver. Cleans up chart instance on unmount.

- [ ] **Step 3: Create market data hook**

`apps/web/src/hooks/use-market-data.ts`:

Custom hook that:
- Accepts a ticker string
- Fetches price data from Supabase `market_data` table
- Subscribes to Supabase Realtime for live updates to that instrument
- Returns `{ data, isLoading, error }`

- [ ] **Step 4: Create Markets page**

`apps/web/src/app/markets/page.tsx`:

Layout:
- Left panel: Watchlist (list of instruments from Supabase, clickable)
- Right panel: PriceChart for selected instrument
- Clicking a watchlist item loads its data into the chart

Use placeholder/mock data if Supabase isn't connected.

- [ ] **Step 5: Verify in browser**

Expected: Markets page renders with watchlist and chart.

- [ ] **Step 6: Commit**

```bash
git add apps/web/
git commit -m "feat: add markets page with TradingView chart and watchlist"
```

---

### Task 20: Realtime subscription hook

**Files:**
- Create: `apps/web/src/hooks/use-realtime.ts`
- Test: `apps/web/tests/unit/use-realtime.test.ts`

- [ ] **Step 1: Write failing test**

`apps/web/tests/unit/use-realtime.test.ts`:

Test that the hook subscribes to a Supabase channel on mount and unsubscribes on unmount (using mocked Supabase client).

- [ ] **Step 2: Implement useRealtime hook**

`apps/web/src/hooks/use-realtime.ts`:

```typescript
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export function useRealtime<T extends Record<string, unknown>>(
  table: string,
  filter?: string,
) {
  const [data, setData] = useState<T[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          if (payload.eventType === 'INSERT') {
            setData((prev) => [payload.new as T, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setData((prev) =>
              prev.map((item) =>
                (item as any).id === (payload.new as any).id
                  ? (payload.new as T)
                  : item,
              ),
            );
          } else if (payload.eventType === 'DELETE') {
            setData((prev) =>
              prev.filter((item) => (item as any).id !== (payload.old as any).id),
            );
          }
        },
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter]);

  return { data, isConnected };
}
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/ apps/web/tests/
git commit -m "feat: add Supabase Realtime subscription hook"
```

---

### Task 21: Zustand app store

**Files:**
- Create: `apps/web/src/stores/app-store.ts`
- Test: `apps/web/tests/unit/stores.test.ts`

- [ ] **Step 1: Write failing test**

`apps/web/tests/unit/stores.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/stores/app-store';

describe('AppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      selectedTicker: null,
      sidebarOpen: true,
      marketStatus: 'closed',
    });
  });

  it('selects a ticker', () => {
    useAppStore.getState().setSelectedTicker('AAPL');
    expect(useAppStore.getState().selectedTicker).toBe('AAPL');
  });

  it('toggles sidebar', () => {
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarOpen).toBe(false);
  });

  it('sets market status', () => {
    useAppStore.getState().setMarketStatus('open');
    expect(useAppStore.getState().marketStatus).toBe('open');
  });
});
```

- [ ] **Step 2: Implement store**

`apps/web/src/stores/app-store.ts`:

```typescript
import { create } from 'zustand';

interface AppState {
  selectedTicker: string | null;
  sidebarOpen: boolean;
  marketStatus: 'open' | 'closed' | 'pre' | 'post';
  setSelectedTicker: (ticker: string | null) => void;
  toggleSidebar: () => void;
  setMarketStatus: (status: AppState['marketStatus']) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedTicker: null,
  sidebarOpen: true,
  marketStatus: 'closed',
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setMarketStatus: (status) => set({ marketStatus: status }),
}));
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && pnpm test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/stores/ apps/web/tests/unit/stores.test.ts
git commit -m "feat: add Zustand app store with tests"
```

---

## Chunk 6: Integration & CI

### Task 22: Run full test suite

- [ ] **Step 1: Run all engine tests**

```bash
cd apps/engine && .venv/Scripts/python -m pytest --cov=src --cov-report=term-missing -v
```

Expected: All tests pass, coverage > 80%.

- [ ] **Step 2: Run all web tests**

```bash
cd apps/web && pnpm test
```

Expected: All tests pass.

- [ ] **Step 3: Build web app**

```bash
cd apps/web && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 4: Type-check shared package**

```bash
cd packages/shared && npx tsc --noEmit
```

Expected: No errors.

---

### Task 23: Create launch.json and final commit

- [ ] **Step 1: Verify .claude/launch.json exists with all 3 servers**

- [ ] **Step 2: Run turbo dev to verify all servers start**

```bash
pnpm dev
```

- [ ] **Step 3: Final commit for Phase 1**

```bash
git add -A
git commit -m "feat: complete Phase 1 Foundation - monorepo, database, data pipeline, dashboard, paper broker"
```

---

## Summary

Phase 1 delivers:
- **Monorepo** with pnpm workspaces + Turborepo
- **Database** with 15+ tables, RLS, indexes, seed data
- **Engine** with Polygon.io client, data ingestion, paper broker, health/data/portfolio API routes
- **Dashboard** with sidebar, command center, markets page with TradingView charts, realtime hooks
- **Shared types** package with all DB row types
- **Tests** for all engine modules and web components
- **Dev server configs** in `.claude/launch.json`

Next: Phase 2 (Strategy Engine) builds on this foundation to implement the 5 strategy families and signal generation pipeline.
