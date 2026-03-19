# Sentinel Deployment Readiness Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Sentinel Trading Platform from a well-engineered development codebase into a production-ready system by closing security, documentation, observability, and reliability gaps.

**Architecture:** The platform is a pnpm monorepo with three apps (Next.js 15 web, Python FastAPI engine, TypeScript Express agents) backed by Supabase PostgreSQL. Work is organized into five sequential phases — Security must complete first (CRITICAL), then Documentation, Observability, API Hardening, and finally a CI/CD deployment pipeline.

**Tech Stack:** Next.js 15, FastAPI 0.115, Express 4, Supabase, Turborepo, pnpm v10, Docker, GitHub Actions, Vercel, Python 3.14, TypeScript 5

---

## PHASE 0 — Fix Existing Connection Failures (DO FIRST)

> These are existing bugs in the repo that will break Docker builds and CI right now. Fix before anything else.

---

### Task 0: Fix pnpm Version Mismatch Across Dockerfiles and CI

**Context:** `package.json` pins `"packageManager": "pnpm@10.32.1"`. Both `apps/web/Dockerfile` and `apps/agents/Dockerfile` install `pnpm@9` — a different major version. pnpm enforces the `packageManager` field, so `pnpm install --frozen-lockfile` inside the container will fail with a version mismatch error. CI (`npm install -g pnpm` without a version) is also unpinned. Additionally, `lint-staged` in the root `package.json` references `apps/engine/.venv/Scripts/ruff.exe`, a Windows-only path that breaks any non-Windows developer and should be replaced with the cross-platform `uv run ruff`.

**Files:**

- Modify: `apps/web/Dockerfile`
- Modify: `apps/agents/Dockerfile`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json` (lint-staged ruff command)

- [ ] **Step 1: Fix pnpm version in web Dockerfile**

Open `apps/web/Dockerfile`. Change line 5:

```dockerfile
# BEFORE:
RUN npm install --global pnpm@9

# AFTER:
RUN npm install --global pnpm@10.32.1
```

- [ ] **Step 2: Fix pnpm version in agents Dockerfile**

Open `apps/agents/Dockerfile`. Change line 5:

```dockerfile
# BEFORE:
RUN npm install --global pnpm@9

# AFTER:
RUN npm install --global pnpm@10.32.1
```

- [ ] **Step 3: Pin pnpm version in CI**

Open `.github/workflows/ci.yml`. In both `test-web` and `test-agents` jobs, replace:

```yaml
- name: Install pnpm
  run: npm install -g pnpm
```

With:

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 10.32.1
```

Remove the manual `Get pnpm store path` and `Cache pnpm store` steps from both jobs — `pnpm/action-setup@v4` handles cache automatically when combined with `actions/setup-node@v4`'s `cache: 'pnpm'`.

The resulting steps for both `test-web` and `test-agents` should be:

```yaml
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v4
  with:
    version: 10.32.1
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: 'pnpm'
- run: pnpm install --frozen-lockfile
```

- [ ] **Step 4: Fix lint-staged ruff command (Windows-only path)**

Open `package.json`. In the `lint-staged` section, replace:

```json
"*.py": [
  "apps/engine/.venv/Scripts/ruff.exe check --fix --exit-zero",
  "apps/engine/.venv/Scripts/ruff.exe format"
]
```

With:

```json
"*.py": [
  "uv run --directory apps/engine ruff check --fix --exit-zero",
  "uv run --directory apps/engine ruff format"
]
```

This uses `uv run` which resolves to the venv-installed ruff cross-platform (Windows, Mac, Linux).

- [ ] **Step 5: Verify Docker builds locally**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App"
docker compose build --no-cache engine
docker compose build --no-cache agents
docker compose build --no-cache web
```

Expected: All three images build without errors.

- [ ] **Step 6: Verify CI locally with act (optional but recommended)**

```bash
act push --job test-web --dry-run
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/Dockerfile apps/agents/Dockerfile .github/workflows/ci.yml package.json
git commit -m "fix: align pnpm version to 10.32.1 in Dockerfiles and CI, fix cross-platform ruff path"
```

---

## PHASE 1 — Security (CRITICAL BLOCKERS)

> These tasks block ALL other work. Do not proceed to Phase 2 until all tasks here are complete.

---

### Task 1: Rotate All Exposed Credentials

**Context:** The `.env` file contains real production credentials. Even if `.gitignore` now covers it, git history must be inspected and all exposed keys rotated at their source.

**Files:**

- Modify: `.env.example` (verify all keys are documented)
- Verify: `.gitignore` (confirm `.env` is listed)
- External action: Rotate keys in Supabase, Polygon, Anthropic, Alpaca dashboards

- [ ] **Step 1: Check if `.env` was ever committed to git**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App"
git log --all --full-history -- .env
git log --all --full-history -- "**/.env"
```

