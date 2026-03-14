# Sentinel Trading Platform -- System Design Specification

**Date**: 2026-03-14
**Status**: Approved
**Author**: Steven Schlingman + Claude (Architect)
**Source**: "Building a Robust, Evidence-Based Trading Strategy Blueprint for Public Markets"

---

## 1. Executive Summary

Sentinel is a professional-grade, evidence-based systematic trading platform built as a modular monorepo. It implements the three-layer architecture prescribed by the blueprint: diversified return sources (Layer A), risk parity + drawdown controls (Layer B), and execution-aware trading with cost models (Layer C). The system connects to real-time market data, runs AI agents for autonomous market monitoring and analysis, and supports both paper and live trading through a broker abstraction layer.

## 2. Architecture

### 2.1 Monorepo Structure

```
sentinel/
├── apps/
│   ├── web/              # Next.js 15 App Router dashboard
│   ├── engine/           # Python FastAPI quant engine
│   └── agents/           # Claude AI agent orchestrator
├── packages/
│   └── shared/           # Shared TypeScript types & constants
├── supabase/
│   ├── migrations/       # Database migrations (sequential)
│   └── seed.sql          # Seed data (instruments, default strategies)
├── docs/
│   └── superpowers/specs/
├── .env.example
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── CLAUDE.md
```

### 2.2 Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Frontend | Next.js 15 (App Router) + TypeScript 5.x | SSR, App Router for layouts, best DX |
| UI Components | shadcn/ui + Tailwind CSS 4 | Accessible, composable, professional |
| Charts | TradingView Lightweight Charts | Industry standard, performant, free |
| Quant Engine | Python 3.14 + FastAPI + NumPy/Pandas | Quant finance lingua franca |
| Database | Supabase (PostgreSQL 15 + Realtime) | Free tier, realtime subscriptions, edge functions |
| AI Agents | Claude Agent SDK (TypeScript) | Native tool use, autonomous operation |
| Market Data | Polygon.io (primary) + Alpha Vantage | Best free tiers, upgrade path |
| Broker | Alpaca (paper + live) | Free paper trading, easy live upgrade |
| Monorepo | pnpm workspaces + Turborepo | Fast, efficient, parallel builds |
| Testing | Vitest (TS) + pytest (Python) + Playwright (E2E) | Fast, modern, comprehensive |
| Deployment | Vercel (web) + Railway (engine) | Optimized for each runtime |

### 2.3 Data Flow

```
Market Data APIs (Polygon.io / Alpha Vantage)
        │
        ▼
Engine: data ingestion (cron: 1min during market hours)
        │
        ▼
Supabase: market_data table (time-partitioned, indexed)
        │
        ├──► Supabase Realtime → Web dashboard (live prices)
        ├──► Engine: strategy signal generation (cron: 15min)
        │         │
        │         ▼
        │    Supabase: signals table
        │         ├──► Realtime → Dashboard (live signal feed)
        │         └──► Agents: confluence analysis
        └──► Agents: Market Sentinel (anomaly detection)
                  │
                  ▼
             Supabase: alerts → Realtime → Dashboard toasts
```

## 3. Database Schema

### 3.1 Core Tables

