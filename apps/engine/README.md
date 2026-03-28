# Sentinel Engine

Python FastAPI quant engine for the Sentinel Trading Platform.

## Overview

The engine provides market data aggregation, strategy backtesting, portfolio analytics, and trade signal generation. It runs on Railway in production and is accessed exclusively through the Next.js API proxy (`/api/engine/*`).

## Tech Stack

- **Runtime**: Python 3.12+
- **Framework**: FastAPI + Uvicorn (dev) / Gunicorn (prod)
- **Data**: NumPy, Pandas, Pydantic v2
- **Database**: Supabase (PostgreSQL via PostgREST)
- **Market Data**: Polygon.io, Alpaca

## Development

### Prerequisites

- Python 3.12+ and [uv](https://docs.astral.sh/uv/)

### Setup

```bash
cd apps/engine
uv sync --dev
```

### Run locally

```bash
uv run python -m uvicorn src.api.main:app --reload --port 8000
```

### Validate

```bash
# From repo root
pnpm lint:engine            # Ruff lint
pnpm format:check:engine    # Ruff format check
pnpm test:engine            # Pytest suite
```

## API Endpoints

| Method | Path                               | Description                         |
| ------ | ---------------------------------- | ----------------------------------- |
| GET    | `/health`                          | Health check with dependency status |
| GET    | `/api/v1/market/overview`          | Market overview data                |
| GET    | `/api/v1/market/movers`            | Top market movers                   |
| POST   | `/api/v1/strategies/{id}/backtest` | Run strategy backtest               |
| GET    | `/api/v1/portfolio/summary`        | Portfolio analytics                 |
| GET    | `/api/v1/signals`                  | Active trading signals              |

## Configuration

All configuration is via environment variables. See `.env.example` in the repo root.

| Variable                    | Required | Description                         |
| --------------------------- | -------- | ----------------------------------- |
| `SUPABASE_URL`              | Yes      | Supabase project URL                |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Supabase service role key           |
| `POLYGON_API_KEY`           | Yes      | Polygon.io API key                  |
| `ALPACA_API_KEY`            | Yes      | Alpaca trading API key              |
| `ALPACA_SECRET_KEY`         | Yes      | Alpaca secret key                   |
| `ENGINE_API_KEY`            | Yes      | Shared secret for web → engine auth |

## Docker

```bash
docker build -t sentinel-engine .
docker run -p 8000:8000 --env-file ../../.env sentinel-engine
```
