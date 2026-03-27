-- ============================================================================
-- Migration 00008: Strategy Health Snapshots
-- ============================================================================
-- Rolling performance metrics per strategy for health monitoring.
-- Snapshots are computed periodically (by engine or agents) and stored
-- as time-series data so we can detect drift, decay, and regime sensitivity.
-- ============================================================================

-- ── Strategy health snapshots ───────────────────────────────────────────────

CREATE TABLE strategy_health_snapshots (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_name   TEXT          NOT NULL,
  -- Rolling window metrics
  window_days     INTEGER       NOT NULL DEFAULT 30,
  total_signals   INTEGER       NOT NULL DEFAULT 0,
  total_trades    INTEGER       NOT NULL DEFAULT 0,
  winning_trades  INTEGER       NOT NULL DEFAULT 0,
  losing_trades   INTEGER       NOT NULL DEFAULT 0,
  win_rate        NUMERIC(5,4),                         -- 0.0000–1.0000
  avg_return_pct  NUMERIC(10,4),
  expectancy      NUMERIC(10,4),                        -- (avg_win × win_rate) − (avg_loss × loss_rate)
  sharpe_ratio    NUMERIC(8,4),
  max_drawdown    NUMERIC(8,6),
  profit_factor   NUMERIC(8,4),                         -- gross_profit / gross_loss
  avg_confidence  NUMERIC(5,4),                         -- average signal confidence
  false_positive_rate NUMERIC(5,4),                     -- signals that led to losses / total signals
  -- Regime breakdown (JSONB for flexibility)
  regime_performance JSONB      DEFAULT '{}',           -- { "bull": { win_rate, avg_return }, ... }
  -- Trend indicators
  win_rate_trend     TEXT       CHECK (win_rate_trend IS NULL OR win_rate_trend IN ('improving', 'stable', 'degrading')),
  expectancy_trend   TEXT       CHECK (expectancy_trend IS NULL OR expectancy_trend IN ('improving', 'stable', 'degrading')),
  signal_freq_trend  TEXT       CHECK (signal_freq_trend IS NULL OR signal_freq_trend IN ('increasing', 'stable', 'decreasing')),
  -- Health score (composite 0–100)
  health_score       INTEGER    CHECK (health_score IS NULL OR (health_score >= 0 AND health_score <= 100)),
  health_label       TEXT       CHECK (health_label IS NULL OR health_label IN ('healthy', 'warning', 'critical', 'inactive', 'new')),
  -- Metadata
  computed_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  source          TEXT          NOT NULL DEFAULT 'system'  -- 'system', 'backtest', 'manual'
);

-- Indexes for efficient querying
CREATE INDEX idx_health_strategy_time
  ON strategy_health_snapshots (strategy_name, computed_at DESC);

CREATE INDEX idx_health_score
  ON strategy_health_snapshots (health_score DESC NULLS LAST);

CREATE INDEX idx_health_label
  ON strategy_health_snapshots (health_label);

-- ── Latest health view ──────────────────────────────────────────────────────
-- Returns the most recent snapshot per strategy (convenience view for the API).

CREATE OR REPLACE VIEW strategy_health_latest AS
SELECT DISTINCT ON (strategy_name)
  id,
  strategy_name,
  window_days,
  total_signals,
  total_trades,
  winning_trades,
  losing_trades,
  win_rate,
  avg_return_pct,
  expectancy,
  sharpe_ratio,
  max_drawdown,
  profit_factor,
  avg_confidence,
  false_positive_rate,
  regime_performance,
  win_rate_trend,
  expectancy_trend,
  signal_freq_trend,
  health_score,
  health_label,
  computed_at,
  source
FROM strategy_health_snapshots
ORDER BY strategy_name, computed_at DESC;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Strategy health is system-wide data, readable by any authenticated user.

ALTER TABLE strategy_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read strategy health"
  ON strategy_health_snapshots
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage strategy health"
  ON strategy_health_snapshots
  FOR ALL
  USING (auth.role() = 'service_role');

-- ── Realtime ────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE strategy_health_snapshots;