Expected: If any commits are listed, `.env` was committed and history contains live secrets.

- [ ] **Step 2: Rotate Supabase service role key**

Go to Supabase dashboard → Project Settings → API → Rotate `service_role` key.
Update `.env` with new key (do NOT commit).

- [ ] **Step 3: Rotate Polygon API key**

Go to https://polygon.io → Account → API Keys → Revoke existing → Create new.
Update `.env`.

- [ ] **Step 4: Rotate Anthropic API key**

Go to https://console.anthropic.com → API Keys → Revoke exposed key → Create new.
Update `.env`.

- [ ] **Step 5: Rotate Alpaca API key pair**

Go to https://app.alpaca.markets → API Keys → Delete exposed pair → Generate new.
Update `.env`.

- [ ] **Step 6: If `.env` was in git history — purge it**

```bash
# Install git-filter-repo if not present
pip install git-filter-repo

cd "C:\Users\steve\Projects\personal\Stock Trading App"
git filter-repo --path .env --invert-paths --force
git push origin --force --all
git push origin --force --tags
```

Expected: `.env` removed from all history. Force-push required (confirm with GitHub repo owner).

- [ ] **Step 7: Verify `.gitignore` covers `.env`**

Open `.gitignore` and confirm these lines exist:

```
.env
.env.local
.env.*.local
```

If missing, add them:

```bash
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

- [ ] **Step 8: Commit the .gitignore fix if needed**

```bash
git add .gitignore
git commit -m "fix: ensure .env files are excluded from git"
```

---

### Task 2: Add Secrets Scanning to CI

**Context:** Prevent future accidental secret commits by adding automated scanning on every PR.

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add Gitleaks secrets scanning job**

Open `.github/workflows/ci.yml` and add this job alongside the existing three:

```yaml
secrets-scan:
  name: Secrets Scan
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: gitleaks/gitleaks-action@v2
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add Gitleaks secrets scanning to CI pipeline"
```

- [ ] **Step 3: Push and verify job passes**

```bash
git push
```

Go to GitHub Actions → confirm `secrets-scan` job passes.

---

### Task 3: Add Rate Limiting to FastAPI Engine

**Context:** The engine has no per-IP or per-key rate limiting, making it vulnerable to abuse and accidental Polygon API quota exhaustion from hammering `/ingest` or `/generate-signals`.

**Files:**

- Modify: `apps/engine/pyproject.toml` (add `slowapi`)
- Create: `apps/engine/src/api/limiter.py` (shared limiter instance — avoids circular imports)
- Modify: `apps/engine/src/api/main.py`
- Modify: `apps/engine/src/api/routes/data.py`
- Modify: `apps/engine/src/api/routes/strategies.py`
- Create: `apps/engine/tests/unit/test_rate_limiting.py`

**Note on actual routes (read from source):**

- Signal scan: `POST /api/v1/strategies/scan` (function: `scan_signals`, body: `ScanRequest`)
- Data ingest: `POST /api/v1/data/ingest` (function: `ingest_data`, body: `IngestRequest`)

- [ ] **Step 1: Write the failing test**

Create `apps/engine/tests/unit/test_rate_limiting.py`:

```python
"""Tests that rate limiting is enforced on expensive endpoints."""
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_ingest_rate_limit_enforced():
    """POST /api/v1/data/ingest should return 429 after exceeding limit."""
    responses = [client.post("/api/v1/data/ingest", json={"tickers": ["AAPL"]}) for _ in range(6)]
    status_codes = [r.status_code for r in responses]
    assert 429 in status_codes, f"Expected 429 but got: {status_codes}"


def test_scan_signals_rate_limit_enforced():
    """POST /api/v1/strategies/scan should return 429 after exceeding limit."""
    payload = {"tickers": ["AAPL"], "days": 30}
    responses = [client.post("/api/v1/strategies/scan", json=payload) for _ in range(6)]
    status_codes = [r.status_code for r in responses]
    assert 429 in status_codes, f"Expected 429 but got: {status_codes}"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\engine"
.venv/Scripts/python -m pytest tests/unit/test_rate_limiting.py -v
```

Expected: FAIL — 429 never returned.

- [ ] **Step 3: Add slowapi dependency and create shared limiter module**

Open `apps/engine/pyproject.toml` and add to `dependencies`:

```toml
"slowapi>=0.1.9",
```

Install:

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\engine"
uv pip install slowapi
```

