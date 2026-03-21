// ─── Enums as Union Types ───────────────────────────────────────────

/** The class of financial instrument being traded or tracked. */
export type AssetClass = 'equity' | 'etf' | 'option' | 'crypto' | 'future';

/**
 * Exchange or venue on which an instrument is listed.
 * OTC covers over-the-counter securities not listed on a formal exchange.
 */
export type Exchange = 'NYSE' | 'NASDAQ' | 'AMEX' | 'ARCA' | 'BATS' | 'OTC';

/**
 * The directional bias of a trading signal.
 * - `long`  — bullish: expect price to rise; open or hold a buy position.
 * - `short` — bearish: expect price to fall; open or hold a sell/short position.
 * - `close` — neutral: exit the current position in either direction.
 */
export type SignalDirection = 'long' | 'short' | 'close';

/**
 * Qualitative label for how strongly the engine rates a signal.
 * Maps to confidence bands: `strong` ≥ 0.75, `moderate` 0.50–0.74, `weak` < 0.50.
 */
export type SignalStrength = 'strong' | 'moderate' | 'weak';

/** The side of a trade from the perspective of the account owner. */
export type OrderSide = 'buy' | 'sell';

/**
 * Execution instruction for an order.
 * - `market`     — fill at best available price immediately.
 * - `limit`      — fill only at `limit_price` or better.
 * - `stop`       — become a market order when `stop_price` is touched.
 * - `stop_limit` — become a limit order when `stop_price` is touched.
 */
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';

/**
 * Lifecycle state of an order at the broker.
 * - `pending`   — created locally, not yet submitted to the broker.
 * - `submitted` — sent to the broker, awaiting acknowledgement.
 * - `partial`   — partially filled; `filled_quantity` < `quantity`.
 * - `filled`    — fully executed; `filled_quantity` === `quantity`.
 * - `cancelled` — cancelled before full fill.
 * - `rejected`  — broker rejected the order (see `meta` for reason).
 * - `expired`   — order lapsed without filling (e.g. day order past market close).
 */
export type OrderStatus =
  | 'pending'
  | 'submitted'
  | 'partial'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'expired';

/**
 * Trading environment.
 * - `paper` — simulated execution; no real money at risk.
 * - `live`  — real brokerage account; orders execute against live markets.
 */
export type BrokerMode = 'paper' | 'live';

/**
 * Urgency level of a system or trading alert.
 * - `info`     — informational; no action required.
 * - `warning`  — degraded condition; review recommended.
 * - `critical` — requires immediate operator attention.
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Lifecycle state of an alert.
 * - `active`       — alert is firing and unacknowledged.
 * - `acknowledged` — an operator has seen the alert but it has not been resolved.
 * - `resolved`     — the underlying condition has cleared.
 */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

/**
 * Candlestick bar interval.
 * Values follow the convention `<quantity><unit>` where unit is:
 * `m` = minute, `h` = hour, `d` = day, `w` = week, `M` = month.
 */
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';

// ─── Database Row Types ─────────────────────────────────────────────

/**
 * A tradable financial instrument registered in the platform.
 * Mirrors the `instruments` table in Supabase.
 */
export interface Instrument {
  /** UUID primary key. */
  id: string;
  /** Ticker symbol (e.g. `"AAPL"`, `"BTC/USD"`). Unique per exchange. */
  symbol: string;
  /** Human-readable display name (e.g. `"Apple Inc."`). */
  name: string;
  /** Broad category of the instrument. */
  asset_class: AssetClass;
  /** Primary listing venue. */
  exchange: Exchange;
  /** Whether the instrument is eligible for signal generation and trading. */
  is_active: boolean;
  /** Arbitrary provider-specific metadata (sector, ISIN, etc.). Nullable. */
  meta: Record<string, unknown> | null;
  /** ISO 8601 creation timestamp. */
  created_at: string;
  /** ISO 8601 last-updated timestamp. */
  updated_at: string;
}

