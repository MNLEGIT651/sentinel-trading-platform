-- ============================================================
-- Migration 00015: Durable Workflow Jobs
-- DB-backed job queue for recommendation/order workflows
-- Designed to migrate to Temporal-style durable execution later
-- ============================================================

-- ─── workflow_jobs: durable job queue ─────────────────────────
CREATE TABLE IF NOT EXISTS workflow_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_type   TEXT NOT NULL,        -- 'recommendation_lifecycle', 'order_execution', 'risk_evaluation', 'agent_cycle'
  idempotency_key TEXT UNIQUE,          -- prevent duplicate job creation
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'retrying')),
  current_step    TEXT,                 -- current step in the workflow state machine
  steps_completed TEXT[] DEFAULT '{}',  -- ordered list of completed steps
  input_data      JSONB DEFAULT '{}',   -- workflow input parameters
  output_data     JSONB DEFAULT '{}',   -- workflow result / partial results
  error_message   TEXT,
  error_count     INTEGER DEFAULT 0,
  max_retries     INTEGER DEFAULT 3,
  retry_after     TIMESTAMPTZ,          -- backoff: don't retry before this time
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  timeout_at      TIMESTAMPTZ,          -- if running past this, consider timed out
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- references to domain objects
  recommendation_id UUID,
  order_id          UUID,
  agent_run_id      UUID
);

-- Indexes for common query patterns
CREATE INDEX idx_workflow_jobs_status ON workflow_jobs(status);
CREATE INDEX idx_workflow_jobs_type_status ON workflow_jobs(workflow_type, status);
CREATE INDEX idx_workflow_jobs_retry ON workflow_jobs(status, retry_after)
  WHERE status IN ('failed', 'retrying') AND retry_after IS NOT NULL;
CREATE INDEX idx_workflow_jobs_timeout ON workflow_jobs(status, timeout_at)
  WHERE status = 'running' AND timeout_at IS NOT NULL;
CREATE INDEX idx_workflow_jobs_recommendation ON workflow_jobs(recommendation_id)
  WHERE recommendation_id IS NOT NULL;
CREATE INDEX idx_workflow_jobs_idempotency ON workflow_jobs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_workflow_jobs_created ON workflow_jobs(created_at DESC);

-- ─── workflow_step_log: immutable step execution history ──────
CREATE TABLE IF NOT EXISTS workflow_step_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES workflow_jobs(id) ON DELETE CASCADE,
  step_name    TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
  input_data   JSONB DEFAULT '{}',
  output_data  JSONB DEFAULT '{}',
  error        TEXT,
  duration_ms  INTEGER,
  executed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_step_log_job ON workflow_step_log(job_id, executed_at);

-- ─── Auto-update updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_workflow_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workflow_jobs_updated_at
  BEFORE UPDATE ON workflow_jobs
  FOR EACH ROW EXECUTE FUNCTION update_workflow_jobs_updated_at();

-- ─── Claim next available job (atomic) ────────────────────────
CREATE OR REPLACE FUNCTION claim_workflow_job(
  p_workflow_type TEXT,
  p_worker_id TEXT,
  p_timeout_seconds INTEGER DEFAULT 300
)
RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Claim a pending or retryable job atomically
  UPDATE workflow_jobs
  SET status = 'running',
      started_at = COALESCE(started_at, now()),
      timeout_at = now() + (p_timeout_seconds || ' seconds')::interval,
      output_data = output_data || jsonb_build_object('worker_id', p_worker_id),
      updated_at = now()
  WHERE id = (
    SELECT id FROM workflow_jobs
    WHERE workflow_type = p_workflow_type
      AND (
        status = 'pending'
        OR (status = 'retrying' AND (retry_after IS NULL OR retry_after <= now()))
        OR (status = 'running' AND timeout_at < now())  -- reclaim timed-out jobs
      )
    ORDER BY
      CASE WHEN status = 'running' AND timeout_at < now() THEN 0 ELSE 1 END,
      created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- ─── Complete a job step ──────────────────────────────────────
CREATE OR REPLACE FUNCTION complete_workflow_step(
  p_job_id UUID,
  p_step_name TEXT,
  p_output JSONB DEFAULT '{}',
  p_next_step TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Log the completed step
  INSERT INTO workflow_step_log (job_id, step_name, status, output_data, duration_ms)
  VALUES (p_job_id, p_step_name, 'completed', p_output, p_duration_ms);

  -- Update job state
  UPDATE workflow_jobs
  SET steps_completed = array_append(steps_completed, p_step_name),
      current_step = p_next_step,
      output_data = output_data || p_output,
      updated_at = now()
  WHERE id = p_job_id AND status = 'running';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ─── Fail a job (with optional retry) ─────────────────────────
CREATE OR REPLACE FUNCTION fail_workflow_job(
  p_job_id UUID,
  p_error TEXT,
  p_step_name TEXT DEFAULT NULL,
  p_retry BOOLEAN DEFAULT true
)
RETURNS TEXT AS $$ -- returns new status
DECLARE
  v_error_count INTEGER;
  v_max_retries INTEGER;
  v_new_status TEXT;
BEGIN
  -- Log failed step if specified
  IF p_step_name IS NOT NULL THEN
    INSERT INTO workflow_step_log (job_id, step_name, status, error)
    VALUES (p_job_id, p_step_name, 'failed', p_error);
  END IF;

  SELECT error_count, max_retries INTO v_error_count, v_max_retries
  FROM workflow_jobs WHERE id = p_job_id;

  IF p_retry AND v_error_count < v_max_retries THEN
    v_new_status := 'retrying';
  ELSE
    v_new_status := 'failed';
  END IF;

  UPDATE workflow_jobs
  SET status = v_new_status,
      error_message = p_error,
      error_count = error_count + 1,
      retry_after = CASE
        WHEN v_new_status = 'retrying'
        THEN now() + ((v_error_count + 1) * interval '30 seconds')  -- exponential-ish backoff
        ELSE NULL
      END,
      completed_at = CASE WHEN v_new_status = 'failed' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_job_id;

  RETURN v_new_status;
END;
$$ LANGUAGE plpgsql;

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE workflow_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view workflow jobs"
  ON workflow_jobs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert workflow jobs"
  ON workflow_jobs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update workflow jobs"
  ON workflow_jobs FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can view step logs"
  ON workflow_step_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert step logs"
  ON workflow_step_log FOR INSERT
  TO authenticated WITH CHECK (true);

-- ─── Realtime ─────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE workflow_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE workflow_step_log;