```sql
-- Instrument universe
CREATE TABLE instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('equity', 'etf', 'option', 'future', 'fx', 'crypto')),
  exchange TEXT,
  sector TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Time-series market data (partitioned by month)
CREATE TABLE market_data (
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  timestamp TIMESTAMPTZ NOT NULL,
  timeframe TEXT NOT NULL DEFAULT '1d' CHECK (timeframe IN ('1m', '5m', '15m', '1h', '1d', '1w')),
  open NUMERIC(18,6) NOT NULL,
  high NUMERIC(18,6) NOT NULL,
  low NUMERIC(18,6) NOT NULL,
  close NUMERIC(18,6) NOT NULL,
  volume BIGINT DEFAULT 0,
  vwap NUMERIC(18,6),
  adjusted_close NUMERIC(18,6),
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id, timestamp),
  UNIQUE (instrument_id, timestamp, timeframe)
) PARTITION BY RANGE (timestamp);

-- Strategy definitions
CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  family TEXT NOT NULL CHECK (family IN ('trend', 'momentum', 'value', 'mean_reversion', 'pairs', 'stat_arb', 'ml', 'composite')),
  description TEXT,
  parameters JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trading signals
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  strategy_id UUID NOT NULL REFERENCES strategies(id),
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short', 'flat')),
  strength NUMERIC(5,4) NOT NULL CHECK (strength >= 0 AND strength <= 1),
  confidence NUMERIC(5,4) CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  signal_id UUID REFERENCES signals(id),
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit', 'stop', 'stop_limit')),
  quantity NUMERIC(18,6) NOT NULL,
  limit_price NUMERIC(18,6),
  stop_price NUMERIC(18,6),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'partial', 'filled', 'cancelled', 'rejected')),
  broker TEXT NOT NULL DEFAULT 'paper' CHECK (broker IN ('paper', 'alpaca', 'ibkr')),
  fill_price NUMERIC(18,6),
  fill_quantity NUMERIC(18,6),
  commission NUMERIC(18,6) DEFAULT 0,
  slippage NUMERIC(18,6),
  submitted_at TIMESTAMPTZ,
  filled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Portfolio positions
CREATE TABLE portfolio_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  quantity NUMERIC(18,6) NOT NULL,
  avg_entry_price NUMERIC(18,6) NOT NULL,
  current_price NUMERIC(18,6),
  unrealized_pnl NUMERIC(18,6),
  realized_pnl NUMERIC(18,6) DEFAULT 0,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  weight NUMERIC(8,6),
  opened_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Portfolio snapshots (daily)
CREATE TABLE portfolio_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_equity NUMERIC(18,2) NOT NULL,
  cash NUMERIC(18,2) NOT NULL,
  positions_value NUMERIC(18,2) NOT NULL,
  daily_pnl NUMERIC(18,2),
  daily_return NUMERIC(10,6),
  cumulative_pnl NUMERIC(18,2),
  cumulative_return NUMERIC(10,6),
  drawdown NUMERIC(10,6),
  max_drawdown NUMERIC(10,6),
  num_positions INTEGER DEFAULT 0
);

-- Risk metrics (computed periodically)
CREATE TABLE risk_metrics (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  sharpe_ratio NUMERIC(8,4),
  sortino_ratio NUMERIC(8,4),
  calmar_ratio NUMERIC(8,4),
  max_drawdown NUMERIC(8,6),
  current_drawdown NUMERIC(8,6),
  annualized_volatility NUMERIC(8,6),
  annualized_return NUMERIC(8,6),
  var_95 NUMERIC(18,2),
  cvar_95 NUMERIC(18,2),
  beta NUMERIC(8,4),
  win_rate NUMERIC(5,4),
  profit_factor NUMERIC(8,4),
  avg_win NUMERIC(18,2),
  avg_loss NUMERIC(18,2),
  turnover NUMERIC(8,4),
  metadata JSONB DEFAULT '{}'
);

-- AI agent logs
CREATE TABLE agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  action TEXT NOT NULL,
  input JSONB,
  output JSONB,
  tokens_used INTEGER,
  duration_ms INTEGER,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('signal', 'risk', 'execution', 'system', 'agent')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  instrument_id UUID REFERENCES instruments(id),
  strategy_id UUID REFERENCES strategies(id),
  metadata JSONB DEFAULT '{}',
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Watchlists
CREATE TABLE watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  instrument_ids UUID[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Backtest results
CREATE TABLE backtest_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES strategies(id),
  parameters JSONB NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  initial_capital NUMERIC(18,2) NOT NULL,
  final_equity NUMERIC(18,2),
  total_return NUMERIC(10,6),
  annualized_return NUMERIC(10,6),
  sharpe_ratio NUMERIC(8,4),
  sortino_ratio NUMERIC(8,4),
  max_drawdown NUMERIC(8,6),
  calmar_ratio NUMERIC(8,4),
  total_trades INTEGER,
  win_rate NUMERIC(5,4),
  profit_factor NUMERIC(8,4),
  avg_trade_return NUMERIC(10,6),
  total_costs NUMERIC(18,2),
  turnover NUMERIC(8,4),
  equity_curve JSONB,
  drawdown_curve JSONB,
  trade_log JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 Indexes

```sql
CREATE INDEX idx_market_data_instrument_time ON market_data (instrument_id, timestamp DESC);
CREATE INDEX idx_market_data_timeframe ON market_data (timeframe, timestamp DESC);
CREATE INDEX idx_signals_instrument ON signals (instrument_id, generated_at DESC);
CREATE INDEX idx_signals_strategy ON signals (strategy_id, generated_at DESC);
CREATE INDEX idx_signals_active ON signals (is_active, generated_at DESC);
CREATE INDEX idx_orders_status ON orders (status, created_at DESC);
CREATE INDEX idx_orders_instrument ON orders (instrument_id, created_at DESC);
CREATE INDEX idx_alerts_unack ON alerts (acknowledged, created_at DESC) WHERE NOT acknowledged;
CREATE INDEX idx_portfolio_snapshots_time ON portfolio_snapshots (timestamp DESC);
CREATE INDEX idx_risk_metrics_time ON risk_metrics (timestamp DESC);
CREATE INDEX idx_agent_logs_agent ON agent_logs (agent_name, created_at DESC);
```

### 3.3 Row-Level Security

All tables have RLS enabled. For this single-user system, policies allow full access for the authenticated service role. This is forward-compatible with multi-user expansion.

## 4. Apps Specification

### 4.1 `apps/web` -- Dashboard

**Framework**: Next.js 15 App Router, TypeScript, Tailwind CSS 4, shadcn/ui
**State**: Zustand for client state, Supabase Realtime for server-pushed updates
**Charts**: TradingView Lightweight Charts

**Route Structure**:
```
app/
├── layout.tsx          # Root layout: sidebar nav, dark theme, toast provider
├── page.tsx            # Command center dashboard
├── markets/
│   └── page.tsx        # Watchlist + charts
├── strategies/
│   └── page.tsx        # Strategy manager
├── signals/
│   └── page.tsx        # Signal feed
├── portfolio/
│   └── page.tsx        # Portfolio & risk metrics
├── backtest/
│   └── page.tsx        # Backtesting lab
├── agents/
│   └── page.tsx        # Agent monitor
└── settings/
    └── page.tsx        # Configuration