Create `apps/engine/src/api/limiter.py` — a single shared limiter instance to avoid circular imports:

```python
"""Shared SlowAPI rate limiter instance.

Import this in both main.py and route files to avoid circular imports.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
```

- [ ] **Step 4: Register limiter in main.py**

Open `apps/engine/src/api/main.py` and add after `app = FastAPI(...)`:

```python
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from src.api.limiter import limiter

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

- [ ] **Step 5: Apply rate limits to expensive routes**

In `apps/engine/src/api/routes/data.py`, add at the top:

```python
from starlette.requests import Request
from src.api.limiter import limiter
```

Then decorate `ingest_data`. The existing function has `request: IngestRequest` as its body — rename it to `body` and add a `request: Request` Starlette parameter (required by SlowAPI):

```python
@router.post("/ingest", response_model=IngestResponse)
@limiter.limit("5/minute")
async def ingest_data(request: Request, body: IngestRequest) -> IngestResponse:
    # Replace all references to `request` in the function body with `body`
    ...
```

In `apps/engine/src/api/routes/strategies.py`, add at the top:

```python
from starlette.requests import Request
from src.api.limiter import limiter
```

Then decorate `scan_signals`:

```python
@router.post("/scan", response_model=ScanResponse)
@limiter.limit("10/minute")
async def scan_signals(request: Request, body: ScanRequest) -> ScanResponse:
    # Replace all references to `request` in the function body with `body`
    ...
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\engine"
.venv/Scripts/python -m pytest tests/unit/test_rate_limiting.py -v
```

Expected: PASS

- [ ] **Step 7: Run full engine test suite to verify no regressions**

```bash
.venv/Scripts/python -m pytest tests/ --tb=short
```

Expected: All previously passing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add apps/engine/pyproject.toml apps/engine/src/api/limiter.py \
        apps/engine/src/api/main.py \
        apps/engine/src/api/routes/data.py apps/engine/src/api/routes/strategies.py \
        apps/engine/tests/unit/test_rate_limiting.py
git commit -m "feat(engine): add rate limiting via slowapi to expensive endpoints"
```

---

## PHASE 2 — Documentation

---

### Task 4: Write Root README.md

**Context:** There is no README.md in the repository root. New developers (and yourself after a break) cannot bootstrap the project without one.

**Files:**

- Create: `README.md`

- [ ] **Step 1: Create README.md**

Create `README.md` at the repo root:

````markdown
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
- pnpm (`npm install -g pnpm`)
- Docker Desktop (for containerized local dev)
- Supabase CLI (`npm install -g supabase`)

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/MNLEGIT651/sentinel-trading-platform.git
cd sentinel-trading-platform
pnpm install
```
````

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
supabase db push
# Or run migrations manually against your Supabase project
```

### 4. Start all services (Docker)

```bash
docker compose up --build
```

Or start individually:

```bash
# Terminal 1 — Engine
cd apps/engine && uv run uvicorn src.api.main:app --reload --port 8000

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
uv run pytest tests/ -v

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

````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add root README with quickstart and architecture overview"
````

---

### Task 5: Enable FastAPI OpenAPI Documentation

**Context:** FastAPI generates OpenAPI (Swagger UI + ReDoc) automatically, but it may be disabled in production config. We want it accessible in development/staging but locked in production.

**Files:**

- Modify: `apps/engine/src/api/main.py`
- Modify: `apps/engine/src/config.py` (or wherever `Settings` lives)

- [ ] **Step 1: Check current FastAPI app instantiation**

Read `apps/engine/src/api/main.py` and find the `FastAPI(...)` constructor call. Note whether `docs_url` or `redoc_url` are set.

- [ ] **Step 2: Add environment-controlled docs URLs**

In `main.py`, update the `FastAPI(...)` call:

```python
from src.config import settings

app = FastAPI(
    title="Sentinel Engine API",
    version="1.0.0",
    description="Quantitative trading engine — strategies, signals, backtesting, risk",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
    openapi_url="/openapi.json" if settings.environment != "production" else None,
)
```

- [ ] **Step 3: Add `environment` field to Settings if missing**

In `apps/engine/src/config.py`, add to the `Settings` class:

```python
environment: str = "development"  # "development" | "staging" | "production"
```

And add to `.env.example`:

```
ENGINE_ENVIRONMENT=development  # Set to "production" in prod deployments
```

- [ ] **Step 4: Verify docs are accessible locally**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\engine"
.venv/Scripts/python -m uvicorn src.api.main:app --port 8000
# Open http://localhost:8000/docs
```

Expected: Swagger UI loads with all 6 route modules documented.

