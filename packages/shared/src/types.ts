// ─── Trading Policy (server-side settings) ──────────────────────────

/**
 * Risk limits and trading mode persisted in `user_trading_policy` table.
 * Values are percentages (e.g. 5 = 5%), not decimal fractions.
 */
export interface TradingPolicy {
  id: string;
  user_id: string;
  max_position_pct: number;
  max_sector_pct: number;
  daily_loss_limit_pct: number;
  soft_drawdown_pct: number;
  hard_drawdown_pct: number;
  max_open_positions: number;
  paper_trading: boolean;
  auto_trading: boolean;
  require_confirmation: boolean;
  created_at: string;
  updated_at: string;
}

/** Fields the client can update via PUT /api/settings/policy. */
export type TradingPolicyUpdate = Partial<
  Omit<TradingPolicy, 'id' | 'user_id' | 'created_at' | 'updated_at'>
>;

/** Default policy values matching engine risk_manager.py defaults. */
export const DEFAULT_TRADING_POLICY: Omit<
  TradingPolicy,
  'id' | 'user_id' | 'created_at' | 'updated_at'
> = {
  max_position_pct: 5,
  max_sector_pct: 20,
  daily_loss_limit_pct: 2,
  soft_drawdown_pct: 10,
  hard_drawdown_pct: 15,
  max_open_positions: 20,
  paper_trading: true,
  auto_trading: false,
  require_confirmation: true,
};

/** Entry in the policy_change_log audit table. */
export interface PolicyChangeEntry {
  id: string;
  user_id: string;
  changed_at: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
}

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

/* ── Notification Types ─────────────────────────────────── */

export type NotificationChannel = 'in_app' | 'email' | 'push';

