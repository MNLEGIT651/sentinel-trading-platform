-- Composite index for stable keyset pagination on agent_alerts.
-- Covers ORDER BY created_at DESC, id DESC and the cursor filter:
--   WHERE (created_at < :cursor) OR (created_at = :cursor AND id < :cursorId)
CREATE INDEX IF NOT EXISTS idx_agent_alerts_pagination
  ON public.agent_alerts (created_at DESC, id DESC);
