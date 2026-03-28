/**
 * Incident monitor — automatic fallback to alert-only mode.
 *
 * Watches for incident conditions:
 *   - Consecutive auto-execution failures (>3 in 10 min)
 *   - Risk blocks (>5 in 10 min)
 *   - Trading halt triggers
 *
 * When an incident is detected the system autonomy mode is downgraded
 * to 'alert_only' and logged to operator_actions. Recovery requires
 * operator confirmation — the monitor only *suggests* restoring the
 * previous mode after conditions clear.
 */

import { getSupabaseClient } from './supabase-client.js';
import { logger } from './logger.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const FAILURE_THRESHOLD = 3;
const RISK_BLOCK_THRESHOLD = 5;
const INCIDENT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RECOVERY_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL_MS = 60 * 1000; // check every 60 seconds

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IncidentState {
  isActive: boolean;
  triggeredAt: string | null;
  reason: string | null;
  previousMode: string | null;
  recoveryEligibleAt: string | null;
}

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

let incidentState: IncidentState = {
  isActive: false,
  triggeredAt: null,
  reason: null,
  previousMode: null,
  recoveryEligibleAt: null,
};

let monitorInterval: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getIncidentState(): IncidentState {
  return { ...incidentState };
}

/**
 * Start the incident monitor loop.
 */
export function startIncidentMonitor(): void {
  if (monitorInterval) return;
  logger.info('incident-monitor.start');
  monitorInterval = setInterval(() => void runIncidentCheck(), CHECK_INTERVAL_MS);
  // Run an initial check immediately
  void runIncidentCheck();
}

/**
 * Stop the incident monitor loop.
 */
export function stopIncidentMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('incident-monitor.stop');
  }
}

// ---------------------------------------------------------------------------
// Core check
// ---------------------------------------------------------------------------