```

**Key Components**:
- `PriceChart` -- TradingView Lightweight Charts wrapper with technical overlays
- `SignalCard` -- Signal display with direction indicator, strength bar, confidence
- `RiskGauge` -- Circular gauge for Sharpe/Sortino/drawdown metrics
- `PortfolioTable` -- Positions with real-time P&L
- `AlertFeed` -- Real-time alert stream with severity coloring
- `StrategyCard` -- Strategy overview with performance sparkline
- `MetricCard` -- KPI display card with trend indicator
- `MarketHeatmap` -- Sector/asset heatmap by daily performance

**Testing**:
- Unit: Vitest for all utility functions, hooks, stores
- Component: Vitest + Testing Library for component behavior
- E2E: Playwright for critical user flows (view portfolio, run backtest, toggle strategy)

### 4.2 `apps/engine` -- Quant Engine

**Framework**: Python 3.14, FastAPI, NumPy, Pandas, SciPy
**Testing**: pytest + pytest-asyncio + hypothesis (property-based testing)

**Module Structure**:
```
engine/
├── src/
│   ├── api/
│   │   ├── main.py           # FastAPI app setup
│   │   ├── routes/
│   │   │   ├── data.py       # Data ingestion endpoints
│   │   │   ├── strategies.py # Strategy endpoints
│   │   │   ├── backtest.py   # Backtesting endpoints
│   │   │   ├── risk.py       # Risk metrics endpoints
│   │   │   ├── orders.py     # Order management endpoints
│   │   │   └── portfolio.py  # Portfolio endpoints
│   │   └── deps.py           # Dependencies (DB, config)
│   ├── data/
│   │   ├── polygon_client.py
│   │   ├── alpha_vantage_client.py
│   │   ├── ingestion.py
│   │   └── corporate_actions.py
│   ├── strategies/
│   │   ├── base.py           # Abstract strategy protocol
│   │   ├── trend_following.py
│   │   ├── momentum.py
│   │   ├── value.py
│   │   ├── mean_reversion.py
│   │   ├── pairs_trading.py
│   │   └── composite.py
│   ├── risk/
│   │   ├── portfolio_construction.py  # Risk parity weighting
│   │   ├── volatility_targeting.py    # Vol scaling
│   │   ├── drawdown_control.py        # Circuit breakers
│   │   └── metrics.py                 # All risk metric calculations
│   ├── execution/
│   │   ├── broker_interface.py   # Abstract broker protocol
│   │   ├── paper_broker.py       # Paper trading engine
│   │   ├── alpaca_broker.py      # Alpaca adapter
│   │   ├── cost_model.py         # Implementation shortfall model
│   │   └── order_manager.py      # Order lifecycle
│   ├── backtest/
│   │   ├── engine.py             # Walk-forward backtester
│   │   ├── cost_simulator.py     # Transaction cost simulation
│   │   └── report.py             # Performance reports
│   ├── config.py                 # Settings via pydantic-settings
│   └── db.py                     # Supabase client wrapper
├── tests/
│   ├── unit/
│   │   ├── test_strategies/
│   │   ├── test_risk/
│   │   ├── test_execution/
│   │   └── test_backtest/
│   ├── integration/
│   │   ├── test_data_pipeline.py
│   │   ├── test_signal_generation.py
│   │   └── test_order_flow.py
│   └── conftest.py
├── pyproject.toml
└── requirements.txt
```

**Strategy Interface** (from PDF framework):
```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
import pandas as pd

