# Sentinel Engineering Review

Date: 2026-03-14
Review scope: repository-only audit of the current implementation and deployment assets.

## Executive Summary

Sentinel already has the shape of a real multi-service trading platform: a Next.js operator console, a FastAPI engine, an Express-based agents service, and a Supabase schema that models accounts, orders, signals, risk, alerts, trades, and backtest results. The strongest areas today are the platform boundaries and operations footprint: engine authentication is enforced in `apps/engine/src/api/main.py` (`ApiKeyMiddleware`, lines 22-43), the deployment topology is documented in `docs/deployment.md` (`Production Topology`, lines 5-21), and CI covers the web, engine, and agents services in `.github/workflows/ci.yml` (`jobs`, lines 12-141).

The main product gap is that the platform still mixes production-shaped interfaces with prototype behavior. The dashboard and markets views still fall back to simulated data in `apps/web/src/app/page.tsx` (`fetchPrices`, lines 50-73) and `apps/web/src/app/markets/page.tsx` (`generateSampleData` and fallback quote/bar paths, lines 35-59 and 73-168). The engine now exposes strategy and backtest endpoints, but the backtest route currently runs on generated synthetic data in `apps/engine/src/api/routes/backtest.py` (`generate_synthetic_data` and `run_backtest`, lines 71-149), which means the research surface is not yet tied to persisted historical market data.

## Current State by Area

### 1. Platform topology and deployment are well defined

- The supported production model is explicit: browser -> Vercel web -> Railway engine/agents, with Docker Compose reserved for local development in `docs/deployment.md` (`Production Topology`, lines 5-21, and `Deployment Assets`, lines 109-119).
- Local orchestration is present and runnable through `docker-compose.yml` (`services`, lines 11-85), with dedicated `engine`, `agents`, and `web` containers.
- Vercel change detection is intentionally narrowed in `vercel.json` (lines 1-4).
- CI validates all three runtimes in `.github/workflows/ci.yml` (`test-web`, `test-engine`, and `test-agents`, lines 16-141).

### 2. The web app is still partly prototype UX

- The dashboard shell fetches live engine data, but preserves simulated ticker values when requests fail in `apps/web/src/app/page.tsx` (`fallbackTickerData` and `fetchPrices`, lines 22-31 and 50-73).
- The markets screen still generates synthetic OHLCV series and static quote fallbacks in `apps/web/src/app/markets/page.tsx` (`generateSampleData`, lines 35-59; quote fallback, lines 73-121; bar fallback, lines 123-168).
- The outage UX is at least honest: `OfflineBanner` and `SimulatedBadge` clearly label degraded states in `apps/web/src/components/ui/offline-banner.tsx` (lines 11-37) and `apps/web/src/components/ui/simulated-badge.tsx` (lines 5-15).
- Realtime intent is present through Supabase subscriptions in `apps/web/src/hooks/use-realtime.ts` (lines 17-80), but the main dashboard experience is not yet centered on persisted research or execution records.

### 3. The engine has real structure, but research fidelity is uneven

- API key enforcement and router registration are in place in `apps/engine/src/api/main.py` (`ApiKeyMiddleware` and router wiring, lines 22-43 and 53-102).
- Market data ingestion is grounded in real provider calls through `apps/engine/src/data/polygon_client.py` and `apps/engine/src/data/ingestion.py`.
- The engine now includes a tracked strategy package and scan route: `apps/engine/src/api/routes/strategies.py` (`get_strategies` and `scan_signals`, lines 168-240) and `apps/engine/src/strategies/signal_generator.py` (`SignalGenerator`, lines 45-145).
- Portfolio APIs are further along than a placeholder: `apps/engine/src/api/routes/portfolio.py` exposes account, positions, order submission, order history, and cancellation flows (lines 47-205), backed by the broker abstraction in `apps/engine/src/execution/broker_interface.py` (lines 7-57) and the paper implementation in `apps/engine/src/execution/paper_broker.py` (lines 11-171).
- The largest fidelity gap is the backtest surface: `apps/engine/src/api/routes/backtest.py` runs strategies against generated data rather than historical bars from `market_data` (lines 71-149).

### 4. The data model is ambitious and ahead of parts of the app layer

