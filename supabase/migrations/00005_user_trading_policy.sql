-- Migration: 00005_user_trading_policy.sql
-- Purpose: Server-side trading policy storage (replaces localStorage)
-- Splits settings into: UI preferences (local), trading policy (DB), runtime config (env)

-- ============================================================================
-- Trigger function for updated_at (reusable across tables)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- User Trading Policy table
-- ============================================================================
CREATE TABLE user_trading_policy (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Risk limits (stored as percentages, e.g. 5 = 5%)
  max_position_pct    NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  max_sector_pct      NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  daily_loss_limit_pct NUMERIC(5,2) NOT NULL DEFAULT 2.00,
  soft_drawdown_pct   NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  hard_drawdown_pct   NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  max_open_positions  INTEGER      NOT NULL DEFAULT 20,

  -- Trading mode
  paper_trading       BOOLEAN NOT NULL DEFAULT true,
  auto_trading        BOOLEAN NOT NULL DEFAULT false,
  require_confirmation BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One policy per user
  CONSTRAINT uq_user_trading_policy_user UNIQUE (user_id),

  -- Validation
  CONSTRAINT chk_max_position   CHECK (max_position_pct > 0 AND max_position_pct <= 100),
  CONSTRAINT chk_max_sector     CHECK (max_sector_pct > 0 AND max_sector_pct <= 100),
  CONSTRAINT chk_daily_loss     CHECK (daily_loss_limit_pct > 0 AND daily_loss_limit_pct <= 100),
  CONSTRAINT chk_soft_drawdown  CHECK (soft_drawdown_pct > 0 AND soft_drawdown_pct <= 100),
  CONSTRAINT chk_hard_drawdown  CHECK (hard_drawdown_pct > 0 AND hard_drawdown_pct <= 100),
  CONSTRAINT chk_drawdown_order CHECK (soft_drawdown_pct <= hard_drawdown_pct),
  CONSTRAINT chk_max_positions  CHECK (max_open_positions > 0 AND max_open_positions <= 1000)
);

-- Auto-update updated_at on every write
CREATE TRIGGER trg_user_trading_policy_updated_at
  BEFORE UPDATE ON user_trading_policy
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row-Level Security
-- ============================================================================
ALTER TABLE user_trading_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own policy"
  ON user_trading_policy FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own policy"
  ON user_trading_policy FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own policy"
  ON user_trading_policy FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Policy change audit log
-- ============================================================================
CREATE TABLE policy_change_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  field_name  TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT
);

ALTER TABLE policy_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own audit log"
  ON policy_change_log FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger to auto-log policy changes
CREATE OR REPLACE FUNCTION log_policy_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.max_position_pct IS DISTINCT FROM NEW.max_position_pct THEN
    INSERT INTO policy_change_log (user_id, field_name, old_value, new_value)
    VALUES (NEW.user_id, 'max_position_pct', OLD.max_position_pct::TEXT, NEW.max_position_pct::TEXT);
  END IF;
  IF OLD.max_sector_pct IS DISTINCT FROM NEW.max_sector_pct THEN
    INSERT INTO policy_change_log (user_id, field_name, old_value, new_value)
    VALUES (NEW.user_id, 'max_sector_pct', OLD.max_sector_pct::TEXT, NEW.max_sector_pct::TEXT);
  END IF;
  IF OLD.daily_loss_limit_pct IS DISTINCT FROM NEW.daily_loss_limit_pct THEN
    INSERT INTO policy_change_log (user_id, field_name, old_value, new_value)
    VALUES (NEW.user_id, 'daily_loss_limit_pct', OLD.daily_loss_limit_pct::TEXT, NEW.daily_loss_limit_pct::TEXT);
  END IF;
  IF OLD.soft_drawdown_pct IS DISTINCT FROM NEW.soft_drawdown_pct THEN
    INSERT INTO policy_change_log (user_id, field_name, old_value, new_value)
    VALUES (NEW.user_id, 'soft_drawdown_pct', OLD.soft_drawdown_pct::TEXT, NEW.soft_drawdown_pct::TEXT);
  END IF;
  IF OLD.hard_drawdown_pct IS DISTINCT FROM NEW.hard_drawdown_pct THEN
    INSERT INTO policy_change_log (user_id, field_name, old_value, new_value)
    VALUES (NEW.user_id, 'hard_drawdown_pct', OLD.hard_drawdown_pct::TEXT, NEW.hard_drawdown_pct::TEXT);
  END IF;
  IF OLD.max_open_positions IS DISTINCT FROM NEW.max_open_positions THEN
    INSERT INTO policy_change_log (user_id, field_name, old_value, new_value)
    VALUES (NEW.user_id, 'max_open_positions', OLD.max_open_positions::TEXT, NEW.max_open_positions::TEXT);
  END IF;
  IF OLD.paper_trading IS DISTINCT FROM NEW.paper_trading THEN
    INSERT INTO policy_change_log (user_id, field_name, old_value, new_value)
    VALUES (NEW.user_id, 'paper_trading', OLD.paper_trading::TEXT, NEW.paper_trading::TEXT);
  END IF;
  IF OLD.auto_trading IS DISTINCT FROM NEW.auto_trading THEN
    INSERT INTO policy_change_log (user_id, field_name, old_value, new_value)
    VALUES (NEW.user_id, 'auto_trading', OLD.auto_trading::TEXT, NEW.auto_trading::TEXT);
  END IF;
  IF OLD.require_confirmation IS DISTINCT FROM NEW.require_confirmation THEN
    INSERT INTO policy_change_log (user_id, field_name, old_value, new_value)
    VALUES (NEW.user_id, 'require_confirmation', OLD.require_confirmation::TEXT, NEW.require_confirmation::TEXT);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_policy_changes
  AFTER UPDATE ON user_trading_policy
  FOR EACH ROW
  EXECUTE FUNCTION log_policy_changes();

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX idx_policy_change_log_user ON policy_change_log (user_id, changed_at DESC);

-- ============================================================================
-- Enable Realtime for cross-tab/device sync
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE user_trading_policy;
