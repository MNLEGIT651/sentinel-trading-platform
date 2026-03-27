-- Migration: 00007_decision_journal.sql
-- Purpose: Decision journal table for trade memory — every recommendation,
-- approval, rejection, fill, and outcome becomes a searchable timeline.
-- Core feature for the "trading operating system" vision.

-- ============================================================================
-- decision_journal — durable trade memory
-- ============================================================================
CREATE TABLE decision_journal (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What happened
  event_type    TEXT        NOT NULL,
  -- Valid values: recommendation, approval, rejection, fill,
  --              risk_block, cancellation, policy_change, manual_note

  -- Instrument context
  ticker        TEXT,
  direction     TEXT,       -- long, short, close
  quantity      NUMERIC,
  price         NUMERIC,

  -- Agent reasoning (populated when event originates from agent cycle)
  agent_name    TEXT,
  reasoning     TEXT,
  confidence    NUMERIC     CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  strategy_name TEXT,

  -- Market context snapshot at decision time
  market_regime TEXT,       -- bull, bear, sideways, volatile
  vix_at_time   NUMERIC,
  sector        TEXT,

  -- References to related objects
  recommendation_id UUID,
  order_id          UUID,
  signal_id         UUID,

  -- User annotation (added during review)
  user_notes    TEXT,
  user_grade    TEXT        CHECK (user_grade IS NULL OR user_grade IN (
                              'excellent', 'good', 'neutral', 'bad', 'terrible'
                            )),

  -- Outcome (filled after trade completes)
  outcome_pnl         NUMERIC,
  outcome_return_pct  NUMERIC,
  outcome_hold_minutes INTEGER,

  -- Metadata
  metadata      JSONB       DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_at     TIMESTAMPTZ
);

-- ── Indexes ────────────────────────────────────────────────────────────
CREATE INDEX idx_journal_user_time  ON decision_journal (user_id, created_at DESC);
CREATE INDEX idx_journal_ticker     ON decision_journal (ticker, created_at DESC)
  WHERE ticker IS NOT NULL;
CREATE INDEX idx_journal_event_type ON decision_journal (event_type, created_at DESC);
CREATE INDEX idx_journal_rec_id     ON decision_journal (recommendation_id)
  WHERE recommendation_id IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────────────────
ALTER TABLE decision_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their journal entries"
  ON decision_journal FOR ALL
  USING (auth.uid() = user_id);

-- ── Realtime ───────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE decision_journal;

-- ── Journal stats view (materialized for performance) ──────────────────
CREATE OR REPLACE VIEW journal_stats AS
SELECT
  user_id,
  COUNT(*)                                          AS total_entries,
  COUNT(*) FILTER (WHERE event_type = 'approval')   AS approvals,
  COUNT(*) FILTER (WHERE event_type = 'rejection')  AS rejections,
  COUNT(*) FILTER (WHERE event_type = 'fill')       AS fills,
  COUNT(*) FILTER (WHERE event_type = 'risk_block') AS risk_blocks,
  COUNT(*) FILTER (WHERE user_grade IS NOT NULL)     AS graded,
  AVG(outcome_return_pct) FILTER (
    WHERE outcome_return_pct IS NOT NULL
  )                                                  AS avg_return_pct,
  COUNT(*) FILTER (
    WHERE outcome_pnl IS NOT NULL AND outcome_pnl > 0
  )                                                  AS winning_trades,
  COUNT(*) FILTER (
    WHERE outcome_pnl IS NOT NULL AND outcome_pnl <= 0
  )                                                  AS losing_trades
FROM decision_journal
GROUP BY user_id;
