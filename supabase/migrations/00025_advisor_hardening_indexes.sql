-- Migration: Production hardening indexes for advisor tables
-- Adds targeted indexes identified during backend audit.

-- Partial index: skip archived preferences for most queries
CREATE INDEX IF NOT EXISTS idx_advisor_prefs_active
  ON advisor_preferences (user_id, status, category)
  WHERE status != 'archived';

-- Sparse index: only rows with confirmed_at set
CREATE INDEX IF NOT EXISTS idx_advisor_prefs_confirmed
  ON advisor_preferences (user_id, confirmed_at)
  WHERE confirmed_at IS NOT NULL;

-- Recommendation explanation lookup by user + recency
CREATE INDEX IF NOT EXISTS idx_rec_explanations_user_rec
  ON recommendation_explanations (recommendation_id, user_id, version DESC);
