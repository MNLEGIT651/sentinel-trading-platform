-- Migration 00034: Reconciliation Snapshots
-- Stores periodic portfolio reconciliation audit results from the engine.
-- Used for compliance audit trail and drift detection alerting.
-- Depends on: 00001_initial_schema.sql (auth.users)

-- ─── reconciliation_snapshots ──────────────────────────────────────
-- Written by the engine's portfolio_reconciliation service (best-effort).
-- Each row is a point-in-time snapshot comparing Alpaca state vs local orders.

CREATE TABLE IF NOT EXISTS reconciliation_snapshots (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp                  timestamptz NOT NULL,
  alpaca_cash                numeric(16, 2) NOT NULL DEFAULT 0,
  alpaca_equity              numeric(16, 2) NOT NULL DEFAULT 0,
  alpaca_positions_count     integer NOT NULL DEFAULT 0,
  local_filled_orders_count  integer NOT NULL DEFAULT 0,
  unaccounted_positions      jsonb NOT NULL DEFAULT '[]'::jsonb,
  phantom_orders             jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_discrepancies          boolean NOT NULL DEFAULT false,
  created_at                 timestamptz DEFAULT now()
);

-- Index for time-series queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_reconciliation_snapshots_timestamp
  ON reconciliation_snapshots (timestamp DESC);

-- Index for finding discrepancies quickly
CREATE INDEX IF NOT EXISTS idx_reconciliation_snapshots_discrepancies
  ON reconciliation_snapshots (has_discrepancies, timestamp DESC)
  WHERE has_discrepancies = true;

-- RLS: service role only (engine writes via service_role_key, no user access)
ALTER TABLE reconciliation_snapshots ENABLE ROW LEVEL SECURITY;

-- No user-facing RLS policies — only the engine's service role can read/write.
-- Operators with the dashboard or admin role can view via Supabase Studio.

COMMENT ON TABLE reconciliation_snapshots IS
  'Periodic portfolio reconciliation audit results. Written by engine service role.';
