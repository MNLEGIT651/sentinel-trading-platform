-- Migration 00028: Optimize RLS initplan — wrap auth.uid() in (select ...)
--
-- Problem: 59 RLS policies across 29 tables call auth.uid() directly,
-- causing PostgreSQL to re-evaluate the function for EVERY row.
-- Wrapping in (select auth.uid()) makes it a one-time InitPlan evaluation.
--
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

BEGIN;

-- ============================================================
-- advisor_memory_events (2 policies)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own memory events" ON public.advisor_memory_events;
CREATE POLICY "Users can view own memory events"
  ON public.advisor_memory_events FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own memory events" ON public.advisor_memory_events;
CREATE POLICY "Users can insert own memory events"
  ON public.advisor_memory_events FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- advisor_messages (2 policies)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own advisor messages" ON public.advisor_messages;
CREATE POLICY "Users can view own advisor messages"
  ON public.advisor_messages FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own advisor messages" ON public.advisor_messages;
CREATE POLICY "Users can insert own advisor messages"
  ON public.advisor_messages FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- advisor_preferences (4 policies)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own advisor preferences" ON public.advisor_preferences;
CREATE POLICY "Users can view own advisor preferences"
  ON public.advisor_preferences FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own advisor preferences" ON public.advisor_preferences;
CREATE POLICY "Users can insert own advisor preferences"
  ON public.advisor_preferences FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own advisor preferences" ON public.advisor_preferences;
CREATE POLICY "Users can update own advisor preferences"
  ON public.advisor_preferences FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own advisor preferences" ON public.advisor_preferences;
CREATE POLICY "Users can delete own advisor preferences"
  ON public.advisor_preferences FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- advisor_profiles (3 policies)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own advisor profile" ON public.advisor_profiles;
CREATE POLICY "Users can view own advisor profile"
  ON public.advisor_profiles FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own advisor profile" ON public.advisor_profiles;
CREATE POLICY "Users can insert own advisor profile"
  ON public.advisor_profiles FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own advisor profile" ON public.advisor_profiles;
CREATE POLICY "Users can update own advisor profile"
  ON public.advisor_profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- advisor_threads (4 policies)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own advisor threads" ON public.advisor_threads;
CREATE POLICY "Users can view own advisor threads"
  ON public.advisor_threads FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own advisor threads" ON public.advisor_threads;
CREATE POLICY "Users can insert own advisor threads"
  ON public.advisor_threads FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own advisor threads" ON public.advisor_threads;
CREATE POLICY "Users can update own advisor threads"
  ON public.advisor_threads FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own advisor threads" ON public.advisor_threads;
CREATE POLICY "Users can delete own advisor threads"
  ON public.advisor_threads FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- bank_links (3 policies)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own bank links" ON public.bank_links;
CREATE POLICY "Users can view own bank links"
  ON public.bank_links FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own bank links" ON public.bank_links;
CREATE POLICY "Users can insert own bank links"
  ON public.bank_links FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own bank links" ON public.bank_links;
CREATE POLICY "Users can update own bank links"
  ON public.bank_links FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- broker_accounts (3 policies)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own broker accounts" ON public.broker_accounts;
CREATE POLICY "Users can view own broker accounts"
  ON public.broker_accounts FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own broker accounts" ON public.broker_accounts;
CREATE POLICY "Users can insert own broker accounts"
  ON public.broker_accounts FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own broker accounts" ON public.broker_accounts;
CREATE POLICY "Users can update own broker accounts"
  ON public.broker_accounts FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- catalyst_events (3 policies)
-- ============================================================
DROP POLICY IF EXISTS "Users can delete own catalysts" ON public.catalyst_events;
CREATE POLICY "Users can delete own catalysts"
  ON public.catalyst_events FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own catalysts" ON public.catalyst_events;
CREATE POLICY "Users can insert own catalysts"
  ON public.catalyst_events FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own catalysts" ON public.catalyst_events;