- The initial schema already covers accounts, instruments, market data, strategies, signals, orders, positions, snapshots, risk metrics, alerts, watchlists, trades, and backtest results in `supabase/migrations/00001_initial_schema.sql` (lines 7-252).
- Access control and realtime publication are configured in `supabase/migrations/00002_indexes_rls_realtime.sql` (`RLS` and `Realtime`, lines 17-55).
- Starter instruments and strategy definitions are seeded in `supabase/seed.sql` (lines 1-29).

That schema shows strong product intent, but several tables are still ahead of the workflows exposed in the web app and engine APIs.

### 5. The agents service exists, but it is still maturing into an operating layer

- The agents process now boots an HTTP API, scheduler, and graceful shutdown path in `apps/agents/src/index.ts` (lines 1-96).
- This is meaningfully beyond a stub, but the operational maturity of the agents layer still depends on the surrounding server/orchestrator flows and on how recommendations are consumed from the web app.

## Key Gaps

### Research and backtesting fidelity

The repository includes strategy scanning and a backtest API, but the backtest path is still synthetic-data driven in `apps/engine/src/api/routes/backtest.py` (lines 71-149). That makes the backtest interface useful for exercising strategy code paths, but not yet for trustworthy investment research.

### Web-to-research integration

The dashboard and markets pages still rely on simulated fallbacks in `apps/web/src/app/page.tsx` (lines 22-73) and `apps/web/src/app/markets/page.tsx` (lines 35-168). That is acceptable for resilience and demos, but it means the primary operator console is not yet a clean window into persisted signals, portfolio history, or validated backtests.

### Production-path consistency

Deployment guidance is coherent across `docs/deployment.md`, `docker-compose.yml`, `vercel.json`, and `.github/workflows/ci.yml`, but the product experience still needs to catch up to those operational assets. In other words, the infrastructure story is closer to production than the research workflow story.

## Recommendations

1. **Connect backtesting to persisted historical data before treating results as research evidence.**
   Prioritize `apps/engine/src/api/routes/backtest.py`, `apps/engine/src/data/ingestion.py`, and the `market_data` / `backtest_results` tables in `supabase/migrations/00001_initial_schema.sql` so backtests run on stored bars instead of generated series.

2. **Rework the main operator views around persisted system records instead of simulated UI fallbacks.**
   The first targets should be `apps/web/src/app/page.tsx`, `apps/web/src/app/markets/page.tsx`, and the health/status state in `apps/web/src/stores/app-store.ts`, while preserving the explicit outage UX in `apps/web/src/components/ui/offline-banner.tsx` and `apps/web/src/components/ui/simulated-badge.tsx`.

3. **Make the strategy-to-order pipeline auditable end to end.**
   Tighten the handoff between `apps/engine/src/api/routes/strategies.py`, `apps/engine/src/strategies/signal_generator.py`, `apps/engine/src/api/routes/portfolio.py`, and the relevant Supabase tables defined in `supabase/migrations/00001_initial_schema.sql` so generated signals, approvals, submissions, fills, and risk checks can be traced through one consistent flow.

4. **Treat deployment assets as part of the product contract, not just infrastructure glue.**
   Keep `apps/engine/Dockerfile`, `docker-compose.yml`, `vercel.json`, and `.github/workflows/ci.yml` aligned with the runtime assumptions in `docs/deployment.md`, especially around health checks, environment ownership, and same-origin routing.

## References

This review is based on repository artifacts only:

- `docs/deployment.md`
- `docker-compose.yml`
- `vercel.json`
- `.github/workflows/ci.yml`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/markets/page.tsx`
- `apps/web/src/hooks/use-realtime.ts`
- `apps/web/src/stores/app-store.ts`
- `apps/web/src/components/ui/offline-banner.tsx`
- `apps/web/src/components/ui/simulated-badge.tsx`
- `apps/engine/src/api/main.py`
- `apps/engine/src/api/routes/backtest.py`
- `apps/engine/src/api/routes/strategies.py`
- `apps/engine/src/api/routes/portfolio.py`
- `apps/engine/src/data/polygon_client.py`
- `apps/engine/src/data/ingestion.py`
- `apps/engine/src/execution/broker_interface.py`
- `apps/engine/src/execution/paper_broker.py`
- `apps/engine/src/strategies/signal_generator.py`
- `apps/agents/src/index.ts`
- `supabase/migrations/00001_initial_schema.sql`
- `supabase/migrations/00002_indexes_rls_realtime.sql`
- `supabase/seed.sql`
