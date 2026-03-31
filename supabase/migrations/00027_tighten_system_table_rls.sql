-- Migration 00027: Tighten permissive RLS on system/agent tables
-- 
-- Problem: 12 RLS policies on system tables use WITH CHECK (true) or
-- USING (true) for INSERT/UPDATE/ALL operations for the authenticated role.
-- This lets ANY authenticated user write to agent_alerts, agent_recommendations,
-- backtest_results, cycle_history, orchestrator_locks, workflow_jobs,
-- workflow_runs, and workflow_step_log. Only service_role should write.
--
-- Fix: Drop the overly-permissive authenticated write policies.
-- Keep authenticated SELECT (read-only) and service_role ALL intact.

BEGIN;

-- ============================================================
-- agent_alerts: remove authenticated INSERT + UPDATE (keep SELECT)
-- ============================================================
DROP POLICY IF EXISTS "agent_alerts_authenticated_insert" ON public.agent_alerts;
DROP POLICY IF EXISTS "agent_alerts_authenticated_update" ON public.agent_alerts;

-- ============================================================
-- agent_recommendations: remove authenticated INSERT + UPDATE (keep SELECT)
-- ============================================================
DROP POLICY IF EXISTS "agent_recommendations_authenticated_insert" ON public.agent_recommendations;
DROP POLICY IF EXISTS "agent_recommendations_authenticated_update" ON public.agent_recommendations;

-- ============================================================
-- backtest_results: remove authenticated INSERT + UPDATE (keep SELECT)
-- ============================================================
DROP POLICY IF EXISTS "backtest_results_authenticated_write" ON public.backtest_results;
DROP POLICY IF EXISTS "backtest_results_authenticated_update" ON public.backtest_results;

-- ============================================================
-- cycle_history: remove authenticated INSERT (keep SELECT)
-- ============================================================
DROP POLICY IF EXISTS "auth_insert_cycles" ON public.cycle_history;

-- ============================================================
-- orchestrator_locks: remove the overly-permissive ALL policy
-- Replace with service_role-only write + authenticated read-only
-- (auth_read_locks SELECT policy already exists)
-- ============================================================
DROP POLICY IF EXISTS "auth_manage_locks" ON public.orchestrator_locks;

-- ============================================================
-- workflow_jobs: remove authenticated INSERT + UPDATE (keep SELECT)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert workflow jobs" ON public.workflow_jobs;
DROP POLICY IF EXISTS "Authenticated users can update workflow jobs" ON public.workflow_jobs;

-- ============================================================
-- workflow_runs: remove authenticated INSERT (keep SELECT)
-- ============================================================
DROP POLICY IF EXISTS "workflow_runs_authenticated_insert" ON public.workflow_runs;

-- ============================================================
-- workflow_step_log: remove authenticated INSERT (keep SELECT)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert step logs" ON public.workflow_step_log;

COMMIT;