@dataclass
class Signal:
    instrument_id: str
    direction: str  # 'long' | 'short' | 'flat'
    strength: float  # 0.0 to 1.0
    confidence: float
    metadata: dict

class Strategy(ABC):
    @abstractmethod
    def generate_signals(self, data: pd.DataFrame) -> list[Signal]: ...

    @abstractmethod
    def get_parameters(self) -> dict: ...

    @abstractmethod
    def validate_parameters(self, params: dict) -> bool: ...
```

**Broker Interface**:
```python
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class OrderRequest:
    instrument_id: str
    side: str
    order_type: str
    quantity: float
    limit_price: float | None = None
    stop_price: float | None = None

@dataclass
class OrderResult:
    order_id: str
    status: str
    fill_price: float | None = None
    fill_quantity: float | None = None
    commission: float = 0.0
    slippage: float | None = None

class BrokerAdapter(ABC):
    @abstractmethod
    async def submit_order(self, order: OrderRequest) -> OrderResult: ...

    @abstractmethod
    async def cancel_order(self, order_id: str) -> None: ...

    @abstractmethod
    async def get_positions(self) -> list[dict]: ...

    @abstractmethod
    async def get_account(self) -> dict: ...
```

### 4.3 `apps/agents` -- AI Agent Orchestrator

**Framework**: TypeScript, Claude Agent SDK, node-cron
**Testing**: Vitest + mock Claude responses

**Agents**:

| Agent | Schedule | Purpose | Tools |
|-------|----------|---------|-------|
| Market Sentinel | Every 15min (market hours) | Detect anomalies, volume spikes, volatility | read_market_data, check_volatility, write_alert |
| Strategy Analyst | Hourly + on-demand | Analyze signal confluence, regime detection | read_signals, read_risk_metrics, analyze_regime, write_commentary |
| Risk Monitor | Every 5min (market hours) | Watch drawdown, concentration, correlation | read_portfolio, read_risk_metrics, trigger_risk_alert, suggest_hedge |
| Research Agent | On-demand | Deep-dive analysis on tickers/theses | fetch_fundamentals, analyze_technicals, search_news, write_report |
| Execution Monitor | After order batches | Review fill quality vs cost model | read_orders, compare_fills, write_execution_report |

## 5. Risk Controls (Blueprint Layer B)

| Control | Threshold | Action |
|---------|-----------|--------|
| Volatility targeting | 20-day exponential vol | Scale position sizes inversely |
| Drawdown circuit breaker L1 | Portfolio DD > 10% | Reduce all positions by 50% |
| Drawdown circuit breaker L2 | Portfolio DD > 15% | Flatten to cash |
| Single position limit | > 5% of portfolio | Block new entries, flag for rebalance |
| Sector concentration | > 20% of portfolio | Block new same-sector entries |
| Strategy correlation | Pairwise corr > 0.7 | Alert, review diversification |
| Daily loss limit | > 2% of equity | Halt all new entries for the day |

## 6. Cost Model (Blueprint Layer C)

Implementation shortfall = Commissions + Spread + Impact + Opportunity Cost

```python
@dataclass
class CostEstimate:
    commission: float      # Broker fee schedule
    spread_cost: float     # half_spread * quantity
    impact_cost: float     # Estimated market impact (sqrt model)
    opportunity_cost: float # Expected adverse movement from delay
    total: float           # Sum of all components

