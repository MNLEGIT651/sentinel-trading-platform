// ─── Enums as Union Types ───────────────────────────────────────────

export type AssetClass = "equity" | "etf" | "option" | "crypto" | "future";
export type Exchange = "NYSE" | "NASDAQ" | "AMEX" | "ARCA" | "BATS" | "OTC";
export type SignalDirection = "long" | "short" | "close";
export type SignalStrength = "strong" | "moderate" | "weak";
export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type OrderStatus =
  | "pending"
  | "submitted"
  | "partial"
  | "filled"
  | "cancelled"
  | "rejected"
  | "expired";
export type BrokerMode = "paper" | "live";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "active" | "acknowledged" | "resolved";
export type Timeframe =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "4h"
  | "1d"
  | "1w"
  | "1M";

// ─── Database Row Types ─────────────────────────────────────────────

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  asset_class: AssetClass;
  exchange: Exchange;
  is_active: boolean;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface MarketDataRow {
  id: string;
  instrument_id: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number | null;
  trade_count: number | null;
  timeframe: Timeframe;
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
  broker_mode: BrokerMode;
  buying_power: number;
  cash: number;
  portfolio_value: number;
  equity: number;
  last_synced_at: string;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Signal {
  id: string;
  instrument_id: string;
  strategy_id: string;
  direction: SignalDirection;
  strength: SignalStrength;
  confidence: number;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  metadata: Record<string, unknown> | null;
  generated_at: string;
  expires_at: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  signal_id: string | null;
  instrument_id: string;
  account_id: string;
  side: OrderSide;
  order_type: OrderType;
  status: OrderStatus;
  quantity: number;
  filled_quantity: number;
  limit_price: number | null;
  stop_price: number | null;
  filled_avg_price: number | null;
  broker_order_id: string | null;
  submitted_at: string;
  filled_at: string | null;
  cancelled_at: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioPosition {
  id: string;
  account_id: string;
  instrument_id: string;
  quantity: number;
  avg_entry_price: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  cost_basis: number;
  last_updated_at: string;
  created_at: string;
}

export interface PortfolioSnapshot {
  id: string;
  account_id: string;
  total_value: number;
  cash: number;
  positions_value: number;
  daily_pnl: number;
  daily_pnl_pct: number;
  total_pnl: number;
  total_pnl_pct: number;
  snapshot_at: string;
  created_at: string;
}

export interface RiskMetrics {
  id: string;
  account_id: string;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  max_drawdown: number | null;
  max_drawdown_pct: number | null;
  var_95: number | null;
  var_99: number | null;
  beta: number | null;
  alpha: number | null;
  volatility: number | null;
  win_rate: number | null;
  profit_factor: number | null;
  calculated_at: string;
  created_at: string;
}

export interface Alert {
  id: string;
  account_id: string | null;
  instrument_id: string | null;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  triggered_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string | null;
  version: string;
  is_active: boolean;
  parameters: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── API Response Types ─────────────────────────────────────────────

export interface EngineResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  timestamp: string;
}

export interface IngestResult {
  symbol: string;
  rows_inserted: number;
  timeframe: Timeframe;
  from_date: string;
  to_date: string;
}

export interface LatestPrices {
  prices: Record<
    string,
    {
      price: number;
      change: number;
      change_pct: number;
      volume: number;
      timestamp: string;
    }
  >;
  as_of: string;
}
