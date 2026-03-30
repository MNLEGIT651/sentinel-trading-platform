-- Migration 00024: Advisor Memory & Explainable Recommendations
-- Three-tier advisor memory (profile + preferences + conversations)
-- and structured recommendation explanations with audit trail.
-- Depends on: 00023_live_trading_tables.sql

-- ─── advisor_profiles (Tier 1: Patchable Profile Document) ─────────
-- Single JSONB profile document per user, continuously updated via
-- JSON merge patch. Inspired by LangGraph "User" schema pattern.

CREATE TABLE IF NOT EXISTS advisor_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  profile     jsonb NOT NULL DEFAULT '{}'::jsonb,
  version     integer NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE advisor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own advisor profile"
  ON advisor_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own advisor profile"
  ON advisor_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own advisor profile"
  ON advisor_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── advisor_threads (Tier 3: Episodic / Conversation Memory) ──────
-- Persistent conversation threads with rolling summaries for
-- efficient context window management.

CREATE TABLE IF NOT EXISTS advisor_threads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL DEFAULT 'New conversation',
  rolling_summary text,
  message_count   integer NOT NULL DEFAULT 0,
  last_activity   timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE advisor_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own advisor threads"
  ON advisor_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own advisor threads"
  ON advisor_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own advisor threads"
  ON advisor_threads FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own advisor threads"
  ON advisor_threads FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_advisor_threads_user_activity
  ON advisor_threads(user_id, last_activity DESC);

-- ─── advisor_messages ──────────────────────────────────────────────
-- Individual messages within advisor threads.

CREATE TABLE IF NOT EXISTS advisor_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL REFERENCES advisor_threads(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     text NOT NULL,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE advisor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own advisor messages"
  ON advisor_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own advisor messages"
  ON advisor_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_advisor_messages_thread_time
  ON advisor_messages(thread_id, created_at);

CREATE INDEX idx_advisor_messages_user_time
  ON advisor_messages(user_id, created_at DESC);

-- ─── advisor_preferences (Tier 2: Semantic Memory / Facts) ─────────
-- Growing collection of user preferences with content + context
-- (Mem0 pattern). Supports explicit, inferred, and system sources
-- with confirmation lifecycle.

CREATE TABLE IF NOT EXISTS advisor_preferences (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category                text NOT NULL
    CHECK (category IN (
      'risk_tolerance', 'holding_period', 'trade_style',
      'sector', 'position_sizing', 'volatility',
      'instrument', 'general'
    )),
  content                 text NOT NULL,
  context                 text,
  source                  text NOT NULL CHECK (source IN ('explicit', 'inferred', 'system')),
  confidence              numeric(3,2) NOT NULL DEFAULT 1.00
    CHECK (confidence >= 0 AND confidence <= 1),
  status                  text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending_confirmation', 'dismissed', 'archived')),
  originating_message_id  uuid REFERENCES advisor_messages(id) ON DELETE SET NULL,
  confirmed_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE advisor_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own advisor preferences"
  ON advisor_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own advisor preferences"
  ON advisor_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own advisor preferences"
  ON advisor_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own advisor preferences"
  ON advisor_preferences FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_advisor_preferences_user_status_cat
  ON advisor_preferences(user_id, status, category);

CREATE INDEX idx_advisor_preferences_user_time
  ON advisor_preferences(user_id, created_at DESC);

-- ─── advisor_memory_events (Audit Trail) ───────────────────────────
-- Immutable log of all memory changes (profile patches, preference
-- CRUD) for transparency and auditability.

CREATE TABLE IF NOT EXISTS advisor_memory_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preference_id   uuid REFERENCES advisor_preferences(id) ON DELETE SET NULL,
  event_type      text NOT NULL
    CHECK (event_type IN (
      'profile_updated',
      'preference_learned', 'preference_confirmed',
      'preference_edited', 'preference_dismissed',
      'preference_deleted', 'preference_restored',
      'preference_auto_expired'
    )),
  previous_value  jsonb,
  new_value       jsonb,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE advisor_memory_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memory events"
  ON advisor_memory_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memory events"
  ON advisor_memory_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_advisor_memory_events_user_time
  ON advisor_memory_events(user_id, created_at DESC);

CREATE INDEX idx_advisor_memory_events_pref_time
  ON advisor_memory_events(preference_id, created_at DESC);

-- ─── recommendation_explanations ───────────────────────────────────
-- Structured "why this suggestion" metadata per recommendation.
-- Separate table preserves existing agent_recommendations schema.
-- Supports versioning for explanation regeneration.

CREATE TABLE IF NOT EXISTS recommendation_explanations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES agent_recommendations(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary           text NOT NULL,
  explanation       jsonb NOT NULL,
  version           integer NOT NULL DEFAULT 1,
  generated_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recommendation_id, version)
);

ALTER TABLE recommendation_explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommendation explanations"
  ON recommendation_explanations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recommendation explanations"
  ON recommendation_explanations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_rec_explanations_rec_version
  ON recommendation_explanations(recommendation_id, version DESC);

CREATE INDEX idx_rec_explanations_user_time
  ON recommendation_explanations(user_id, created_at DESC);

-- ─── updated_at triggers ───────────────────────────────────────────
-- Reuse the update_updated_at_column() function from migration 00023.

CREATE TRIGGER set_advisor_profiles_updated_at
  BEFORE UPDATE ON advisor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_advisor_threads_updated_at
  BEFORE UPDATE ON advisor_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_advisor_preferences_updated_at
  BEFORE UPDATE ON advisor_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
