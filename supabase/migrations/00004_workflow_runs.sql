-- ============================================================
-- Migration 00004: Workflow runs audit table
-- Tracks every agent run with workflow version, tools called,
-- and any self-improvement updates made.
-- ============================================================

CREATE TABLE workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_number integer NOT NULL,
  agent_role text NOT NULL,
  workflow_version integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  success boolean NOT NULL DEFAULT false,
  summary text,
  tools_called jsonb DEFAULT '[]',
  workflow_updates_made jsonb DEFAULT '[]',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_runs_cycle ON workflow_runs(cycle_number);
CREATE INDEX idx_workflow_runs_role ON workflow_runs(agent_role, created_at DESC);
