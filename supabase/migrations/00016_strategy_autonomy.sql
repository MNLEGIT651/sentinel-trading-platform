-- Per-strategy autonomy controls for bounded autonomy (Phase 4)
ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS autonomy_mode TEXT DEFAULT 'suggest'
    CHECK (autonomy_mode IN ('disabled', 'alert_only', 'suggest', 'auto_approve', 'auto_execute'));