CREATE POLICY "Users can update own catalysts"
  ON public.catalyst_events FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- consents (2 policies)
-- ============================================================
DROP POLICY IF EXISTS "users_read_own_consents" ON public.consents;
CREATE POLICY "users_read_own_consents"
  ON public.consents FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_insert_own_consents" ON public.consents;
CREATE POLICY "users_insert_own_consents"
  ON public.consents FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- customer_profiles (3 policies)
-- ============================================================
DROP POLICY IF EXISTS "users_read_own_customer_profile" ON public.customer_profiles;
CREATE POLICY "users_read_own_customer_profile"
  ON public.customer_profiles FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_insert_own_customer_profile" ON public.customer_profiles;
CREATE POLICY "users_insert_own_customer_profile"
  ON public.customer_profiles FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_update_own_customer_profile" ON public.customer_profiles;
CREATE POLICY "users_update_own_customer_profile"
  ON public.customer_profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- data_quality_events (1 policy)
-- ============================================================
DROP POLICY IF EXISTS "Users can manage own data quality events" ON public.data_quality_events;
CREATE POLICY "Users can manage own data quality events"
  ON public.data_quality_events FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- decision_journal (1 policy)
-- ============================================================
DROP POLICY IF EXISTS "Users own their journal entries" ON public.decision_journal;
CREATE POLICY "Users own their journal entries"
  ON public.decision_journal FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- experiment_orders (3 policies — auth.uid() inside subquery)
-- ============================================================
DROP POLICY IF EXISTS "experiment_orders_select" ON public.experiment_orders;
CREATE POLICY "experiment_orders_select"
  ON public.experiment_orders FOR SELECT TO authenticated
  USING (experiment_id IN (SELECT id FROM experiments WHERE created_by = (select auth.uid())));

DROP POLICY IF EXISTS "experiment_orders_insert" ON public.experiment_orders;
CREATE POLICY "experiment_orders_insert"
  ON public.experiment_orders FOR INSERT TO authenticated
  WITH CHECK (experiment_id IN (SELECT id FROM experiments WHERE created_by = (select auth.uid())));

DROP POLICY IF EXISTS "experiment_orders_update" ON public.experiment_orders;
CREATE POLICY "experiment_orders_update"
  ON public.experiment_orders FOR UPDATE TO authenticated
  USING (experiment_id IN (SELECT id FROM experiments WHERE created_by = (select auth.uid())));

-- ============================================================
-- experiment_snapshots (2 policies)
-- ============================================================
DROP POLICY IF EXISTS "experiment_snapshots_select" ON public.experiment_snapshots;
CREATE POLICY "experiment_snapshots_select"
  ON public.experiment_snapshots FOR SELECT TO authenticated
  USING (experiment_id IN (SELECT id FROM experiments WHERE created_by = (select auth.uid())));

DROP POLICY IF EXISTS "experiment_snapshots_insert" ON public.experiment_snapshots;
CREATE POLICY "experiment_snapshots_insert"
  ON public.experiment_snapshots FOR INSERT TO authenticated
  WITH CHECK (experiment_id IN (SELECT id FROM experiments WHERE created_by = (select auth.uid())));

-- ============================================================
-- experiments (3 policies)
-- ============================================================
DROP POLICY IF EXISTS "experiments_select" ON public.experiments;
CREATE POLICY "experiments_select"
  ON public.experiments FOR SELECT TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "experiments_insert" ON public.experiments;
CREATE POLICY "experiments_insert"
  ON public.experiments FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "experiments_update" ON public.experiments;
CREATE POLICY "experiments_update"
  ON public.experiments FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()));

-- ============================================================
-- external_portfolio_links (4 policies)
-- ============================================================
DROP POLICY IF EXISTS "users_read_own_external_links" ON public.external_portfolio_links;
CREATE POLICY "users_read_own_external_links"
  ON public.external_portfolio_links FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_insert_own_external_links" ON public.external_portfolio_links;
