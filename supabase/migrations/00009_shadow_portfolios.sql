-- Shadow Portfolios: alternate-config paper portfolios for champion-challenger comparison
-- Each shadow portfolio stores an alternate risk policy and strategy selection
-- so the operator can track "what if I had different settings?"

-- ─── Shadow portfolio definitions ─────────────────────────────────────────────
CREATE TABLE shadow_portfolios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Descriptive
  name          TEXT NOT NULL,
  description   TEXT,

  -- Alternate risk policy (overrides from user_trading_policy)
  -- Only non-null fields override the user's primary policy
  max_position_pct      NUMERIC,
  max_sector_pct        NUMERIC,
  daily_loss_limit_pct  NUMERIC,
  soft_drawdown_pct     NUMERIC,
  hard_drawdown_pct     NUMERIC,
  max_open_positions    INTEGER,

  -- Strategy configuration
  enabled_strategies    TEXT[] NOT NULL DEFAULT '{}',
  disabled_strategies   TEXT[] NOT NULL DEFAULT '{}',

  -- Simulated capital
  initial_capital       NUMERIC(18,2) NOT NULL DEFAULT 100000,

  -- Status
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shadow_portfolios_user ON shadow_portfolios (user_id, is_active);

-- Trigger for updated_at
CREATE TRIGGER set_shadow_portfolios_updated_at
  BEFORE UPDATE ON shadow_portfolios
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ─── Shadow portfolio snapshots (periodic performance tracking) ───────────────
CREATE TABLE shadow_portfolio_snapshots (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shadow_portfolio_id   UUID NOT NULL REFERENCES shadow_portfolios(id) ON DELETE CASCADE,

  -- Performance at snapshot time
  snapshot_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  equity                NUMERIC(18,2) NOT NULL DEFAULT 0,
  cash                  NUMERIC(18,2) NOT NULL DEFAULT 0,
  positions_value       NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_pnl             NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_return_pct      NUMERIC(8,4) NOT NULL DEFAULT 0,
  positions_count       INTEGER NOT NULL DEFAULT 0,
  max_drawdown_pct      NUMERIC(8,4) NOT NULL DEFAULT 0,

  -- What signals were included under this config
  signals_generated     INTEGER NOT NULL DEFAULT 0,
  signals_approved      INTEGER NOT NULL DEFAULT 0,
  signals_blocked       INTEGER NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shadow_snapshots_portfolio
  ON shadow_portfolio_snapshots (shadow_portfolio_id, snapshot_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE shadow_portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own shadow portfolios"
  ON shadow_portfolios FOR ALL
  USING (auth.uid() = user_id);

ALTER TABLE shadow_portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own shadow snapshots"
  ON shadow_portfolio_snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM shadow_portfolios sp
      WHERE sp.id = shadow_portfolio_snapshots.shadow_portfolio_id
        AND sp.user_id = auth.uid()
    )
  );

-- ─── Realtime ─────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE shadow_portfolios;
ALTER PUBLICATION supabase_realtime ADD TABLE shadow_portfolio_snapshots;