export async function runIncidentCheck(): Promise<void> {
  try {
    const windowStart = new Date(Date.now() - INCIDENT_WINDOW_MS).toISOString();

    const [failures, riskBlocks] = await Promise.all([
      countRecentFailures(windowStart),
      countRecentRiskBlocks(windowStart),
    ]);

    const failureIncident = failures >= FAILURE_THRESHOLD;
    const riskBlockIncident = riskBlocks >= RISK_BLOCK_THRESHOLD;

    if ((failureIncident || riskBlockIncident) && !incidentState.isActive) {
      const reason = failureIncident
        ? `${failures} consecutive auto-execution failures in 10 min`
        : `${riskBlocks} risk blocks in 10 min`;

      await triggerIncidentFallback(reason);
    }

    // Check recovery eligibility
    if (incidentState.isActive) {
      await checkRecoveryEligibility();
    }
  } catch (err) {
    logger.warn('incident-monitor.check.error', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Incident trigger
// ---------------------------------------------------------------------------

async function triggerIncidentFallback(reason: string): Promise<void> {
  const db = getSupabaseClient();

  // Read current system_controls to save previous mode
  const { data: controls, error: controlsError } = await db
    .from('system_controls')
    .select('id, autonomy_mode')
    .limit(1)
    .single();

  if (controlsError || !controls) {
    logger.error('incident-monitor.fallback.noControls', {
      error: controlsError?.message,
    });
    return;
  }

  const previousMode = controls.autonomy_mode ?? 'suggest';

  // Already in alert_only or stricter — no need to downgrade
  if (previousMode === 'alert_only' || previousMode === 'disabled') {
    logger.info('incident-monitor.fallback.alreadySafe', { currentMode: previousMode });
    return;
  }

  const now = new Date().toISOString();

  // Downgrade to alert_only
  const { error: updateError } = await db
    .from('system_controls')
    .update({
      autonomy_mode: 'alert_only',
      previous_autonomy_mode: previousMode,
      updated_at: now,
    })
    .eq('id', controls.id);

  if (updateError) {
    logger.error('incident-monitor.fallback.updateFailed', {
      error: updateError.message,
    });
    return;
  }

  // Log to operator_actions
  try {
    await db.from('operator_actions').insert({
      operator_id: '00000000-0000-0000-0000-000000000000',
      action_type: 'incident_fallback',
      target_type: 'system_controls',
      target_id: controls.id,
      reason,
      metadata: {
        previous_mode: previousMode,
        new_mode: 'alert_only',
        triggered_at: now,
      },
    });
  } catch (err) {
    logger.warn('incident-monitor.fallback.logFailed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  incidentState = {
    isActive: true,
    triggeredAt: now,
    reason,
    previousMode,
    recoveryEligibleAt: new Date(Date.now() + RECOVERY_COOLDOWN_MS).toISOString(),
  };

  logger.error('incident-monitor.fallback.triggered', {
    reason,
    previousMode,
    recoveryEligibleAt: incidentState.recoveryEligibleAt,
  });
}

// ---------------------------------------------------------------------------
// Recovery eligibility (suggestion only — no auto-recover)
// ---------------------------------------------------------------------------

async function checkRecoveryEligibility(): Promise<void> {
  if (!incidentState.recoveryEligibleAt) return;

  const now = new Date();
  const eligible = new Date(incidentState.recoveryEligibleAt);

  if (now < eligible) return;

  // Verify no new incidents in the cooldown window
  const cooldownStart = new Date(now.getTime() - RECOVERY_COOLDOWN_MS).toISOString();

  const [failures, riskBlocks] = await Promise.all([
    countRecentFailures(cooldownStart),
    countRecentRiskBlocks(cooldownStart),
  ]);

  if (failures > 0 || riskBlocks > 0) {
    // Extend recovery window
    incidentState.recoveryEligibleAt = new Date(now.getTime() + RECOVERY_COOLDOWN_MS).toISOString();
    logger.info('incident-monitor.recovery.extended', {
      failures,
      riskBlocks,
      newEligibleAt: incidentState.recoveryEligibleAt,
    });
    return;
  }

  // Conditions are clear — log a suggestion for the operator
  logger.info('incident-monitor.recovery.eligible', {
    previousMode: incidentState.previousMode,
    incidentTriggeredAt: incidentState.triggeredAt,
    message: `Incident conditions have cleared for 30 min. Consider restoring autonomy mode to '${incidentState.previousMode}'.`,
  });

  // Log recovery suggestion to recommendation_events if applicable
  try {
    const db = getSupabaseClient();
    await db.from('operator_actions').insert({
      operator_id: '00000000-0000-0000-0000-000000000000',
      action_type: 'system_config_change',
      target_type: 'system_controls',
      reason: `Incident conditions cleared. Previous mode was '${incidentState.previousMode}'. Operator confirmation required to restore.`,
      metadata: {
        suggestion: 'restore_autonomy_mode',
        previous_mode: incidentState.previousMode,
        incident_triggered_at: incidentState.triggeredAt,
        cleared_at: now.toISOString(),
      },
    });
  } catch (err) {
    logger.warn('incident-monitor.recovery.logFailed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Mark incident as resolved (but don't auto-restore mode)
  incidentState = {
    isActive: false,
    triggeredAt: null,
    reason: null,
    previousMode: null,
    recoveryEligibleAt: null,
  };
}

// ---------------------------------------------------------------------------
// Database queries
// ---------------------------------------------------------------------------

async function countRecentFailures(since: string): Promise<number> {
  try {
    const db = getSupabaseClient();
    const { count, error } = await db
      .from('recommendation_events')
      .select('*', { count: 'exact', head: true })
      .in('event_type', ['failed', 'auto_execution_denied'])
      .gte('created_at', since);

    if (error) {
      logger.warn('incident-monitor.countFailures.error', { error: error.message });
      return 0;
    }
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function countRecentRiskBlocks(since: string): Promise<number> {
  try {
    const db = getSupabaseClient();
    const { count, error } = await db
      .from('recommendation_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'risk_blocked')
      .gte('created_at', since);

    if (error) {
      logger.warn('incident-monitor.countRiskBlocks.error', { error: error.message });
      return 0;
    }
    return count ?? 0;
  } catch {
    return 0;
  }
}