CREATE POLICY "users_insert_own_external_links"
  ON public.external_portfolio_links FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_update_own_external_links" ON public.external_portfolio_links;
CREATE POLICY "users_update_own_external_links"
  ON public.external_portfolio_links FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_delete_own_external_links" ON public.external_portfolio_links;
CREATE POLICY "users_delete_own_external_links"
  ON public.external_portfolio_links FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- funding_transactions (2 policies)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own funding transactions" ON public.funding_transactions;
CREATE POLICY "Users can view own funding transactions"
  ON public.funding_transactions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own funding transactions" ON public.funding_transactions;
CREATE POLICY "Users can insert own funding transactions"
  ON public.funding_transactions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- market_regime_history (1 policy)
-- ============================================================
DROP POLICY IF EXISTS "Users own their regime history" ON public.market_regime_history;
CREATE POLICY "Users own their regime history"
  ON public.market_regime_history FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- onboarding_audit_log (2 policies)
-- ============================================================
DROP POLICY IF EXISTS "users_read_own_onboarding_audit" ON public.onboarding_audit_log;
CREATE POLICY "users_read_own_onboarding_audit"
  ON public.onboarding_audit_log FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_insert_own_onboarding_audit" ON public.onboarding_audit_log;
CREATE POLICY "users_insert_own_onboarding_audit"
  ON public.onboarding_audit_log FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- operator_actions (1 policy — uses operator_id)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert operator actions" ON public.operator_actions;
CREATE POLICY "Authenticated users can insert operator actions"
  ON public.operator_actions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = operator_id);

-- ============================================================
-- policy_change_log (1 policy)
-- ============================================================
DROP POLICY IF EXISTS "Users can read own audit log" ON public.policy_change_log;
CREATE POLICY "Users can read own audit log"
  ON public.policy_change_log FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- recommendation_explanations (2 policies)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own recommendation explanations" ON public.recommendation_explanations;
CREATE POLICY "Users can view own recommendation explanations"
  ON public.recommendation_explanations FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own recommendation explanations" ON public.recommendation_explanations;
CREATE POLICY "Users can insert own recommendation explanations"
  ON public.recommendation_explanations FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- regime_playbooks (1 policy)
-- ============================================================
DROP POLICY IF EXISTS "Users own their playbooks" ON public.regime_playbooks;
CREATE POLICY "Users own their playbooks"
  ON public.regime_playbooks FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- shadow_portfolios (1 policy)
-- ============================================================
DROP POLICY IF EXISTS "Users manage own shadow portfolios" ON public.shadow_portfolios;
CREATE POLICY "Users manage own shadow portfolios"
  ON public.shadow_portfolios FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- shadow_portfolio_snapshots (1 policy — uses subquery)
-- ============================================================
DROP POLICY IF EXISTS "Users see own shadow snapshots" ON public.shadow_portfolio_snapshots;
CREATE POLICY "Users see own shadow snapshots"
  ON public.shadow_portfolio_snapshots FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM shadow_portfolios sp
    WHERE sp.id = shadow_portfolio_snapshots.shadow_portfolio_id
      AND sp.user_id = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM shadow_portfolios sp
    WHERE sp.id = shadow_portfolio_snapshots.shadow_portfolio_id
      AND sp.user_id = (select auth.uid())
  ));

-- ============================================================
-- user_profiles (1 policy — uses id, not user_id)
-- ============================================================
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- ============================================================
-- user_trading_policy (3 policies)
-- ============================================================
DROP POLICY IF EXISTS "Users can read own policy" ON public.user_trading_policy;
CREATE POLICY "Users can read own policy"
  ON public.user_trading_policy FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own policy" ON public.user_trading_policy;
CREATE POLICY "Users can insert own policy"
  ON public.user_trading_policy FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own policy" ON public.user_trading_policy;
CREATE POLICY "Users can update own policy"
  ON public.user_trading_policy FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

COMMIT;
