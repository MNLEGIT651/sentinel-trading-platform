-- Migration 00029: Optimize auth.role() initplan + add missing FK indexes
--
-- Part A: Replace auth.role() with (select auth.role()) in 20 policies
-- across 10 tables to prevent per-row re-evaluation.
--
-- Part B: Add missing indexes on 3 foreign key columns.

BEGIN;

-- ============================================================
-- PART A: auth.role() initplan optimization
-- ============================================================

-- fills (2 policies)
DROP POLICY IF EXISTS "Authenticated users can read fills" ON public.fills;
CREATE POLICY "Authenticated users can read fills"
  ON public.fills FOR SELECT TO authenticated
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert fills" ON public.fills;
CREATE POLICY "Authenticated users can insert fills"
  ON public.fills FOR INSERT TO authenticated
  WITH CHECK ((select auth.role()) = 'authenticated');

-- market_snapshots (2 policies)
DROP POLICY IF EXISTS "Authenticated users can read market snapshots" ON public.market_snapshots;
CREATE POLICY "Authenticated users can read market snapshots"
  ON public.market_snapshots FOR SELECT TO authenticated
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Service role can manage market snapshots" ON public.market_snapshots;
CREATE POLICY "Service role can manage market snapshots"
  ON public.market_snapshots FOR ALL TO service_role
  USING ((select auth.role()) = 'service_role');

-- recommendation_events (2 policies)
DROP POLICY IF EXISTS "Authenticated users can read recommendation events" ON public.recommendation_events;
CREATE POLICY "Authenticated users can read recommendation events"
  ON public.recommendation_events FOR SELECT TO authenticated
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert recommendation events" ON public.recommendation_events;
CREATE POLICY "Authenticated users can insert recommendation events"
  ON public.recommendation_events FOR INSERT TO authenticated
  WITH CHECK ((select auth.role()) = 'authenticated');

-- risk_evaluations (2 policies)
DROP POLICY IF EXISTS "Authenticated users can read risk evaluations" ON public.risk_evaluations;
CREATE POLICY "Authenticated users can read risk evaluations"
  ON public.risk_evaluations FOR SELECT TO authenticated
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert risk evaluations" ON public.risk_evaluations;
CREATE POLICY "Authenticated users can insert risk evaluations"
  ON public.risk_evaluations FOR INSERT TO authenticated
  WITH CHECK ((select auth.role()) = 'authenticated');

-- risk_policies (2 policies)
DROP POLICY IF EXISTS "Authenticated users can read risk policies" ON public.risk_policies;
CREATE POLICY "Authenticated users can read risk policies"
  ON public.risk_policies FOR SELECT TO authenticated
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert risk policies" ON public.risk_policies;
CREATE POLICY "Authenticated users can insert risk policies"
  ON public.risk_policies FOR INSERT TO authenticated
  WITH CHECK ((select auth.role()) = 'authenticated');

-- role_change_log (1 policy — only SELECT uses auth.role())
DROP POLICY IF EXISTS "authenticated_read_role_changes" ON public.role_change_log;
CREATE POLICY "authenticated_read_role_changes"
  ON public.role_change_log FOR SELECT TO authenticated
  USING ((select auth.role()) = 'authenticated');

-- signal_runs (2 policies)
DROP POLICY IF EXISTS "Authenticated users can read signal runs" ON public.signal_runs;
CREATE POLICY "Authenticated users can read signal runs"
  ON public.signal_runs FOR SELECT TO authenticated
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert signal runs" ON public.signal_runs;
CREATE POLICY "Authenticated users can insert signal runs"
  ON public.signal_runs FOR INSERT TO authenticated
  WITH CHECK ((select auth.role()) = 'authenticated');

-- strategy_health_snapshots (2 policies)
DROP POLICY IF EXISTS "Authenticated users can read strategy health" ON public.strategy_health_snapshots;
CREATE POLICY "Authenticated users can read strategy health"
  ON public.strategy_health_snapshots FOR SELECT TO authenticated
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Service role can manage strategy health" ON public.strategy_health_snapshots;
CREATE POLICY "Service role can manage strategy health"
  ON public.strategy_health_snapshots FOR ALL TO service_role
  USING ((select auth.role()) = 'service_role');

-- system_controls (2 policies)
DROP POLICY IF EXISTS "Authenticated users can read system controls" ON public.system_controls;
CREATE POLICY "Authenticated users can read system controls"
  ON public.system_controls FOR SELECT TO authenticated
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update system controls" ON public.system_controls;
CREATE POLICY "Authenticated users can update system controls"
  ON public.system_controls FOR UPDATE TO authenticated
  USING ((select auth.role()) = 'authenticated');

-- universe_restrictions (3 policies)
DROP POLICY IF EXISTS "Authenticated users can read universe restrictions" ON public.universe_restrictions;
CREATE POLICY "Authenticated users can read universe restrictions"
  ON public.universe_restrictions FOR SELECT TO authenticated
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert universe restrictions" ON public.universe_restrictions;
CREATE POLICY "Authenticated users can insert universe restrictions"
  ON public.universe_restrictions FOR INSERT TO authenticated
  WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete universe restrictions" ON public.universe_restrictions;
CREATE POLICY "Authenticated users can delete universe restrictions"
  ON public.universe_restrictions FOR DELETE TO authenticated
  USING ((select auth.role()) = 'authenticated');

-- ============================================================
-- PART B: Add missing foreign key indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advisor_preferences_originating_message_id
  ON public.advisor_preferences (originating_message_id);

CREATE INDEX IF NOT EXISTS idx_external_portfolio_links_user_id
  ON public.external_portfolio_links (user_id);

CREATE INDEX IF NOT EXISTS idx_funding_transactions_bank_link_id
  ON public.funding_transactions (bank_link_id);

COMMIT;
