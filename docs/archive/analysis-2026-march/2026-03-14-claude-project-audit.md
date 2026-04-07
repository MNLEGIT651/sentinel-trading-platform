# Claude Project Audit

Date: 2026-03-14

## Summary

Claude is building `Sentinel`, a monorepo for an evidence-based trading platform. The intended product is much larger than a web dashboard: it aims to combine a Next.js operator console, a Python quant engine, Supabase-backed market and portfolio storage, and a future AI agent layer.

The important distinction is that the repo is currently an early scaffold, not a finished strategy platform. The backend and database work establish direction. The frontend is still mostly a sample-data prototype.

## What Exists Today

### Product definition

- `docs/superpowers/specs/2026-03-14-sentinel-trading-platform-design.md` defines a three-layer system:
  - Layer A: diversified return sources
  - Layer B: risk parity and drawdown controls
  - Layer C: execution-aware trading
- `docs/superpowers/plans/2026-03-14-phase1-foundation.md` is a build plan for the foundation phase.
- `CLAUDE.md` frames the repo as a three-app monorepo: `web`, `engine`, and `agents`.

### Web app

- `apps/web/src/app/page.tsx` is a dashboard shell with hardcoded metrics, alerts, and ticker data.
- `apps/web/src/app/markets/page.tsx` adds a watchlist and chart view, also using generated sample data.
- `apps/web/src/components/layout/*` provides a sidebar/header shell for a future multi-page app.
- `apps/web/src/components/dashboard/*` and `apps/web/src/components/charts/price-chart.tsx` provide presentational widgets.
- `apps/web/src/hooks/use-realtime.ts` and `apps/web/src/lib/supabase/*` show the intended realtime path through Supabase.

Interpretation: the web layer currently demonstrates layout, tone, and interaction patterns, but it is not wired to a real research or execution workflow.

### Engine

- `apps/engine/src/data/polygon_client.py` wraps Polygon aggregates endpoints.
- `apps/engine/src/data/ingestion.py` resolves instruments and upserts OHLCV bars into `market_data`.
- `apps/engine/src/api/routes/data.py` exposes ingestion through FastAPI.
- `apps/engine/src/execution/broker_interface.py` defines the broker contract.
- `apps/engine/src/execution/paper_broker.py` implements a paper broker with random slippage and basic position bookkeeping.
- `apps/engine/src/api/routes/portfolio.py` is still a placeholder response.
- The current worktree also contains an untracked `apps/engine/src/strategies/` package plus `apps/engine/src/api/routes/strategies.py`. That package includes indicators, strategy families, a registry, and a signal generator.

Interpretation: the engine layer has real structure and a partial strategy library, but it still does not implement the full research core that the PDF argues is most important.

### Database

- `supabase/migrations/00001_initial_schema.sql` creates accounts, instruments, market data, strategies, signals, orders, positions, snapshots, risk metrics, alerts, trades, and backtest results.
- `supabase/migrations/00002_indexes_rls_realtime.sql` adds indexes, RLS policies, a live P&L view, and realtime publication.
- `supabase/seed.sql` seeds a starter universe and several strategy definitions.

Interpretation: the schema is ambitious and thoughtful. It is the strongest expression of Claude's intended product scope.

### Tests

- Python unit tests cover config defaults, the health endpoint, the Polygon client, ingestion, and the paper broker.
- Web tests cover the store, engine client URL logic, and a metric card component.

Interpretation: tests are currently focused on scaffolding, not on research validity, portfolio math, or realistic execution.

### Agent layer

- `apps/agents/src/index.ts` is only a stub logging future agent names.

### Spreadsheet and source artifacts

- `Claude Trading Spreadsheet.xlsx` contains a single blank sheet and does not add usable product or strategy detail.
- The attached PDF is the real source document that explains the intended philosophy.

## Gaps Between Blueprint and Implementation

The PDF emphasizes honest backtests, as-of data, survivorship controls, multiple-testing controls, implementation shortfall, and regime-aware risk management. Those are mostly not implemented yet.

Missing or incomplete areas:

- No backtesting engine
- No walk-forward or holdout workflow
- No as-of fundamentals or filing-lag handling
- No multiple-testing controls or overfitting diagnostics
- No realistic market-impact or opportunity-cost model
- No risk parity or volatility-targeting implementation
- No tested, persisted, end-to-end signal generation pipeline wired into portfolio construction
- No production broker adapter beyond the paper stub
- No authentication or settings workflow in the web app
- No real integration between the UI and the engine for research decisions
- No tests for the untracked strategy package

## Practical Read

The current repo should be treated as:

- an architecture draft
- a schema-first prototype
- a UI concept for a future operator console

It should not be treated as a finished evidence-based trading application yet.

## Why Compass Is Separate

My separate project does not extend `Sentinel` directly because the PDF supports a narrower first product:

- research integrity before live execution
- cost realism before signal expansion
- staged paper trading before autonomous behavior

That is the basis for the separate `Compass` app.
