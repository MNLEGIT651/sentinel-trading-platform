-- Migration: 00014_authoritative_state.sql
-- Purpose: Blueprint Phase 0 — Authoritative state tables for event-sourced
--          recommendation lifecycle, risk audit trail, execution fills,
--          centralized system controls, and operator action logging.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. system_controls — centralized halt/mode/config (single row)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS system_controls (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trading_halted       BOOLEAN    NOT NULL DEFAULT false,
  live_execution_enabled BOOLEAN  NOT NULL DEFAULT false,
  global_mode          TEXT       NOT NULL DEFAULT 'paper'
                       CHECK (global_mode IN ('paper', 'live', 'backtest')),
  max_daily_trades     INTEGER    NOT NULL DEFAULT 50,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by           UUID       REFERENCES auth.users(id)
);

-- Seed the single control row so reads never return empty.
INSERT INTO system_controls (
  trading_halted, live_execution_enabled, global_mode
) VALUES (false, false, 'paper')
ON CONFLICT DO NOTHING;

ALTER TABLE system_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read system controls"
  ON system_controls FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update system controls"
  ON system_controls FOR UPDATE
  USING (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE system_controls;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. recommendation_events — event-sourced lifecycle for every recommendation
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS recommendation_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id   UUID NOT NULL,
  event_type          TEXT NOT NULL CHECK (event_type IN (
    'created', 'risk_checked', 'risk_blocked', 'pending_approval',
    'approved', 'rejected', 'submitted', 'partially_filled',
    'filled', 'cancelled', 'failed', 'reviewed'
  )),
  event_ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_type          TEXT NOT NULL DEFAULT 'system'
                      CHECK (actor_type IN ('system', 'agent', 'operator')),
  actor_id            TEXT,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rec_events_rec_id ON recommendation_events(recommendation_id, event_ts);
CREATE INDEX idx_rec_events_type   ON recommendation_events(event_type);
CREATE INDEX idx_rec_events_ts     ON recommendation_events(event_ts DESC);

ALTER TABLE recommendation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read recommendation events"
  ON recommendation_events FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert recommendation events"
  ON recommendation_events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE recommendation_events;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. risk_evaluations — audit trail for every risk check
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS risk_evaluations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id   UUID NOT NULL,
  policy_version      TEXT,
  allowed             BOOLEAN NOT NULL,
  original_quantity   INTEGER,
  adjusted_quantity   INTEGER,
  checks_performed    JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason              TEXT,
  evaluated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_eval_rec_id ON risk_evaluations(recommendation_id);
CREATE INDEX idx_risk_eval_ts     ON risk_evaluations(evaluated_at DESC);

ALTER TABLE risk_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read risk evaluations"
  ON risk_evaluations FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert risk evaluations"
  ON risk_evaluations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE risk_evaluations;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. fills — execution detail, separated from orders for proper tracking
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fills (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL,
  fill_ts        TIMESTAMPTZ NOT NULL DEFAULT now(),
  fill_price     NUMERIC NOT NULL,
  fill_qty       INTEGER NOT NULL,
  commission     NUMERIC NOT NULL DEFAULT 0,
  slippage       NUMERIC,
  venue          TEXT,
  broker_fill_id TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fills_order   ON fills(order_id, fill_ts);
CREATE INDEX idx_fills_ts      ON fills(fill_ts DESC);

ALTER TABLE fills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read fills"
  ON fills FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert fills"
  ON fills FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE fills;

-- ═══════════════════════════════════════════════════════════════════════
-- 5. operator_actions — full operator audit trail
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS operator_actions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id    UUID NOT NULL REFERENCES auth.users(id),
  action_type    TEXT NOT NULL CHECK (action_type IN (
    'halt_trading', 'resume_trading', 'approve_recommendation',
    'reject_recommendation', 'update_policy', 'change_mode',
    'override_risk', 'cancel_order', 'manual_order', 'role_change',
    'system_config_change'
  )),
  target_type    TEXT,
  target_id      TEXT,
  reason         TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_op_actions_operator ON operator_actions(operator_id, created_at DESC);
CREATE INDEX idx_op_actions_type     ON operator_actions(action_type);
CREATE INDEX idx_op_actions_ts       ON operator_actions(created_at DESC);

ALTER TABLE operator_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read operator actions"
  ON operator_actions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert operator actions"
  ON operator_actions FOR INSERT
  WITH CHECK (auth.uid() = operator_id);

ALTER PUBLICATION supabase_realtime ADD TABLE operator_actions;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. signal_runs — scan execution metadata
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS signal_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ,
  requested_by   TEXT NOT NULL DEFAULT 'system',
  universe       JSONB NOT NULL DEFAULT '[]'::jsonb,
  strategies     JSONB NOT NULL DEFAULT '[]'::jsonb,
  days           INTEGER NOT NULL DEFAULT 30,
  min_strength   NUMERIC NOT NULL DEFAULT 0,
  total_signals  INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'running'
                 CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  errors         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_signal_runs_status ON signal_runs(status, started_at DESC);
CREATE INDEX idx_signal_runs_ts     ON signal_runs(started_at DESC);

ALTER TABLE signal_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read signal runs"
  ON signal_runs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert signal runs"
  ON signal_runs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE signal_runs;