- [ ] **Step 5: Run engine tests to verify no regressions**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\engine"
.venv/Scripts/python -m pytest tests/ --tb=short
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/engine/src/api/main.py apps/engine/src/config.py .env.example
git commit -m "feat(engine): enable OpenAPI docs in non-production environments"
```

---

### Task 6: Write Deployment Guide

**Context:** No runbook exists for deploying to production. This documents the three deployment targets: Vercel (web), Docker host (engine + agents), and Supabase (database).

**Files:**

- Create: `docs/deployment-guide.md`

- [ ] **Step 1: Create deployment guide**

Create `docs/deployment-guide.md`:

````markdown
# Sentinel Deployment Guide

## Overview

| Component     | Target                       | Method                    |
| ------------- | ---------------------------- | ------------------------- |
| `apps/web`    | Vercel                       | Git push to main          |
| `apps/engine` | Docker (VPS/Cloud Run/ECS)   | docker build + docker run |
| `apps/agents` | Docker (same host as engine) | docker build + docker run |
| Database      | Supabase Cloud               | supabase db push          |

---

## 1. Database (Supabase)

### First-time setup

1. Create a new Supabase project at https://supabase.com
2. Note your project URL and keys (Settings → API)
3. Apply migrations:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```
````

4. Seed default data:

```bash
psql "$DATABASE_URL" < supabase/seed.sql
```

### Subsequent deploys

```bash
supabase db push  # applies any new migrations
```

---

## 2. Web App (Vercel)

### First-time setup

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ENGINE_URL          # URL of your deployed engine
vercel env add AGENTS_URL          # URL of your deployed agents
vercel env add ENGINE_API_KEY
```

### Deploy

```bash
vercel --prod
```

Auto-deploy is configured via Vercel Git integration on push to `main`.

---

## 3. Engine (Docker)

### Build

```bash
cd apps/engine
docker build -t sentinel-engine:latest .
```

### Run

```bash
docker run -d \
  --name sentinel-engine \
  --restart unless-stopped \
  -p 8000:8000 \
  --env-file .env.production \
  -e ENGINE_ENVIRONMENT=production \
  sentinel-engine:latest
```

### Health check

```bash
curl http://localhost:8000/health
# Expected: {"status": "ok", "timestamp": "..."}
```

---

## 4. Agents (Docker)

```bash
cd apps/agents
docker build -t sentinel-agents:latest .

docker run -d \
  --name sentinel-agents \
  --restart unless-stopped \
  -p 3001:3001 \
  --env-file .env.production \
  sentinel-agents:latest
```

---

## 5. Environment Variables

All required variables are documented in `.env.example`. For production, use:

| Platform       | Where to set                                          |
| -------------- | ----------------------------------------------------- |
| Vercel         | Project Settings → Environment Variables              |
| Docker         | `--env-file .env.production` (never commit this file) |
| GitHub Actions | Repository Settings → Secrets and Variables           |

---

## 6. Pre-Deployment Checklist

- [ ] All secrets rotated and stored in secrets manager (not in code)
- [ ] `ENGINE_ENVIRONMENT=production` set (disables Swagger UI)
- [ ] `BROKER_MODE` set to `paper` unless explicitly going live
- [ ] Database migrations applied: `supabase db push`
- [ ] Seed data applied if new Supabase project
- [ ] All CI checks passing on the deploy branch
- [ ] Health checks pass for engine + agents before pointing web at them
- [ ] `CORS_ORIGINS` set to production web domain (not `*`)

---

## 7. Rollback

### Web (Vercel)

```bash
vercel rollback  # reverts to previous deployment
```

### Engine / Agents (Docker)

```bash
docker stop sentinel-engine
docker run ... sentinel-engine:previous-tag
```

### Database

Supabase provides Point-in-Time Recovery (PITR) on Pro plan.
Manual backups: Supabase Dashboard → Database → Backups.

````

- [ ] **Step 2: Commit**

```bash
git add docs/deployment-guide.md
git commit -m "docs: add production deployment guide for web, engine, agents, and database"
````

---

## PHASE 3 — Observability

---

### Task 7: Add Request Correlation IDs and Structured Logging to FastAPI Engine

**Context:** When something breaks in production across web → engine → agents, there's no way to trace a single request through all services. Correlation IDs fix this.

**Files:**

- Create: `apps/engine/src/api/middleware.py`
- Modify: `apps/engine/src/api/main.py`
- Create: `apps/engine/tests/unit/test_middleware.py`

- [ ] **Step 1: Write the failing test**

Create `apps/engine/tests/unit/test_middleware.py`:

```python
"""Tests that request correlation ID middleware injects and propagates IDs."""
from fastapi.testclient import TestClient
from src.api.main import app


client = TestClient(app)


def test_correlation_id_added_to_response():
    """Every response must include an X-Correlation-ID header."""
    response = client.get("/health")
    assert "x-correlation-id" in response.headers


def test_existing_correlation_id_propagated():
    """If X-Correlation-ID is sent in request, same ID is echoed back."""
    headers = {"X-Correlation-ID": "test-id-12345"}
    response = client.get("/health", headers=headers)
    assert response.headers.get("x-correlation-id") == "test-id-12345"


def test_missing_correlation_id_generates_new():
    """If no ID is provided, a valid UUID is generated."""
    import re
    response = client.get("/health")
    correlation_id = response.headers.get("x-correlation-id", "")
    uuid_pattern = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    assert re.match(uuid_pattern, correlation_id), f"Not a valid UUID: {correlation_id}"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\engine"
.venv/Scripts/python -m pytest tests/unit/test_middleware.py -v
```

Expected: FAIL — no `x-correlation-id` header.

- [ ] **Step 3: Create middleware module**

Create `apps/engine/src/api/middleware.py`:

```python
"""Request correlation ID middleware for distributed tracing."""
import logging
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

CORRELATION_ID_HEADER = "X-Correlation-ID"


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """Injects a correlation ID into every request/response for tracing."""

    async def dispatch(self, request: Request, call_next) -> Response:
        correlation_id = request.headers.get(CORRELATION_ID_HEADER) or str(uuid.uuid4())
        request.state.correlation_id = correlation_id

        # Structured log entry for every request
        logger.info(
            "request_started",
            extra={
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
                "client": request.client.host if request.client else "unknown",
            },
        )

        response = await call_next(request)
        response.headers[CORRELATION_ID_HEADER] = correlation_id

        logger.info(
            "request_completed",
            extra={
                "correlation_id": correlation_id,
                "status_code": response.status_code,
            },
        )
        return response
```

- [ ] **Step 4: Register middleware in main.py**

In `apps/engine/src/api/main.py`, add after the `app = FastAPI(...)` line:

```python
import logging
import logging.config

from src.api.middleware import CorrelationIDMiddleware

# Structured JSON logging
logging.basicConfig(
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}',
)

app.add_middleware(CorrelationIDMiddleware)
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\engine"
.venv/Scripts/python -m pytest tests/unit/test_middleware.py -v
```

Expected: PASS

- [ ] **Step 6: Run full suite to check for regressions**

```bash
.venv/Scripts/python -m pytest tests/ --tb=short
```

Expected: All previously passing tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/engine/src/api/middleware.py apps/engine/src/api/main.py \
        apps/engine/tests/unit/test_middleware.py
git commit -m "feat(engine): add correlation ID middleware and structured request logging"
```

---

### Task 8: Add Error Boundary to Web App

**Context:** Unhandled errors in React components crash the entire page with a blank screen. An error boundary catches these and shows a graceful fallback instead.

**Files:**

- Create: `apps/web/src/components/error-boundary.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Create: `apps/web/tests/components/error-boundary.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/components/error-boundary.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from '@/components/error-boundary';

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('Test error');
  return <div>Safe content</div>;
};

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('renders fallback UI when child throws', () => {
    // Suppress React error boundary console.error noise in tests
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\web"
pnpm test --reporter=verbose tests/components/error-boundary.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ErrorBoundary component**

Create `apps/web/src/components/error-boundary.tsx`:

```tsx
'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // In production, send to error monitoring (e.g., Sentry)
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center min-h-[200px] gap-4 p-8">
            <p className="text-destructive font-medium">Something went wrong</p>
            <p className="text-muted-foreground text-sm">
              {this.state.error?.message ?? 'An unexpected error occurred'}
            </p>
            <button
              className="text-sm underline text-primary"
              onClick={() => this.setState({ hasError: false })}
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: Wrap the root layout**

Open `apps/web/src/app/layout.tsx`. Wrap `{children}` with `<ErrorBoundary>`:

```tsx
import { ErrorBoundary } from '@/components/error-boundary';

// Inside the body:
<ErrorBoundary>{children}</ErrorBoundary>;
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\web"
pnpm test --reporter=verbose tests/components/error-boundary.test.tsx
```

Expected: PASS

- [ ] **Step 6: Run full web test suite**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\web"
pnpm test
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/error-boundary.tsx apps/web/src/app/layout.tsx \
        apps/web/tests/components/error-boundary.test.tsx