export interface NotificationPreference {
  channel: NotificationChannel;
  enabled: boolean;
  /** For email: address. For push: subscription JSON. */
  target?: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  severity: AlertSeverity;
  /** Link to open when notification is clicked */
  actionUrl?: string;
  /** ID of the related recommendation or alert */
  sourceId?: string;
  sourceType?: 'recommendation' | 'alert';
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

// ─── Decision Journal ───────────────────────────────────────────────

/** Event types tracked in the decision journal. */
export type JournalEventType =
  | 'recommendation'
  | 'approval'
  | 'rejection'
  | 'fill'
  | 'risk_block'
  | 'cancellation'
  | 'policy_change'
  | 'manual_note';

/** User-assigned trade grade for post-trade review. */
export type TradeGrade = 'excellent' | 'good' | 'neutral' | 'bad' | 'terrible';

/**
 * A single decision journal entry — captures a moment in the trading
 * decision lifecycle along with market context, agent reasoning, and
 * optional post-trade outcome.
 *
 * Mirrors the `decision_journal` table in Supabase.
 */
export interface JournalEntry {
  id: string;
  user_id: string;
  event_type: JournalEventType;
  ticker: string | null;
  direction: string | null;
  quantity: number | null;
  price: number | null;
  agent_name: string | null;
  reasoning: string | null;
  confidence: number | null;
  strategy_name: string | null;
  market_regime: string | null;
  vix_at_time: number | null;
  sector: string | null;
  recommendation_id: string | null;
  order_id: string | null;
  signal_id: string | null;
  user_notes: string | null;
  user_grade: TradeGrade | null;
  outcome_pnl: number | null;
  outcome_return_pct: number | null;
  outcome_hold_minutes: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  graded_at: string | null;
}

/** Fields the client can provide when creating a journal entry. */
export type JournalEntryCreate = Omit<JournalEntry, 'id' | 'user_id' | 'created_at' | 'graded_at'>;

/** Fields the client can update (annotations + outcome grading). */
export interface JournalEntryUpdate {
  user_notes?: string;
  user_grade?: TradeGrade;
  outcome_pnl?: number;
  outcome_return_pct?: number;
  outcome_hold_minutes?: number;
}

/** Aggregate stats for the journal, computed from the journal_stats view. */
export interface JournalStats {
  total_entries: number;
  approvals: number;
  rejections: number;
  fills: number;
  risk_blocks: number;
  graded: number;
  avg_return_pct: number | null;
  winning_trades: number;
  losing_trades: number;
}

// ─── System Controls ────────────────────────────────────────────────

/** Global system operating mode. */
export type SystemMode = 'paper' | 'live' | 'backtest';

/** Autonomy level for strategies and the global system. */
export type AutonomyMode = 'disabled' | 'alert_only' | 'suggest' | 'auto_approve' | 'auto_execute';

/**
 * Centralized system configuration — single-row table.
 * Mirrors the `system_controls` table in Supabase.
 */
export interface SystemControls {
  id: string;
  trading_halted: boolean;
  live_execution_enabled: boolean;
  global_mode: SystemMode;
  max_daily_trades: number;
  autonomy_mode: AutonomyMode;
  previous_autonomy_mode: string | null;
  updated_at: string;
  updated_by: string | null;
}

/** Fields the client can update via PATCH /api/system-controls. */
export type SystemControlsUpdate = Partial<
  Omit<SystemControls, 'id' | 'updated_at' | 'updated_by'>
>;

// ─── Recommendation Events ──────────────────────────────────────────

/** Event types in the recommendation lifecycle state machine. */
export type RecommendationEventType =
  | 'created'
  | 'risk_checked'
  | 'risk_blocked'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'submitted'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'failed'
  | 'reviewed'
  | 'auto_approved'
  | 'auto_execution_denied';

/** Actor that caused a recommendation event. */
export type ActorType = 'system' | 'agent' | 'operator' | 'policy';

/**
 * A single event in a recommendation's lifecycle.
 * Mirrors the `recommendation_events` table.
 */
export interface RecommendationEvent {
  id: string;
  recommendation_id: string;
  event_type: RecommendationEventType;
  event_ts: string;
  actor_type: ActorType;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

// ─── Risk Evaluations ───────────────────────────────────────────────

/**
 * Audit record for a risk evaluation performed on a recommendation.
 * Mirrors the `risk_evaluations` table.
 */
export interface RiskEvaluation {
  id: string;
  recommendation_id: string;
  policy_version: string | null;
  allowed: boolean;
  original_quantity: number | null;
  adjusted_quantity: number | null;
  checks_performed: RiskCheck[];
  reason: string | null;
  evaluated_at: string;
  created_at: string;
}

/** Individual risk check within an evaluation. */
export interface RiskCheck {
  name: string;
  passed: boolean;
  limit: number | null;
  actual: number | null;
  message: string | null;
}

// ─── Fills ──────────────────────────────────────────────────────────

/**
 * Individual fill record for an order execution.
 * Mirrors the `fills` table.
 */
export interface Fill {
  id: string;
  order_id: string;
  fill_ts: string;
  fill_price: number;
  fill_qty: number;
  commission: number;
  slippage: number | null;
  venue: string | null;
  broker_fill_id: string | null;
  created_at: string;
}

// ─── Operator Actions ───────────────────────────────────────────────

/** Types of actions an operator can perform. */
export type OperatorActionType =
  | 'halt_trading'
  | 'resume_trading'
  | 'approve_recommendation'
  | 'reject_recommendation'
  | 'update_policy'
  | 'change_mode'
  | 'override_risk'
  | 'cancel_order'
  | 'manual_order'
  | 'role_change'
  | 'system_config_change'
  | 'incident_fallback';

/**
 * An auditable operator action.
 * Mirrors the `operator_actions` table.
 */
export interface OperatorAction {
  id: string;
  operator_id: string;
  action_type: OperatorActionType;
  target_type: string | null;
  target_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Signal Runs ────────────────────────────────────────────────────

/** Status of a signal scan run. */
export type SignalRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

// ─── Universe Restrictions ──────────────────────────────────────────

/** Restriction type for universe filtering. */
export type RestrictionType = 'whitelist' | 'blacklist';

/**
 * A universe restriction rule for symbol/sector/asset-class filtering.
 * Mirrors the `universe_restrictions` table.
 */
export interface UniverseRestriction {
  id: string;
  restriction_type: RestrictionType;
  symbols: string[];
  sectors: string[];
  asset_classes: string[];
  reason: string | null;
  enabled: boolean;
  created_at: string;
  created_by: string | null;
}

// ─── Incident State ─────────────────────────────────────────────────

/** State of the automatic incident fallback monitor. */
export interface IncidentState {
  isActive: boolean;
  triggeredAt: string | null;
  reason: string | null;
  previousMode: string | null;
  recoveryEligibleAt: string | null;
}

// ─── Workflow Jobs (Durable Workflow Engine) ─────────────────────────

/** Status of a workflow job. */
export type WorkflowJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'retrying';

/** Workflow type identifiers. */
export type WorkflowType =
  | 'recommendation_lifecycle'
  | 'order_execution'
  | 'risk_evaluation'
  | 'agent_cycle';

/** A durable workflow job tracked in the DB. */
export interface WorkflowJob {
  id: string;
  workflow_type: WorkflowType;
  idempotency_key: string | null;
  status: WorkflowJobStatus;
  current_step: string | null;
  steps_completed: string[];
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  error_message: string | null;
  error_count: number;
  max_retries: number;
  retry_after: string | null;
  started_at: string | null;
  completed_at: string | null;
  timeout_at: string | null;
  created_at: string;
  updated_at: string;
  recommendation_id: string | null;
  order_id: string | null;
  agent_run_id: string | null;
}

/** Step execution log entry. */
export type WorkflowStepStatus = 'started' | 'completed' | 'failed' | 'skipped';

export interface WorkflowStepLog {
  id: string;
  job_id: string;
  step_name: string;
  status: WorkflowStepStatus;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  error: string | null;
  duration_ms: number | null;
  executed_at: string;
}

/** Filters for querying workflow jobs. */
export interface WorkflowJobsFilters {
  workflow_type?: WorkflowType | undefined;
  status?: WorkflowJobStatus | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  sort_by?: 'created_at' | 'updated_at' | undefined;
  sort_direction?: 'asc' | 'desc' | undefined;
}

/** Summary stats for the workflows page. */
export interface WorkflowStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  retrying: number;
  cancelled: number;
  avg_duration_ms: number | null;
  failure_rate: number | null;
}

/**
 * Metadata for a signal scan execution.
 * Mirrors the `signal_runs` table.
 */
export interface SignalRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  requested_by: string;
  universe: string[];
  strategies: string[];
  days: number;
  min_strength: number;
  total_signals: number;
  status: SignalRunStatus;
  errors: unknown[];
  created_at: string;
}

// ─── Strategy Health ────────────────────────────────────────────────

/** Trend direction for a strategy health metric. */
export type HealthTrend = 'improving' | 'stable' | 'degrading';

/** Signal frequency trend direction. */
export type FrequencyTrend = 'increasing' | 'stable' | 'decreasing';

/** Composite health label for a strategy. */
export type HealthLabel = 'healthy' | 'warning' | 'critical' | 'inactive' | 'new';

/** Per-regime performance breakdown stored in JSONB. */
export interface RegimePerformance {
  [regime: string]: {
    win_rate: number | null;
    avg_return: number | null;
    trade_count: number;
  };
}

/**
 * A point-in-time health snapshot for a single strategy.
 * Mirrors `strategy_health_latest` view in Supabase.
 */
export interface StrategyHealthSnapshot {
  id: string;
  strategy_name: string;
  window_days: number;
  total_signals: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number | null;
  avg_return_pct: number | null;
  expectancy: number | null;
  sharpe_ratio: number | null;
  max_drawdown: number | null;
  profit_factor: number | null;
  avg_confidence: number | null;
  false_positive_rate: number | null;
  regime_performance: RegimePerformance;
  win_rate_trend: HealthTrend | null;
  expectancy_trend: HealthTrend | null;
  signal_freq_trend: FrequencyTrend | null;
  health_score: number | null;
  health_label: HealthLabel | null;
  computed_at: string;
  source: string;
}

// ─── Paper-Trading Experiment Types ─────────────────────────────────

/** Status of a two-phase paper-trading experiment. */
export type ExperimentStatus =
  | 'pending'
  | 'week1_shadow'
  | 'week2_execution'
  | 'completed'
  | 'aborted';

/** Phase within an experiment run. */
export type ExperimentPhase = 'week1_shadow' | 'week2_execution';

/** Go/No-Go verdict after experiment completion. */
export type ExperimentVerdict = 'go' | 'no_go' | 'inconclusive';

/**
 * A structured two-phase paper-trading experiment.
 * Week 1 runs in shadow mode, Week 2 runs bounded paper auto-execution.
 * Mirrors the `experiments` table.
 */
export interface Experiment {
  id: string;
  name: string;
  description: string | null;
  status: ExperimentStatus;
  config: Record<string, unknown>;