/**
 * A single OHLCV candle stored in the `market_data` table.
 * Each row represents one completed bar for a given instrument and timeframe.
 */
export interface MarketDataRow {
  /** UUID primary key. */
  id: string;
  /** Foreign key → `instruments.id`. */
  instrument_id: string;
  /** Bar open time as an ISO 8601 timestamp (UTC). */
  timestamp: string;
  /** Opening price for the bar. */
  open: number;
  /** Highest traded price during the bar. */
  high: number;
  /** Lowest traded price during the bar. */
  low: number;
  /** Closing price for the bar. */
  close: number;
  /** Total shares/contracts/units traded during the bar. */
  volume: number;
  /** Volume-weighted average price for the bar. `null` if not provided by the data source. */
  vwap: number | null;
  /** Number of individual trades executed during the bar. `null` if not provided. */
  trade_count: number | null;
  /** Candlestick interval this row represents. */
  timeframe: Timeframe;
  /** Data provider identifier (e.g. `"alpaca"`, `"polygon"`). */
  source: string;
  /** ISO 8601 row insertion timestamp. */
  created_at: string;
}

/**
 * Lightweight OHLCV tuple used in-memory by the engine and agents.
 * Omits database identity fields — prefer this type in computation contexts
 * and {@link MarketDataRow} for persistence contexts.
 */
export interface OHLCV {
  /** Bar open time as an ISO 8601 timestamp (UTC). */
  timestamp: string;
  /** Opening price. */
  open: number;
  /** High price. */
  high: number;
  /** Low price. */
  low: number;
  /** Closing price. */
  close: number;
  /** Volume traded. */
  volume: number;
}

/**
 * Brokerage account snapshot synced from the broker API.
 * Mirrors the `accounts` table. One row per broker connection per user.
 */
export interface Account {
  /** UUID primary key. */
  id: string;
  /** Whether this account operates in paper or live mode. */
  broker_mode: BrokerMode;
  /** Settled cash plus margin available for new purchases (broker-reported). */
  buying_power: number;
  /** Settled cash balance. */
  cash: number;
  /** Total portfolio value: cash + market value of all open positions. */
  portfolio_value: number;
  /** Equity value (portfolio value minus margin used). */
  equity: number;
  /** ISO 8601 timestamp of the most recent broker sync. */
  last_synced_at: string;
  /** Broker-specific extended fields (account type, margin ratios, etc.). Nullable. */
  meta: Record<string, unknown> | null;
  /** ISO 8601 creation timestamp. */
  created_at: string;
  /** ISO 8601 last-updated timestamp. */
  updated_at: string;
}

/**
 * A directional trading signal produced by a strategy.
 * Signals are advisory — they do not trigger orders automatically unless
 * the orchestrator's auto-trade mode is enabled for the associated strategy.
 *
 * Mirrors the `signals` table.
 */
export interface Signal {
  /** UUID primary key. */
  id: string;
  /** Foreign key → `instruments.id`. */
  instrument_id: string;
  /** Foreign key → `strategies.id`. */
  strategy_id: string;
  /** Directional recommendation from the strategy. */
  direction: SignalDirection;
  /** Qualitative intensity rating. See {@link SignalStrength} for band definitions. */
  strength: SignalStrength;
  /**
   * Model confidence score in the range [0, 1].
   * 0 = no confidence, 1 = maximum confidence.
   * Correlates with `strength`: strong ≥ 0.75, moderate 0.50–0.74, weak < 0.50.
   */
  confidence: number;
  /** Suggested entry price. `null` if the strategy does not specify an entry. */
  entry_price: number | null;
  /** Suggested stop-loss price. `null` if the strategy does not use stops. */
  stop_loss: number | null;
  /** Suggested take-profit target. `null` if the strategy does not use targets. */
  take_profit: number | null;
  /** Strategy-specific diagnostic data (indicator values, feature importances, etc.). Nullable. */
  metadata: Record<string, unknown> | null;
  /** ISO 8601 timestamp when the strategy generated this signal. */
  generated_at: string;
  /** ISO 8601 timestamp after which the signal should be considered stale. `null` = no expiry. */
  expires_at: string | null;
  /** ISO 8601 row insertion timestamp. */
  created_at: string;
}