git commit -m "feat(web): add React error boundary to catch unhandled render errors"
```

---

## PHASE 4 — API Hardening

---

### Task 9: Add Content Security Policy Headers

**Context:** The web app has good security headers (X-Frame-Options, X-Content-Type-Options) but is missing a Content Security Policy (CSP), which prevents XSS attacks by restricting what scripts/styles can load.

**Files:**

- Modify: `apps/web/next.config.ts`
- Create: `apps/web/tests/unit/next-config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/unit/next-config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import nextConfig from '@/../next.config';

describe('next.config security headers', () => {
  it('includes a Content-Security-Policy header on all routes', async () => {
    const headers = await nextConfig.headers?.();
    const allHeaders = headers?.flatMap((h) => h.headers) ?? [];
    const csp = allHeaders.find((h) => h.key === 'Content-Security-Policy');
    expect(csp).toBeDefined();
    expect(csp?.value).toContain("default-src 'self'");
  });

  it('CSP includes Supabase websocket origin for Realtime', async () => {
    const headers = await nextConfig.headers?.();
    const allHeaders = headers?.flatMap((h) => h.headers) ?? [];
    const csp = allHeaders.find((h) => h.key === 'Content-Security-Policy');
    expect(csp?.value).toContain('wss://*.supabase.co');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\web"
pnpm test --reporter=verbose tests/unit/next-config.test.ts
```

Expected: FAIL — `Content-Security-Policy` header not found.

- [ ] **Step 3: Read current next.config.ts**

Read `apps/web/next.config.ts` to understand the existing headers structure before editing.

- [ ] **Step 4: Add CSP header to the headers array**

In `apps/web/next.config.ts`, inside the existing security headers array, add:

```typescript
{
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed for Next.js dev
    "style-src 'self' 'unsafe-inline'",                // needed for Tailwind
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.polygon.io https://api.alpaca.markets",
    "frame-ancestors 'none'",
  ].join("; "),
},
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\web"
pnpm test --reporter=verbose tests/unit/next-config.test.ts
```

Expected: PASS

- [ ] **Step 6: Build the app to verify CSP doesn't break it**

```bash
pnpm build
```

Expected: Build completes without errors.

- [ ] **Step 7: Run full web test suite**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/next.config.ts apps/web/tests/unit/next-config.test.ts
git commit -m "feat(web): add Content Security Policy header to prevent XSS"
```

---

### Task 10: Add Circuit Breaker to External API Calls in Engine

**Context:** If Polygon.io or Alpaca goes down, the engine will accumulate connection errors at the route level with no fast-fail behavior. `polygon_client.py` already handles HTTP 429 rate limits internally via `_request_with_retry`. This task adds a `tenacity`-based circuit breaker that wraps the higher-level `get_bars()` / `get_latest_price()` public methods at the route layer, catching `ConnectionError`, `TimeoutError`, and `OSError` before they bubble up to the user as 500s.

**Files:**

- Modify: `apps/engine/pyproject.toml` (add `tenacity`)
- Create: `apps/engine/src/utils/__init__.py` (make `utils` a package)
- Create: `apps/engine/src/utils/circuit_breaker.py`
- Modify: `apps/engine/src/api/routes/data.py` (wrap `polygon.get_latest_price`)
- Modify: `apps/engine/src/api/routes/strategies.py` (wrap `polygon.get_bars` in `_fetch_ohlcv`)
- Create: `apps/engine/tests/unit/test_circuit_breaker.py`

- [ ] **Step 1: Read the Polygon client and data routes**

Read `apps/engine/src/data/polygon_client.py` to understand `get_bars()` and `get_latest_price()` signatures.
Read `apps/engine/src/api/routes/data.py` to see where Polygon calls occur.

- [ ] **Step 2: Write failing test**

Create `apps/engine/tests/unit/test_circuit_breaker.py`:

```python
"""Tests that external API calls fail fast with circuit breaker."""
import pytest
from unittest.mock import patch, AsyncMock
from src.utils.circuit_breaker import with_circuit_breaker


@pytest.mark.asyncio
async def test_circuit_breaker_raises_after_max_retries():
    """Circuit breaker should raise after configured max attempts."""
    call_count = 0

    async def flaky_call():
        nonlocal call_count
        call_count += 1
        raise ConnectionError("API down")

    with pytest.raises(ConnectionError):
        await with_circuit_breaker(flaky_call, max_attempts=3)

    assert call_count == 3, f"Expected 3 attempts, got {call_count}"


@pytest.mark.asyncio
async def test_circuit_breaker_succeeds_on_retry():
    """Circuit breaker should return result if call succeeds within attempts."""
    call_count = 0

    async def eventually_works():
        nonlocal call_count
        call_count += 1
        if call_count < 2:
            raise ConnectionError("Temporary failure")
        return {"data": "ok"}

    result = await with_circuit_breaker(eventually_works, max_attempts=3)
    assert result == {"data": "ok"}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\engine"
.venv/Scripts/python -m pytest tests/unit/test_circuit_breaker.py -v
```

Expected: FAIL — module not found.

- [ ] **Step 4: Add tenacity to pyproject.toml and create utils package**

Open `apps/engine/pyproject.toml` and add to `dependencies`:

```toml
"tenacity>=9.0",
```

Install and create the utils package:

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\engine"
uv pip install tenacity
```

Create `apps/engine/src/utils/__init__.py` (empty — makes `utils` a Python package):

```python

```

- [ ] **Step 5: Create circuit_breaker utility**

Create `apps/engine/src/utils/circuit_breaker.py`:

```python
"""Circuit breaker wrapper for external API calls using tenacity."""
import logging
from typing import Callable, TypeVar, Awaitable
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

logger = logging.getLogger(__name__)
T = TypeVar("T")


async def with_circuit_breaker(
    fn: Callable[[], Awaitable[T]],
    max_attempts: int = 3,
    min_wait: float = 1.0,
    max_wait: float = 10.0,
) -> T:
    """
    Wraps an async function with retry + exponential backoff.

    Raises the last exception if all attempts fail.
    """
    @retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
        retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    async def _run():
        return await fn()

    return await _run()
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\engine"
.venv/Scripts/python -m pytest tests/unit/test_circuit_breaker.py -v
```

Expected: PASS

- [ ] **Step 7: Apply circuit breaker in `strategies.py` — wrap `_fetch_ohlcv`**

Open `apps/engine/src/api/routes/strategies.py`. Add import at top:

```python
from src.utils.circuit_breaker import with_circuit_breaker
```

Wrap the `polygon.get_bars(...)` call inside `_fetch_ohlcv`:

```python
async def _fetch_ohlcv(polygon: PolygonClient, ticker: str, days: int) -> OHLCVData | None:
    """Fetch bars from Polygon and convert to OHLCVData."""
    end = date.today()
    start = end - timedelta(days=days)
    bars = await with_circuit_breaker(
        lambda: polygon.get_bars(ticker=ticker, timeframe="1d", start=start, end=end)
    )
    if len(bars) < 20:
        return None
    return OHLCVData(
        ticker=ticker,
        timestamps=np.array([b.timestamp.timestamp() for b in bars], dtype=np.float64),
        open=np.array([b.open for b in bars], dtype=np.float64),
        high=np.array([b.high for b in bars], dtype=np.float64),
        low=np.array([b.low for b in bars], dtype=np.float64),
        close=np.array([b.close for b in bars], dtype=np.float64),
        volume=np.array([b.volume for b in bars], dtype=np.float64),
    )
```

- [ ] **Step 8: Apply circuit breaker in `data.py` — wrap `get_latest_price`**

Open `apps/engine/src/api/routes/data.py`. Add import:

```python
from src.utils.circuit_breaker import with_circuit_breaker
```

Find the call to `polygon.get_latest_price(ticker)` and wrap it:

```python
bar = await with_circuit_breaker(lambda: polygon.get_latest_price(ticker))
```

- [ ] **Step 9: Run full engine tests**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\engine"
.venv/Scripts/python -m pytest tests/ --tb=short
```

Expected: All tests pass.

- [ ] **Step 10: Commit**

```bash
git add apps/engine/src/utils/__init__.py \
        apps/engine/src/utils/circuit_breaker.py \
        apps/engine/pyproject.toml \
        apps/engine/src/api/routes/strategies.py \
        apps/engine/src/api/routes/data.py \
        apps/engine/tests/unit/test_circuit_breaker.py
git commit -m "feat(engine): add circuit breaker for Polygon API calls via tenacity"
```

---

## PHASE 5 — CI/CD Deployment Pipeline

---

### Task 11: Add GitHub Secrets and CD Job to CI Pipeline

**Context:** The CI pipeline runs tests but has no deployment step. Production deployments are manual. This task adds a deploy job that triggers on pushes to `main` after all tests pass.

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add GitHub Secrets to the repository**

Go to GitHub → Repository Settings → Secrets and Variables → Actions → New secret.

Add these secrets (using your rotated values from Task 1):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
POLYGON_API_KEY
ALPACA_API_KEY
ALPACA_SECRET_KEY
ANTHROPIC_API_KEY
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

To get Vercel IDs:

```bash
vercel link  # run in repo root
cat .vercel/project.json  # shows projectId and orgId
```

- [ ] **Step 2: Add deploy-web job to ci.yml**

Open `.github/workflows/ci.yml` and add after the existing jobs:

```yaml
deploy-web:
  name: Deploy Web to Vercel
  runs-on: ubuntu-latest
  needs: [test-web, test-engine, test-agents, secrets-scan]
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with:
        version: 10
    - uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'pnpm'
    - run: pnpm install --frozen-lockfile
    - name: Deploy to Vercel (production)
      run: |
        pnpm dlx vercel --token ${{ secrets.VERCEL_TOKEN }} \
          --prod \
          --yes \
          --cwd apps/web
      env:
        VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
        VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add automated Vercel deploy on push to main after all tests pass"
```

- [ ] **Step 4: Verify CORS is correctly configured for production**

Open `apps/engine/src/api/main.py` and locate the CORS middleware configuration. Confirm it uses the `CORS_ORIGINS` environment variable (not a hardcoded `*` wildcard). It should look like:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),  # set CORS_ORIGINS in .env
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

If `CORS_ORIGINS` is not wired to an env variable, add `cors_origins: str = "http://localhost:3000"` to `Settings` in `apps/engine/src/config.py` and update `.env.example`:

```
CORS_ORIGINS=http://localhost:3000  # Production: set to your Vercel domain
```

- [ ] **Step 5: Verify `/health` endpoint returns correct shape**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\engine"
.venv/Scripts/python -m uvicorn src.api.main:app --port 8000 &
curl http://localhost:8000/health
```

Expected: `{"status": "ok", "timestamp": "..."}` — the same shape referenced in the deployment guide.

If the shape differs, update the deployment guide to match the actual response.

- [ ] **Step 6: Push and verify full pipeline**

```bash
git push origin main
```

Go to GitHub Actions → verify all 5 jobs pass (test-web, test-engine, test-agents, secrets-scan, deploy-web).

> **Docker CD Gap (acknowledged):** Engine and agents Docker images are built and run manually (see deployment guide). Automating Docker build/push to a registry (GHCR/ECR) and triggering a remote restart is a follow-on task once a container host is provisioned. It is intentionally deferred here.

---

### Task 12: Add Supabase Migration CI Step

**Context:** Database schema changes (new migrations) are currently applied manually. This step adds automated migration validation to CI so broken migrations are caught before they reach production.

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add migration validation job**

In `.github/workflows/ci.yml`, add:

```yaml
validate-migrations:
  name: Validate DB Migrations
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: supabase/setup-cli@v1
      with:
        version: latest
    - name: Start local Supabase
      run: supabase start
    - name: Apply migrations (supabase db reset replays all migrations from scratch)
      run: supabase db reset
    - name: Stop local Supabase
      run: supabase stop
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add Supabase migration validation to CI pipeline"
```

---

## Final Verification

- [ ] **Run full CI locally to confirm all phases complete**

```bash
cd "C:\Users\steve\Projects\personal\Stock Trading App"
pnpm test
cd "C:\Users\steve\Projects\personal\Stock Trading App\apps\engine" && .venv/Scripts/python -m pytest tests/ --tb=short
```

Expected: All tests pass across all three apps.

- [ ] **Verify production checklist**

Review `docs/deployment-guide.md` pre-deployment checklist and confirm every item is checked before pushing to `main` for production deploy.

- [ ] **Confirm no secrets in git history**

```bash
git log --all --full-history -- .env
git grep -r "sk-ant-api" -- ':!*.example'
git grep -r "PKCQYMK" -- ':!*.example'
```

Expected: All return empty.

---

## Summary

| Phase                         | Tasks                                                        | Critical?          |
| ----------------------------- | ------------------------------------------------------------ | ------------------ |
| **0 — Fix Existing Failures** | pnpm version in Dockerfiles/CI, cross-platform ruff          | 🔴 Yes — fix first |
| **1 — Security**              | Rotate secrets, secrets scan CI, rate limiting               | 🔴 Yes             |
| **2 — Documentation**         | README, OpenAPI docs, deployment guide                       | 🟠 High            |
| **3 — Observability**         | Correlation IDs + structured logging, error boundary         | 🟠 High            |
| **4 — API Hardening**         | CSP headers (with tests), circuit breaker                    | 🟡 Medium          |
| **5 — CI/CD**                 | CD pipeline + CORS/health verification, migration validation | 🟡 Medium          |

**Total tasks**: 13
**Estimated scope**: ~3-4 focused sessions

**Intentionally deferred (out of scope for this plan):**

- Docker image CD (build/push to GHCR/ECR + remote restart) — requires a provisioned container host
- Distributed tracing with OpenTelemetry — valuable after the above is in place
- Error monitoring service (e.g. Sentry) — add once deployment is stable
