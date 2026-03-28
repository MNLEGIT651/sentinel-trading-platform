-- Incident fallback support for bounded autonomy (Phase 4)

-- Add autonomy_mode to system_controls for global autonomy state
ALTER TABLE system_controls
  ADD COLUMN IF NOT EXISTS autonomy_mode TEXT DEFAULT 'suggest'
    CHECK (autonomy_mode IN ('disabled', 'alert_only', 'suggest', 'auto_approve', 'auto_execute'));

-- Track the mode before an incident so recovery can suggest restoring it
ALTER TABLE system_controls
  ADD COLUMN IF NOT EXISTS previous_autonomy_mode TEXT;

-- Extend operator_actions to allow incident_fallback action type
ALTER TABLE operator_actions DROP CONSTRAINT IF EXISTS operator_actions_action_type_check;
ALTER TABLE operator_actions ADD CONSTRAINT operator_actions_action_type_check
  CHECK (action_type IN (
    'halt_trading', 'resume_trading', 'approve_recommendation',
    'reject_recommendation', 'update_policy', 'change_mode',
    'override_risk', 'cancel_order', 'manual_order', 'role_change',
    'system_config_change', 'incident_fallback'
  ));

-- Extend recommendation_events to allow auto-execution event types
ALTER TABLE recommendation_events DROP CONSTRAINT IF EXISTS recommendation_events_event_type_check;
ALTER TABLE recommendation_events ADD CONSTRAINT recommendation_events_event_type_check
  CHECK (event_type IN (
    'created', 'risk_checked', 'risk_blocked', 'pending_approval',
    'approved', 'rejected', 'submitted', 'partially_filled',
    'filled', 'cancelled', 'failed', 'reviewed',
    'auto_approved', 'auto_execution_denied'
  ));
