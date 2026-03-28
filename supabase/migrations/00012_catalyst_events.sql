-- Catalyst events: earnings, macro events, market calendar items
-- that provide context for trading decisions

CREATE TABLE IF NOT EXISTS catalyst_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Event classification
  event_type TEXT NOT NULL CHECK (event_type IN (
    'earnings',
    'dividend',
    'split',
    'ipo',
    'macro',
    'fed_meeting',
    'economic_data',
    'options_expiry',
    'ex_dividend',
    'conference',
    'custom'
  )),
  -- Scope
  ticker TEXT,                     -- NULL for macro events
  sector TEXT,                     -- NULL if ticker-specific
  -- Timing
  event_date DATE NOT NULL,
  event_time TIME,                 -- NULL if all-day
  -- Details
  title TEXT NOT NULL,
  description TEXT,
  impact TEXT CHECK (impact IN ('high', 'medium', 'low')) DEFAULT 'medium',
  -- Earnings-specific
  eps_estimate NUMERIC,
  revenue_estimate NUMERIC,
  eps_actual NUMERIC,
  revenue_actual NUMERIC,
  -- Source
  source TEXT,                     -- e.g. 'polygon', 'manual', 'calendar_api'
  source_id TEXT,                  -- external ID for deduplication
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_catalyst_events_date ON catalyst_events(event_date);
CREATE INDEX idx_catalyst_events_ticker ON catalyst_events(ticker) WHERE ticker IS NOT NULL;
CREATE INDEX idx_catalyst_events_type ON catalyst_events(event_type);
CREATE UNIQUE INDEX idx_catalyst_events_source ON catalyst_events(source, source_id) WHERE source_id IS NOT NULL;

ALTER TABLE catalyst_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read catalysts"
  ON catalyst_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert catalysts"
  ON catalyst_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own catalysts"
  ON catalyst_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own catalysts"
  ON catalyst_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE catalyst_events;