/**
 * A buy or sell order submitted (or pending submission) to the broker.
 * Mirrors the `orders` table.
 */
export interface Order {
  /** UUID primary key. */
  id: string;
  /** Foreign key → `signals.id`. `null` if the order was placed manually. */
  signal_id: string | null;
  /** Foreign key → `instruments.id`. */
  instrument_id: string;
  /** Foreign key → `accounts.id`. */
  account_id: string;
  /** Buy or sell. */
  side: OrderSide;
  /** Execution instruction. */
  order_type: OrderType;
  /** Current lifecycle state at the broker. */
  status: OrderStatus;
  /** Total number of shares/contracts/units requested. */
  quantity: number;
  /** Number of shares/contracts/units executed so far. 0 until `partial` or `filled`. */
  filled_quantity: number;
  /** Limit price for `limit` and `stop_limit` orders. `null` otherwise. */
  limit_price: number | null;
  /** Stop trigger price for `stop` and `stop_limit` orders. `null` otherwise. */
  stop_price: number | null;
  /** Average execution price across all fills. `null` until at least one fill occurs. */
  filled_avg_price: number | null;
  /** Broker-assigned order identifier for reconciliation. `null` until submitted. */
  broker_order_id: string | null;
  /** ISO 8601 timestamp when the order was sent to the broker. */
  submitted_at: string;
  /** ISO 8601 timestamp of final fill. `null` until fully filled. */
  filled_at: string | null;
  /** ISO 8601 timestamp of cancellation. `null` unless cancelled. */
  cancelled_at: string | null;
  /** Broker-specific extended fields (order tags, routing instructions, etc.). Nullable. */
  meta: Record<string, unknown> | null;
  /** ISO 8601 creation timestamp. */
  created_at: string;
  /** ISO 8601 last-updated timestamp. */
  updated_at: string;
}

/**
 * Current open position in an account for a single instrument.
 * Mirrors the `portfolio_positions` table.
 * Rows are upserted on each broker sync; a position row is removed when quantity reaches 0.
 */
export interface PortfolioPosition {
  /** UUID primary key. */
  id: string;
  /** Foreign key → `accounts.id`. */
  account_id: string;
  /** Foreign key → `instruments.id`. */
  instrument_id: string;
  /** Number of shares/contracts/units currently held. Negative values indicate short positions. */
  quantity: number;
  /** Average cost per unit across all fills that opened this position. */
  avg_entry_price: number;
  /** Most recent market price used to mark the position to market. */
  current_price: number;
  /** Current market value: `quantity × current_price`. */
  market_value: number;
  /** Unrealized profit/loss in currency: `market_value − cost_basis`. */
  unrealized_pnl: number;
  /** Unrealized profit/loss as a fraction of cost basis, e.g. `0.05` = 5%. */
  unrealized_pnl_pct: number;
  /** Total cost to acquire the current position: `quantity × avg_entry_price`. */
  cost_basis: number;
  /** ISO 8601 timestamp of the last mark-to-market update. */
  last_updated_at: string;
  /** ISO 8601 creation timestamp. */
  created_at: string;
}

/**
 * Point-in-time portfolio summary captured periodically for performance tracking.
 * Mirrors the `portfolio_snapshots` table.
 * Used to calculate equity curves, drawdown, and attribution charts in the UI.
 */
