-- ============================================
-- Sentinel Trading Platform - Initial Schema
-- Applied to Supabase project: luwyjfwauljwsfsnwiqb
-- ============================================

-- Accounts (paper, live, etc.)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  broker TEXT NOT NULL DEFAULT 'paper' CHECK (broker IN ('paper', 'alpaca')),
  initial_capital NUMERIC(18,2) NOT NULL DEFAULT 100000,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

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

-- Time-series market data
CREATE TABLE market_data (
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
  PRIMARY KEY (instrument_id, timestamp, timeframe)
);

-- Strategy definitions
CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  family TEXT NOT NULL CHECK (family IN ('trend', 'momentum', 'value', 'mean_reversion', 'pairs', 'composite')),
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
  user_id UUID NOT NULL REFERENCES auth.users(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
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
  user_id UUID NOT NULL REFERENCES auth.users(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  signal_id UUID REFERENCES signals(id),
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit', 'stop', 'stop_limit')),
  quantity NUMERIC(18,6) NOT NULL,
  limit_price NUMERIC(18,6),
  stop_price NUMERIC(18,6),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'partial', 'filled', 'cancelled', 'rejected')),
  broker TEXT NOT NULL DEFAULT 'paper' CHECK (broker IN ('paper', 'alpaca')),
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
  user_id UUID NOT NULL REFERENCES auth.users(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  quantity NUMERIC(18,6) NOT NULL,
  avg_entry_price NUMERIC(18,6) NOT NULL,
  realized_pnl NUMERIC(18,6) DEFAULT 0,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  opened_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Portfolio snapshots (daily)
CREATE TABLE portfolio_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
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

-- Risk metrics
CREATE TABLE risk_metrics (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
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
  user_id UUID NOT NULL REFERENCES auth.users(id),
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
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Watchlist items (junction table)
CREATE TABLE watchlist_items (
  watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (watchlist_id, instrument_id)
);

-- Trades (matched entry+exit for P&L attribution)
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  strategy_id UUID REFERENCES strategies(id),
  entry_order_id UUID REFERENCES orders(id),
  exit_order_id UUID REFERENCES orders(id),
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  quantity NUMERIC(18,6) NOT NULL,
  entry_price NUMERIC(18,6) NOT NULL,
  exit_price NUMERIC(18,6),
  gross_pnl NUMERIC(18,6),
  total_costs NUMERIC(18,6) DEFAULT 0,
  net_pnl NUMERIC(18,6),
  return_pct NUMERIC(10,6),
  holding_period_days INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
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
