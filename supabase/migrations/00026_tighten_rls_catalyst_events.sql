-- Tighten catalyst_events INSERT: require user_id match instead of always-true.
-- This table has user_id, so INSERT should be scoped to own rows.
--
-- Other flagged tables (agent_recommendations, backtest_results, cycle_history,
-- orchestrator_locks, workflow_jobs, workflow_runs, workflow_step_log) are
-- system/agent tables without user_id columns. Their permissive policies are
-- intentional for the agents orchestrator service which writes via anon key.

DROP POLICY IF EXISTS "Authenticated users can insert catalysts" ON catalyst_events;

CREATE POLICY "Users can insert own catalysts"
  ON catalyst_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