export interface PortfolioSnapshot {
  /** UUID primary key. */
  id: string;
  /** Foreign key → `accounts.id`. */
  account_id: string;
  /** Total portfolio value at snapshot time: `cash + positions_value`. */
  total_value: number;
  /** Cash balance at snapshot time. */
  cash: number;
  /** Aggregate market value of all open positions at snapshot time. */
  positions_value: number;
  /** Intraday profit/loss in currency (since the previous market open). */
  daily_pnl: number;
  /** Intraday profit/loss as a fraction of prior-day close value, e.g. `0.012` = 1.2%. */
  daily_pnl_pct: number;
  /** Cumulative profit/loss in currency since account inception. */
  total_pnl: number;
  /** Cumulative profit/loss as a fraction of initial deposit, e.g. `0.15` = 15%. */
  total_pnl_pct: number;
  /** ISO 8601 timestamp when this snapshot was captured. */
  snapshot_at: string;
  /** ISO 8601 row insertion timestamp. */
  created_at: string;
}

/**
 * Computed risk and performance statistics for an account over a rolling window.
 * Mirrors the `risk_metrics` table. Recalculated by the engine on each close cycle.
 *
 * All ratio fields are `null` when insufficient history is available (< 30 trading days).
 */
export interface RiskMetrics {
  /** UUID primary key. */
  id: string;
  /** Foreign key → `accounts.id`. */
  account_id: string;
  /**
   * Sharpe ratio: annualized excess return divided by annualized volatility.
   * Higher is better; > 1.0 is generally considered acceptable.
   * `null` if < 30 trading days of history.
   */
  sharpe_ratio: number | null;
  /**
   * Sortino ratio: like Sharpe but penalizes only downside volatility.
   * A better measure for strategies that have asymmetric return distributions.
   * `null` if < 30 trading days of history.
   */
  sortino_ratio: number | null;
  /**
   * Maximum peak-to-trough drawdown in currency over the measurement window.
   * Always ≤ 0 (negative value or zero).
   * `null` if < 30 trading days of history.
   */
  max_drawdown: number | null;
  /**
   * Maximum drawdown expressed as a fraction of the peak value, e.g. `-0.15` = −15%.
   * Always ≤ 0.
   * `null` if < 30 trading days of history.
   */
  max_drawdown_pct: number | null;
  /**
   * Value at Risk at 95% confidence: the loss not expected to be exceeded
   * on 95% of trading days, expressed as a positive currency amount.
   * `null` if < 30 trading days of history.
   */
  var_95: number | null;
  /**
   * Value at Risk at 99% confidence. More conservative than `var_95`.
   * `null` if < 30 trading days of history.
   */
  var_99: number | null;
  /**
   * Portfolio beta relative to the benchmark (typically SPY).
   * 1.0 = moves in line with the market; > 1.0 = more volatile; < 1.0 = less volatile.
   * `null` if < 30 trading days of history.
   */
  beta: number | null;
  /**
   * Jensen's alpha: risk-adjusted excess return relative to the benchmark.
   * Positive alpha indicates outperformance on a risk-adjusted basis.
   * `null` if < 30 trading days of history.
   */
  alpha: number | null;
  /**
   * Annualized standard deviation of daily returns.
   * Expressed as a decimal fraction, e.g. `0.20` = 20% annualized volatility.
   * `null` if < 30 trading days of history.
   */
  volatility: number | null;
  /**
   * Proportion of closed trades that resulted in a profit, in the range [0, 1].
   * e.g. `0.60` = 60% of trades were winners.
   * `null` if no closed trades exist.
   */
  win_rate: number | null;
  /**
   * Ratio of gross profit to gross loss across all closed trades.
   * > 1.0 means winners collectively outpace losers.
   * `null` if no losing trades exist (division by zero guard).
   */
  profit_factor: number | null;
  /** ISO 8601 timestamp when these metrics were last computed by the engine. */
  calculated_at: string;
  /** ISO 8601 row insertion timestamp. */
  created_at: string;
}

/**
 * A system or strategy-generated alert surfaced to the operator.
 * Mirrors the `alerts` table.
 * Alerts may be account-level, instrument-level, or platform-wide (both FKs nullable).
 */