  week1_start: string | null;
  week1_end: string | null;
  week2_start: string | null;
  week2_end: string | null;

  max_daily_trades: number;
  max_position_value: number;
  signal_strength_threshold: number;
  max_total_exposure: number;
  initial_capital: number;

  halted: boolean;
  halt_reason: string | null;
  halted_at: string | null;

  verdict: ExperimentVerdict | null;
  verdict_reason: string | null;
  final_metrics: Record<string, unknown> | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Fields the client can set when creating an experiment. */
export type ExperimentCreate = Pick<
  Experiment,
  | 'name'
  | 'description'
  | 'max_daily_trades'
  | 'max_position_value'
  | 'signal_strength_threshold'
  | 'max_total_exposure'
  | 'initial_capital'
>;

/** Fields the client can update on an existing experiment. */
export type ExperimentUpdate = Partial<ExperimentCreate>;

/**
 * Daily performance snapshot for an experiment.
 * Mirrors the `experiment_snapshots` table.
 */
export interface ExperimentSnapshot {
  id: string;
  experiment_id: string;
  snapshot_date: string;
  phase: ExperimentPhase;

  equity: number;
  cash: number;
  positions_value: number;
  daily_pnl: number;
  cumulative_pnl: number;
  daily_return_pct: number;
  cumulative_return_pct: number;
  max_drawdown_pct: number;

