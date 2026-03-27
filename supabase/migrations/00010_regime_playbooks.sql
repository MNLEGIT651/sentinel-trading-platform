-- Migration: Regime Detection & Playbook Switching
-- Phase 7C: Classify market regime and manage strategy playbooks per regime

-- ── Market Regime History ────────────────────────────────────────────────────
-- Tracks regime classifications over time for historical analysis

CREATE TABLE IF NOT EXISTS market_regime_history (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  regime        TEXT NOT NULL CHECK (regime IN ('bull', 'bear', 'sideways', 'volatile', 'crisis')),
  confidence    NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  indicators    JSONB NOT NULL DEFAULT '{}',
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ,
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'agent', 'algorithm')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_regime_history_user_time ON market_regime_history(user_id, detected_at DESC);
CREATE INDEX idx_regime_history_regime ON market_regime_history(regime);

-- ── Regime Playbooks ─────────────────────────────────────────────────────────
-- Each playbook maps a regime to strategy weights, position sizing adjustments,
-- and risk policy overrides

CREATE TABLE IF NOT EXISTS regime_playbooks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  regime                TEXT NOT NULL CHECK (regime IN ('bull', 'bear', 'sideways', 'volatile', 'crisis')),
  description           TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  -- Strategy controls
  enabled_strategies    TEXT[] NOT NULL DEFAULT '{}',
  disabled_strategies   TEXT[] NOT NULL DEFAULT '{}',
  strategy_weights      JSONB NOT NULL DEFAULT '{}',
  -- Risk policy overrides (null = inherit primary)
  max_position_pct      NUMERIC CHECK (max_position_pct > 0 AND max_position_pct <= 100),
  max_sector_pct        NUMERIC CHECK (max_sector_pct > 0 AND max_sector_pct <= 100),
  daily_loss_limit_pct  NUMERIC CHECK (daily_loss_limit_pct > 0 AND daily_loss_limit_pct <= 100),
  -- Position sizing modifier (e.g. 0.5 = half size, 1.0 = normal, 1.5 = increased)
  position_size_modifier NUMERIC NOT NULL DEFAULT 1.0 CHECK (position_size_modifier > 0 AND position_size_modifier <= 3.0),
  -- Execution behavior
  auto_approve          BOOLEAN NOT NULL DEFAULT false,
  require_confirmation  BOOLEAN NOT NULL DEFAULT true,
  -- Metadata
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_playbooks_user_regime ON regime_playbooks(user_id, regime);

-- Auto-update updated_at
CREATE TRIGGER set_playbook_updated_at
  BEFORE UPDATE ON regime_playbooks
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE market_regime_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their regime history"
  ON market_regime_history FOR ALL
  USING (auth.uid() = user_id);

ALTER TABLE regime_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their playbooks"
  ON regime_playbooks FOR ALL
  USING (auth.uid() = user_id);

-- ── Realtime ─────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE market_regime_history;
ALTER PUBLICATION supabase_realtime ADD TABLE regime_playbooks;
