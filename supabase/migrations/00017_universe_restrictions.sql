-- Universe restrictions for symbol/sector/asset-class filtering (Phase 4)
CREATE TABLE IF NOT EXISTS universe_restrictions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restriction_type TEXT NOT NULL CHECK (restriction_type IN ('whitelist', 'blacklist')),
  symbols          TEXT[] NOT NULL DEFAULT '{}',
  sectors          TEXT[] DEFAULT '{}',
  asset_classes    TEXT[] DEFAULT '{}',
  reason           TEXT,
  enabled          BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  created_by       UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_universe_restrictions_type ON universe_restrictions(restriction_type) WHERE enabled = true;

ALTER TABLE universe_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read universe restrictions"
  ON universe_restrictions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert universe restrictions"
  ON universe_restrictions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete universe restrictions"
  ON universe_restrictions FOR DELETE
  USING (auth.role() = 'authenticated');
