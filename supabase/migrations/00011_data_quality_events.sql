-- Data quality tracking for the Sentinel Trading Platform
-- Records data quality events: stale feeds, missing bars, delayed quotes,
-- provider fallback events, and cache hit/miss metrics.

-- ── Data Quality Events ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_quality_events (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'stale_quote', 'missing_bars', 'delayed_quote', 'provider_fallback',
    'cache_miss', 'cache_hit', 'data_gap', 'api_error', 'rate_limited'
  )),
  severity      TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  provider      TEXT,            -- e.g. 'polygon', 'alpaca', 'cache'
  ticker        TEXT,
  message       TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}',
  resolved      BOOLEAN NOT NULL DEFAULT false,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dq_events_user_time ON data_quality_events(user_id, created_at DESC);
CREATE INDEX idx_dq_events_type ON data_quality_events(event_type, created_at DESC);
CREATE INDEX idx_dq_events_severity ON data_quality_events(severity) WHERE NOT resolved;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE data_quality_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data quality events" ON data_quality_events
  FOR ALL USING (auth.uid() = user_id);

-- ── Realtime ─────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE data_quality_events;
