-- Migration: 00006_orchestrator_locks.sql
-- Purpose: Distributed lock table for agent cycle coordination.
-- Replaces the process-local _isRunning flag so multiple instances
-- cannot run concurrent cycles.

-- ============================================================================
-- Lock table
-- ============================================================================
CREATE TABLE orchestrator_locks (
  lock_name    TEXT        PRIMARY KEY,
  holder_id    TEXT        NOT NULL,
  acquired_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- acquire_lock: atomic lock acquisition
--   Returns TRUE if the lock was acquired, FALSE otherwise.
--   Expired locks are automatically taken over.
--   The same holder can re-acquire its own lock (extend).
-- ============================================================================
CREATE OR REPLACE FUNCTION acquire_lock(
  p_lock_name   TEXT,
  p_holder_id   TEXT,
  p_ttl_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO orchestrator_locks (lock_name, holder_id, expires_at)
  VALUES (
    p_lock_name,
    p_holder_id,
    now() + (p_ttl_seconds || ' seconds')::interval
  )
  ON CONFLICT (lock_name) DO UPDATE
    SET holder_id    = EXCLUDED.holder_id,
        acquired_at  = now(),
        expires_at   = EXCLUDED.expires_at,
        heartbeat_at = now()
    WHERE orchestrator_locks.expires_at < now()
       OR orchestrator_locks.holder_id = p_holder_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

-- ============================================================================
-- release_lock: release a lock held by a specific holder
-- ============================================================================
CREATE OR REPLACE FUNCTION release_lock(
  p_lock_name TEXT,
  p_holder_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM orchestrator_locks
  WHERE lock_name = p_lock_name
    AND holder_id = p_holder_id;
  RETURN FOUND;
END;
$$;

-- ============================================================================
-- heartbeat_lock: extend lock lifetime without re-acquiring
-- ============================================================================
CREATE OR REPLACE FUNCTION heartbeat_lock(
  p_lock_name   TEXT,
  p_holder_id   TEXT,
  p_ttl_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE orchestrator_locks
  SET heartbeat_at = now(),
      expires_at   = now() + (p_ttl_seconds || ' seconds')::interval
  WHERE lock_name = p_lock_name
    AND holder_id = p_holder_id;
  RETURN FOUND;
END;
$$;

-- ============================================================================
-- is_lock_held: check if a lock is currently active (not expired)
-- ============================================================================
CREATE OR REPLACE FUNCTION is_lock_held(
  p_lock_name TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM orchestrator_locks
    WHERE lock_name = p_lock_name
      AND expires_at > now()
  ) INTO v_exists;
  RETURN v_exists;
END;
$$;

-- ============================================================================
-- Cycle history table (optional but recommended for observability)
-- ============================================================================
CREATE TABLE cycle_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_id   TEXT        NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  agents_run  TEXT[]      DEFAULT '{}',
  outcome     TEXT        NOT NULL DEFAULT 'started',
  error       TEXT,

  CONSTRAINT chk_outcome CHECK (outcome IN (
    'started', 'completed', 'failed', 'halted', 'lock_rejected'
  ))
);

CREATE INDEX idx_cycle_history_started ON cycle_history (started_at DESC);