export interface Alert {
  /** UUID primary key. */
  id: string;
  /** Foreign key → `accounts.id`. `null` for platform-wide alerts. */
  account_id: string | null;
  /** Foreign key → `instruments.id`. `null` for alerts not tied to a specific instrument. */
  instrument_id: string | null;
  /** Urgency classification. */
  severity: AlertSeverity;
  /** Current lifecycle state. */
  status: AlertStatus;
  /** Short human-readable summary (displayed in notification banners). */
  title: string;
  /** Full descriptive message with context and suggested action. */
  message: string;
  /** Strategy or system diagnostic payload (thresholds crossed, indicator values, etc.). Nullable. */
  metadata: Record<string, unknown> | null;
  /** ISO 8601 timestamp when the alerting condition was first detected. */
  triggered_at: string;
  /** ISO 8601 timestamp when an operator acknowledged the alert. `null` if unacknowledged. */
  acknowledged_at: string | null;
  /** ISO 8601 timestamp when the alert was resolved. `null` if still active or acknowledged. */
  resolved_at: string | null;
  /** ISO 8601 row insertion timestamp. */
  created_at: string;
}

/**
 * A named trading strategy registered with the platform.
 * Mirrors the `strategies` table.
 * The `parameters` field is strategy-specific; the engine uses it when running scans and backtests.
 */
export interface Strategy {
  /** UUID primary key. */
  id: string;
  /** Unique human-readable name (e.g. `"Momentum-RSI-v2"`). */
  name: string;
  /** Optional long-form description of the strategy logic and intended use. */
  description: string | null;
  /** Semantic version string (e.g. `"2.1.0"`). Increment on parameter schema changes. */
  version: string;
  /** Whether the strategy is eligible for live signal generation. Inactive strategies are archived. */
  is_active: boolean;
  /**
   * Strategy-specific configuration passed to the engine at runtime.
   * Schema is validated by the engine; unknown keys are ignored.
   * Example: `{ "rsi_period": 14, "rsi_overbought": 70, "lookback_days": 90 }`.
   */
  parameters: Record<string, unknown>;
  /** ISO 8601 creation timestamp. */
  created_at: string;
  /** ISO 8601 last-updated timestamp. */
  updated_at: string;
}

// ─── API Response Types ─────────────────────────────────────────────

/**
 * Standard envelope returned by all engine HTTP endpoints.
 * Consumers should check `success` before accessing `data`.
 *
 * @template T The shape of the payload on a successful response.
 */
export interface EngineResponse<T> {
  /** `true` if the request completed without error. */
  success: boolean;
  /** Response payload. Non-null when `success` is `true`; `null` on error. */
  data: T | null;
  /** Human-readable error description. Non-null when `success` is `false`; `null` on success. */
  error: string | null;
  /** ISO 8601 server timestamp at response generation time. */
  timestamp: string;
}

/**
 * Result returned by the engine's market-data ingest endpoint after a successful import.
 * One `IngestResult` is emitted per (symbol, timeframe) combination.
 */
export interface IngestResult {
  /** Ticker symbol that was ingested. */
  symbol: string;
  /** Number of new OHLCV rows inserted (duplicate rows are skipped). */
  rows_inserted: number;
  /** Timeframe of the ingested bars. */
  timeframe: Timeframe;
  /** ISO 8601 date of the earliest bar included in this import. */
  from_date: string;
  /** ISO 8601 date of the latest bar included in this import. */
  to_date: string;
}

/**
 * Latest price snapshot for one or more instruments, returned by the engine's
 * `/market-data/latest` endpoint. Keyed by ticker symbol.
 */
export interface LatestPrices {
  /**
   * Map of ticker symbol → latest price data.
   * - `price`      — most recent trade price.
   * - `change`     — price change in currency from the previous close.
   * - `change_pct` — price change as a decimal fraction, e.g. `0.012` = +1.2%.
   * - `volume`     — cumulative volume traded today.
   * - `timestamp`  — ISO 8601 timestamp of the most recent trade used to compute these values.
   */
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
  /** ISO 8601 timestamp when this snapshot was assembled by the engine. */
  as_of: string;
}
