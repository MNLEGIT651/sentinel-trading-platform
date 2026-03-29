-- Migration 00023: Live Trading Tables
-- Phase 2 of customer onboarding: broker accounts, bank links, and funding.
-- Depends on: 00022_customer_onboarding.sql

-- ─── broker_accounts ────────────────────────────────────────────────
-- Tracks regulated brokerage accounts (e.g. Alpaca Broker API).
-- Separate from the existing `accounts` table which is app-level paper/live accounts.

CREATE TABLE IF NOT EXISTS broker_accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_provider text NOT NULL DEFAULT 'alpaca',
  external_account_id text,                 -- Alpaca account UUID
  status         text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',          -- application not yet submitted
      'submitted',        -- submitted to broker
      'action_required',  -- broker needs more info
      'approved',         -- account is active
      'rejected',         -- application denied
      'disabled',         -- account suspended
      'closed'            -- account closed
    )),
  account_type   text NOT NULL DEFAULT 'individual'
    CHECK (account_type IN ('individual', 'entity')),
  cash_enabled   boolean NOT NULL DEFAULT true,
  margin_enabled boolean NOT NULL DEFAULT false,
  options_level  integer NOT NULL DEFAULT 0
    CHECK (options_level >= 0 AND options_level <= 4),
  crypto_enabled boolean NOT NULL DEFAULT false,
  rejection_reason text,
  approved_at    timestamptz,
  submitted_at   timestamptz,
  metadata       jsonb DEFAULT '{}'::jsonb,   -- broker-specific data
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE (user_id, broker_provider)
);

ALTER TABLE broker_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own broker accounts"
  ON broker_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own broker accounts"
  ON broker_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own broker accounts"
  ON broker_accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_broker_accounts_user ON broker_accounts(user_id);
CREATE INDEX idx_broker_accounts_status ON broker_accounts(status);

-- ─── bank_links ─────────────────────────────────────────────────────
-- Tracks bank accounts linked via Plaid for ACH funding.
-- The Plaid access_token is NOT stored here — it goes in a secrets vault.

CREATE TABLE IF NOT EXISTS bank_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_account_id uuid REFERENCES broker_accounts(id) ON DELETE SET NULL,
  provider        text NOT NULL DEFAULT 'plaid',
  external_bank_link_id text,              -- Alpaca bank relationship ID
  plaid_item_id   text,                     -- Plaid item ID for reference
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',          -- link initiated
      'queued',           -- ACH relationship queued
      'approved',         -- bank link active
      'failed',           -- verification failed
      'cancelled'         -- user cancelled
    )),
  account_last4   text,
  bank_name       text,
  account_type    text,                     -- checking, savings
  funding_enabled boolean NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE bank_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank links"
  ON bank_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank links"
  ON bank_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank links"
  ON bank_links FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_bank_links_user ON bank_links(user_id);
CREATE INDEX idx_bank_links_broker ON bank_links(broker_account_id);

-- ─── funding_transactions ───────────────────────────────────────────
-- Tracks deposits, withdrawals, and transfer status.

CREATE TABLE IF NOT EXISTS funding_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_account_id uuid REFERENCES broker_accounts(id) ON DELETE SET NULL,
  bank_link_id      uuid REFERENCES bank_links(id) ON DELETE SET NULL,
  direction         text NOT NULL
    CHECK (direction IN ('deposit', 'withdrawal')),
  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  currency          text NOT NULL DEFAULT 'USD',
  status            text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',          -- initiated
      'queued',           -- sent to broker
      'complete',         -- settled
      'failed',           -- transfer failed
      'cancelled',        -- user cancelled
      'returned'          -- ACH return
    )),
  external_transfer_id text,               -- Alpaca transfer ID
  failure_reason    text,
  initiated_at      timestamptz DEFAULT now(),
  completed_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE funding_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own funding transactions"
  ON funding_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own funding transactions"
  ON funding_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No direct UPDATE policy — status changes come through backend/webhooks
-- using service_role key.

CREATE INDEX idx_funding_txns_user ON funding_transactions(user_id);
CREATE INDEX idx_funding_txns_status ON funding_transactions(status);
CREATE INDEX idx_funding_txns_broker ON funding_transactions(broker_account_id);

-- ─── updated_at triggers ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_broker_accounts_updated_at
  BEFORE UPDATE ON broker_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_bank_links_updated_at
  BEFORE UPDATE ON bank_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_funding_transactions_updated_at
  BEFORE UPDATE ON funding_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