def estimate_costs(
    quantity: float,
    price: float,
    avg_daily_volume: float,
    spread_bps: float = 5.0,
    commission_per_share: float = 0.0,
) -> CostEstimate: ...
```

## 7. Testing Strategy

### 7.1 Coverage Targets

| Layer | Target | Tool |
|-------|--------|------|
| Engine unit tests | > 90% | pytest + coverage |
| Engine integration | Key flows | pytest + test Supabase |
| Strategy logic | 100% | pytest + hypothesis |
| Risk calculations | 100% | pytest + known-value tests |
| Web components | > 80% | Vitest + Testing Library |
| Web E2E | Critical paths | Playwright |
| Agent tools | > 80% | Vitest + mocked Claude |

### 7.2 Testing Principles (from PDF)

- All strategy tests use known-value inputs with hand-calculated expected outputs
- Backtest tests verify no look-ahead bias (future data cannot leak into past signals)
- Cost model tests validate against published empirical ranges
- Risk metric tests use canonical datasets with known Sharpe/Sortino/drawdown
- Property-based tests (hypothesis) for numerical stability of all calculations

## 8. Build Phases

### Phase 1: Foundation
- Monorepo scaffolding (pnpm, Turborepo, TypeScript config)
- Supabase project + all migrations
- Data ingestion pipeline (Polygon.io client + ingestion scheduler)
- Basic Next.js dashboard with live price display
- Paper broker skeleton
- CI pipeline with linting + testing

### Phase 2: Strategy Engine
- All 5 strategy implementations with full test suites
- Signal generation pipeline
- Signal dashboard page
- Composite signal combiner

### Phase 3: Risk & Portfolio
- Risk metrics calculator
- Portfolio construction (risk parity)
- Volatility targeting + drawdown controls
- Portfolio dashboard with gauges + charts

### Phase 4: AI Agents
- Claude Agent SDK setup + tool definitions
- All 5 agents with scheduling
- Agent monitor dashboard
- Alert system with real-time toasts

### Phase 5: Backtesting
- Walk-forward backtest engine
- Cost simulation
- Backtest lab UI with equity curves + metrics
- Performance reports

### Phase 6: Live Trading Ready
- Alpaca broker adapter
- Execution quality monitoring
- Settings UI (API keys, broker toggle, risk limits)
- Go-live guardrails

## 9. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Market Data
POLYGON_API_KEY=
ALPHA_VANTAGE_API_KEY=

# AI
ANTHROPIC_API_KEY=

# Broker
BROKER_MODE=paper  # paper | live
ALPACA_API_KEY=
ALPACA_SECRET_KEY=
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Engine
ENGINE_URL=http://localhost:8000
ENGINE_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 10. Limitations & Disclaimers

Per the blueprint: no trading strategy guarantees profits. This system is a research and execution platform. Historical performance metrics are measurements, not forecasts. Post-publication decay means future performance may differ materially. The system includes paper trading specifically to validate strategies before risking real capital.
