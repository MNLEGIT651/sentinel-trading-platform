-- ============================================================
-- Migration: Customer Onboarding & Consent Framework
-- ============================================================
-- Adds four tables to support the customer setup flow:
--   customer_profiles  — KYC/identity data + onboarding state machine
--   consents           — versioned disclosure/agreement acceptance
--   onboarding_audit_log — every onboarding state transition
--   external_portfolio_links — read-only Plaid investment connections
--
-- Separation rationale: customer_profiles holds regulated financial
-- identity data (KYC/CIP) distinct from user_profiles (app role/display).
-- consents is separate from profile data for audit trail integrity.
-- external_portfolio_links is separate from broker_accounts (Phase 2)
-- because read-only aggregation ≠ live trading account.
-- ============================================================

-- 1. customer_profiles — one per user, tracks onboarding state + profile data
CREATE TABLE customer_profiles (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  legal_name    TEXT,
  date_of_birth DATE,
  address_line1 TEXT,
  address_line2 TEXT,
  city          TEXT,
  state         TEXT,
  postal_code   TEXT,
  country       TEXT NOT NULL DEFAULT 'US',
  phone         TEXT,
  tax_residency TEXT,
  citizenship   TEXT,
  onboarding_step TEXT NOT NULL DEFAULT 'app_account_created'
    CHECK (onboarding_step IN (
      'app_account_created',
      'profile_completed',
      'paper_active',
      'kyc_submitted',
      'kyc_pending',
      'kyc_needs_info',
      'kyc_approved',
      'kyc_rejected',
      'bank_linked',
      'funded',
      'live_active'
    )),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE customer_profiles IS 'Customer identity and onboarding state. Separate from user_profiles (app role). Contains KYC/CIP data for regulated account opening.';
COMMENT ON COLUMN customer_profiles.onboarding_step IS 'State machine: app_account_created → profile_completed → paper_active → kyc_submitted → kyc_pending → kyc_approved → bank_linked → funded → live_active';

-- Auto-update updated_at
CREATE TRIGGER set_customer_profiles_updated_at
  BEFORE UPDATE ON customer_profiles
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- Index for querying by onboarding state (ops dashboards, conversion funnels)
CREATE INDEX idx_customer_profiles_onboarding_step ON customer_profiles(onboarding_step);

-- 2. consents — versioned acceptance of disclosures and agreements
CREATE TABLE consents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type     TEXT NOT NULL,
  document_version  TEXT NOT NULL,
  accepted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address        INET,
  user_agent        TEXT,
  broker_account_id UUID,  -- nullable; set for broker-specific disclosures (Phase 2)
  revoked_at        TIMESTAMPTZ,  -- nullable; for consent withdrawal

  UNIQUE(user_id, document_type, document_version)
);

COMMENT ON TABLE consents IS 'Versioned record of user consent to disclosures, agreements, and policies. Each row = one acceptance event.';
COMMENT ON COLUMN consents.document_type IS 'e.g. terms_of_service, privacy_policy, electronic_delivery, customer_agreement, data_sharing, broker_disclosures';
COMMENT ON COLUMN consents.document_version IS 'Semantic version of the document accepted, e.g. 1.0.0';
COMMENT ON COLUMN consents.revoked_at IS 'If set, the user has withdrawn this consent';

-- Index for checking latest consent per user+document
CREATE INDEX idx_consents_user_document ON consents(user_id, document_type, document_version);

-- 3. onboarding_audit_log — immutable log of every onboarding event
CREATE TABLE onboarding_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE onboarding_audit_log IS 'Append-only audit trail for all onboarding state changes and customer actions.';
COMMENT ON COLUMN onboarding_audit_log.event_type IS 'e.g. account_created, profile_updated, kyc_submitted, kyc_status_changed, consent_accepted, bank_link_created, deposit_initiated, mode_changed, mfa_enabled, passkey_added';

-- Index for querying user's onboarding history
CREATE INDEX idx_onboarding_audit_user ON onboarding_audit_log(user_id, created_at DESC);

-- 4. external_portfolio_links — read-only connections to outside brokerages
CREATE TABLE external_portfolio_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL DEFAULT 'plaid',
  external_item_id  TEXT NOT NULL,  -- Plaid item_id
  institution_name  TEXT,
  status            TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disconnected', 'error')),
  read_only         BOOLEAN NOT NULL DEFAULT true,
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE external_portfolio_links IS 'Read-only links to external brokerages for portfolio aggregation. Completely separate from live trading broker_accounts.';
COMMENT ON COLUMN external_portfolio_links.external_item_id IS 'Plaid item_id. Access tokens stored server-side only, never in this table.';

-- Auto-update updated_at
CREATE TRIGGER set_external_portfolio_links_updated_at
  BEFORE UPDATE ON external_portfolio_links
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================================
-- RLS Policies — all tables scoped to auth.uid() = user_id
-- ============================================================

-- customer_profiles
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_customer_profile"
  ON customer_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_customer_profile"
  ON customer_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_customer_profile"
  ON customer_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- consents
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_consents"
  ON consents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_consents"
  ON consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE/DELETE on consents — immutable audit record.
-- Withdrawal handled by setting revoked_at via service_role.

-- onboarding_audit_log
ALTER TABLE onboarding_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_onboarding_audit"
  ON onboarding_audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_onboarding_audit"
  ON onboarding_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE/DELETE — append-only.

-- external_portfolio_links
ALTER TABLE external_portfolio_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_external_links"
  ON external_portfolio_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_external_links"
  ON external_portfolio_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_external_links"
  ON external_portfolio_links FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_external_links"
  ON external_portfolio_links FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Auto-create customer_profile on user signup
-- ============================================================
-- Extend the existing handle_new_user trigger to also create a
-- customer_profiles row. We create a separate function so the
-- original user_profiles trigger is not modified.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_customer_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.customer_profiles (user_id, onboarding_step)
  VALUES (NEW.id, 'app_account_created')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_customer_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer_profile();
