-- ============================================================
-- Migration: Paper-Trading Experiment Framework
-- ============================================================
-- Adds three tables for structured two-phase paper-trading
-- experiments: experiments, experiment_snapshots, experiment_orders.
-- ============================================================

-- 1. experiments — one row per experiment run
CREATE TABLE experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','week1_shadow','week2_execution','completed','aborted')),
  config jsonb NOT NULL DEFAULT '{}',

  -- Phase dates
  week1_start timestamptz,
  week1_end   timestamptz,
  week2_start timestamptz,
  week2_end   timestamptz,

  -- Risk caps (override system defaults during experiment)
  max_daily_trades          integer      NOT NULL DEFAULT 10,
  max_position_value        numeric      NOT NULL DEFAULT 50000,
  signal_strength_threshold numeric(3,2) NOT NULL DEFAULT 0.70,
  max_total_exposure        numeric      NOT NULL DEFAULT 500000,
  initial_capital           numeric      NOT NULL DEFAULT 100000,

  -- Kill switch
  halted      boolean NOT NULL DEFAULT false,
  halt_reason text,
  halted_at   timestamptz,

  -- Results (populated at completion)
  verdict        text CHECK (verdict IN ('go','no_go','inconclusive')),
  verdict_reason text,
  final_metrics  jsonb,

  -- Audit
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. experiment_snapshots — daily performance snapshots
CREATE TABLE experiment_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  snapshot_date   date NOT NULL,
  phase           text NOT NULL CHECK (phase IN ('week1_shadow','week2_execution')),

  -- Portfolio metrics
  equity                numeric NOT NULL DEFAULT 0,
  cash                  numeric NOT NULL DEFAULT 0,
  positions_value       numeric NOT NULL DEFAULT 0,
  daily_pnl             numeric NOT NULL DEFAULT 0,
  cumulative_pnl        numeric NOT NULL DEFAULT 0,
  daily_return_pct      numeric NOT NULL DEFAULT 0,
  cumulative_return_pct numeric NOT NULL DEFAULT 0,
  max_drawdown_pct      numeric NOT NULL DEFAULT 0,

  -- Activity metrics
  recommendations_generated integer NOT NULL DEFAULT 0,
  recommendations_executed  integer NOT NULL DEFAULT 0,
  recommendations_blocked   integer NOT NULL DEFAULT 0,
  orders_submitted          integer NOT NULL DEFAULT 0,
  orders_filled             integer NOT NULL DEFAULT 0,
  orders_rejected           integer NOT NULL DEFAULT 0,

  -- Risk metrics
  sharpe_ratio     numeric,
  win_rate         numeric,
  profit_factor    numeric,
  avg_trade_return numeric,

  -- System quality
  cycle_count          integer NOT NULL DEFAULT 0,
  error_count          integer NOT NULL DEFAULT 0,
  avg_cycle_duration_ms integer,

  metadata   jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(experiment_id, snapshot_date)
);

-- 3. experiment_orders — durable order log (shadow + real)
CREATE TABLE experiment_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id     uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  recommendation_id uuid REFERENCES agent_recommendations(id),
  phase             text NOT NULL CHECK (phase IN ('week1_shadow','week2_execution')),

  -- Order details
  symbol      text    NOT NULL,
  side        text    NOT NULL CHECK (side IN ('buy','sell')),
  order_type  text    NOT NULL DEFAULT 'market',
  quantity    numeric NOT NULL,
  limit_price numeric,

  -- Execution details
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','submitted','filled','partially_filled','rejected','cancelled')),
  fill_price      numeric,
  fill_quantity   numeric,
  commission      numeric DEFAULT 0,
  slippage        numeric DEFAULT 0,
  broker_order_id text,

  -- Shadow mode
  shadow_fill_price numeric,
  shadow_pnl        numeric,
  is_shadow         boolean NOT NULL DEFAULT false,

  -- Risk context
  risk_check_result jsonb,
  risk_note         text,

  -- Timestamps
  submitted_at timestamptz NOT NULL DEFAULT now(),
  filled_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────

CREATE INDEX idx_experiments_status      ON experiments(status);
CREATE INDEX idx_experiments_created_by  ON experiments(created_by);

CREATE INDEX idx_experiment_snapshots_experiment ON experiment_snapshots(experiment_id);
CREATE INDEX idx_experiment_snapshots_date       ON experiment_snapshots(snapshot_date);

CREATE INDEX idx_experiment_orders_experiment       ON experiment_orders(experiment_id);
CREATE INDEX idx_experiment_orders_recommendation   ON experiment_orders(recommendation_id);
CREATE INDEX idx_experiment_orders_status            ON experiment_orders(status);
CREATE INDEX idx_experiment_orders_symbol             ON experiment_orders(symbol);
CREATE INDEX idx_experiment_orders_phase              ON experiment_orders(phase);

-- ── RLS ──────────────────────────────────────────────────

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_orders ENABLE ROW LEVEL SECURITY;

-- Experiments: users see their own, service role sees all
CREATE POLICY experiments_select ON experiments
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY experiments_insert ON experiments
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY experiments_update ON experiments
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- Snapshots: inherit visibility via experiment ownership
CREATE POLICY experiment_snapshots_select ON experiment_snapshots
  FOR SELECT TO authenticated
  USING (experiment_id IN (SELECT id FROM experiments WHERE created_by = auth.uid()));

CREATE POLICY experiment_snapshots_insert ON experiment_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (experiment_id IN (SELECT id FROM experiments WHERE created_by = auth.uid()));

-- Orders: inherit visibility via experiment ownership
CREATE POLICY experiment_orders_select ON experiment_orders
  FOR SELECT TO authenticated
  USING (experiment_id IN (SELECT id FROM experiments WHERE created_by = auth.uid()));

CREATE POLICY experiment_orders_insert ON experiment_orders
  FOR INSERT TO authenticated
  WITH CHECK (experiment_id IN (SELECT id FROM experiments WHERE created_by = auth.uid()));

CREATE POLICY experiment_orders_update ON experiment_orders
  FOR UPDATE TO authenticated
  USING (experiment_id IN (SELECT id FROM experiments WHERE created_by = auth.uid()));

-- ── Realtime ─────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE experiments;
ALTER PUBLICATION supabase_realtime ADD TABLE experiment_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE experiment_orders;

-- ── updated_at trigger ───────────────────────────────────

CREATE TRIGGER set_experiments_updated_at
  BEFORE UPDATE ON experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