  recommendations_generated: number;
  recommendations_executed: number;
  recommendations_blocked: number;
  orders_submitted: number;
  orders_filled: number;
  orders_rejected: number;

  sharpe_ratio: number | null;
  win_rate: number | null;
  profit_factor: number | null;
  avg_trade_return: number | null;

  cycle_count: number;
  error_count: number;
  avg_cycle_duration_ms: number | null;

  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Durable order record within an experiment (shadow or real).
 * Mirrors the `experiment_orders` table.
 */
export interface ExperimentOrder {
  id: string;
  experiment_id: string;
  recommendation_id: string | null;
  phase: ExperimentPhase;

  symbol: string;
  side: 'buy' | 'sell';
  order_type: string;
  quantity: number;
  limit_price: number | null;

  status: 'pending' | 'submitted' | 'filled' | 'partially_filled' | 'rejected' | 'cancelled';
  fill_price: number | null;
  fill_quantity: number | null;
  commission: number;
  slippage: number;
  broker_order_id: string | null;

  shadow_fill_price: number | null;
  shadow_pnl: number | null;
  is_shadow: boolean;

  risk_check_result: Record<string, unknown> | null;
  risk_note: string | null;

  submitted_at: string;
  filled_at: string | null;
  created_at: string;
}

/** Verdict thresholds for go/no-go decision. */
export const EXPERIMENT_VERDICT_THRESHOLDS = {
  go: {
    min_sharpe: 0.5,
    max_drawdown_pct: 15,
    min_win_rate: 0.4,
    max_error_rate: 0.05,
  },
  no_go: {
    min_sharpe: 0,
    max_drawdown_pct: 25,
    max_error_rate: 0.2,
  },
} as const;

// ─── Customer Onboarding ────────────────────────────────────────────

import type { OnboardingStep } from './onboarding-state';

/** Customer identity and onboarding state from `customer_profiles` table. */
export interface CustomerProfile {
  user_id: string;
  legal_name: string | null;
  date_of_birth: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  tax_residency: string | null;
  citizenship: string | null;
  onboarding_step: OnboardingStep;
  created_at: string;
  updated_at: string;
}

/** Fields the client can update via the onboarding profile endpoint. */
export type CustomerProfileUpdate = Partial<
  Omit<CustomerProfile, 'user_id' | 'created_at' | 'updated_at'>
>;

/** Versioned consent record from `consents` table. */
export interface Consent {
  id: string;
  user_id: string;
  document_type: ConsentDocumentType;
  document_version: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  broker_account_id: string | null;
  revoked_at: string | null;
}

/** Known consent document types. */
export type ConsentDocumentType =
  | 'terms_of_service'
  | 'privacy_policy'
  | 'electronic_delivery'
  | 'customer_agreement'
  | 'data_sharing'
  | 'broker_disclosures';

/** Payload for recording a new consent. */
export interface ConsentRecord {
  document_type: ConsentDocumentType;
  document_version: string;
}

/** Read-only external portfolio link from `external_portfolio_links` table. */
export interface ExternalPortfolioLink {
  id: string;
  user_id: string;
  provider: string;
  external_item_id: string;
  institution_name: string | null;
  status: 'active' | 'disconnected' | 'error';
  read_only: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Onboarding audit log entry from `onboarding_audit_log` table. */
export interface OnboardingAuditEntry {
  id: string;
  user_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}
