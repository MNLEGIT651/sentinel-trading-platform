/**
 * Policy-based auto-execution eligibility evaluator.
 *
 * Every auto-trade must have a recorded policy basis. This module decides
 * whether a recommendation can be auto-executed based on the active risk
 * policy, system controls, signal strength, position limits, and daily
 * trade caps.
 */

import { getSupabaseClient } from './supabase-client.js';
import { logger } from './logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoExecutionChecks {
  autonomyMode: string;
  strategyAutonomy: boolean;
  universeRestriction: boolean;
  signalStrength: boolean;
  positionSize: boolean;
  dailyLimit: boolean;
  haltStatus: boolean;
}

export interface AutoExecutionDecision {
  canAutoExecute: boolean;
  reason: string;
  policyVersion: number;
  checks: AutoExecutionChecks;
}

export interface PolicyInput {
  autonomy_mode: string;
  version: number;
  max_position_pct: number;
  daily_loss_limit_pct?: number;
}

export interface SystemControlsInput {
  trading_halted: boolean;
  live_execution_enabled?: boolean;
}

export interface RecommendationInput {
  id: string;
  signal_strength?: number | null | undefined;
  quantity: number;
  price?: number | null;
  ticker: string;
  strategy_name?: string | null;
}

// ---------------------------------------------------------------------------
// Configuration defaults (can be overridden via env)
// NaN guards ensure misconfigured env vars fall back to safe conservative defaults.
// ---------------------------------------------------------------------------

const _parsedSignalThreshold = parseFloat(process.env.AUTO_EXEC_SIGNAL_THRESHOLD ?? '0.7');
const SIGNAL_STRENGTH_THRESHOLD = Number.isFinite(_parsedSignalThreshold)
  ? _parsedSignalThreshold
  : 0.7;

const _parsedDailyLimit = parseInt(process.env.AUTO_EXEC_DAILY_LIMIT ?? '10', 10);
const DAILY_AUTO_TRADE_LIMIT = Number.isFinite(_parsedDailyLimit) ? _parsedDailyLimit : 10;

const _parsedMaxPositionValue = parseFloat(process.env.AUTO_EXEC_MAX_POSITION_VALUE ?? '50000');
const MAX_AUTO_POSITION_VALUE = Number.isFinite(_parsedMaxPositionValue)
  ? _parsedMaxPositionValue
  : 50000;

// Autonomy modes that permit auto-execution
const AUTO_EXECUTE_MODES = new Set(['auto_execute', 'auto_approve']);

// ---------------------------------------------------------------------------
// Core evaluator
// ---------------------------------------------------------------------------

export async function evaluateAutoExecution(
  recommendation: RecommendationInput,
  policy: PolicyInput,
  systemControls: SystemControlsInput,
): Promise<AutoExecutionDecision> {
  const checks: AutoExecutionChecks = {
    autonomyMode: policy.autonomy_mode,
    strategyAutonomy: false,
    universeRestriction: false,
    signalStrength: false,
    positionSize: false,
    dailyLimit: false,
    haltStatus: false,
  };

  // 1. Check autonomy mode
  if (!AUTO_EXECUTE_MODES.has(policy.autonomy_mode)) {
    return {
      canAutoExecute: false,
      reason: `Autonomy mode '${policy.autonomy_mode}' does not permit auto-execution`,
      policyVersion: policy.version,
      checks,
    };
  }

  // 2. Check system is not halted
  if (systemControls.trading_halted) {
    return {
      canAutoExecute: false,
      reason: 'Trading is currently halted',
      policyVersion: policy.version,
      checks,
    };
  }
  checks.haltStatus = true;

  // 3. Check per-strategy autonomy mode
  if (recommendation.strategy_name) {
    const strategyBlock = await isStrategyBlocked(recommendation.strategy_name);
    if (strategyBlock) {
      return {
        canAutoExecute: false,
        reason: strategyBlock,
        policyVersion: policy.version,
        checks,
      };
    }
  }
  checks.strategyAutonomy = true;

  // 4. Check universe restrictions (blacklist / whitelist)
  const universeBlock = await isUniverseRestricted(recommendation.ticker);
  if (universeBlock) {
    return {
      canAutoExecute: false,
      reason: universeBlock,
      policyVersion: policy.version,
      checks,
    };
  }
  checks.universeRestriction = true;

  // 5. Check signal strength
  const signalStrength = recommendation.signal_strength ?? 0;
  if (signalStrength < SIGNAL_STRENGTH_THRESHOLD) {
    return {
      canAutoExecute: false,
      reason: `Signal strength ${signalStrength.toFixed(2)} is below threshold ${SIGNAL_STRENGTH_THRESHOLD}`,
      policyVersion: policy.version,
      checks,
    };
  }
  checks.signalStrength = true;

  // 6. Check position size within limits
  const estimatedPrice = recommendation.price;
  if (estimatedPrice == null || estimatedPrice <= 0) {
    return {
      canAutoExecute: false,
      reason: 'Cannot auto-execute: no reliable price available for position size check',
      policyVersion: policy.version,
      checks,
    };
  }
  const positionValue = recommendation.quantity * estimatedPrice;
  if (positionValue > MAX_AUTO_POSITION_VALUE) {
    return {
      canAutoExecute: false,
      reason: `Position value $${positionValue.toFixed(0)} exceeds auto-execution limit $${MAX_AUTO_POSITION_VALUE}`,
      policyVersion: policy.version,
      checks,
    };
  }
  checks.positionSize = true;

  // 7. Check daily auto-trade count hasn't exceeded limit
  const dailyCountExceeded = await isDailyLimitExceeded();
  if (dailyCountExceeded) {
    return {
      canAutoExecute: false,
      reason: `Daily auto-execution limit of ${DAILY_AUTO_TRADE_LIMIT} trades reached`,
      policyVersion: policy.version,
      checks,
    };
  }
  checks.dailyLimit = true;

  // All checks passed
  return {
    canAutoExecute: true,
    reason: 'All auto-execution policy checks passed',
    policyVersion: policy.version,
    checks,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a strategy's autonomy mode blocks auto-execution.
 * Returns a block reason string, or null if allowed.
 */
async function isStrategyBlocked(strategyName: string): Promise<string | null> {
  try {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from('strategies')
      .select('name, autonomy_mode')
      .eq('name', strategyName)
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn('auto-execution.strategyAutonomy.error', { error: error.message });
      // Fail closed — block auto-execution when strategy permissions cannot be verified
      return 'Unable to verify strategy autonomy mode (database error)';
    }

    if (!data) {
      // Strategy not in DB — allow (engine-defined strategies may not be persisted)
      return null;
    }

    const mode = data.autonomy_mode ?? 'suggest';
    if (mode === 'disabled') {
      return `Strategy '${strategyName}' has autonomy mode 'disabled'`;
    }
    if (mode === 'alert_only') {
      return `Strategy '${strategyName}' has autonomy mode 'alert_only' — alerts only, no execution`;
    }
    if (mode === 'suggest') {
      return `Strategy '${strategyName}' has autonomy mode 'suggest' — requires manual approval`;
    }

    // 'auto_approve' and 'auto_execute' permit auto-execution
    return null;
  } catch (err) {
    logger.warn('auto-execution.strategyAutonomy.exception', {
      error: err instanceof Error ? err.message : String(err),
    });
    // Fail closed — block auto-execution on unexpected errors
    return 'Unable to verify strategy autonomy mode (unexpected error)';
  }
}

/**
 * Check if a ticker is restricted by universe restriction rules.
 * Returns a block reason string, or null if allowed.
 */
async function isUniverseRestricted(ticker: string): Promise<string | null> {
  try {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from('universe_restrictions')
      .select('restriction_type, symbols')
      .eq('enabled', true);

    if (error) {
      logger.warn('auto-execution.universeRestriction.error', { error: error.message });
      // Fail closed — if we can't check restrictions, block
      return 'Unable to verify universe restrictions';
    }

    if (!data || data.length === 0) {
      return null;
    }

    const upperTicker = ticker.toUpperCase();

    // Check blacklists first — any blacklist containing the ticker blocks it
    for (const restriction of data) {
      if (restriction.restriction_type === 'blacklist') {
        const symbols: string[] = restriction.symbols ?? [];
        if (symbols.map((s: string) => s.toUpperCase()).includes(upperTicker)) {
          return `Ticker '${ticker}' is blacklisted by universe restriction`;
        }
      }
    }

    // Check whitelists — if any whitelist exists, the ticker must be in at least one
    const whitelists = data.filter(
      (r: { restriction_type: string }) => r.restriction_type === 'whitelist',
    );
    if (whitelists.length > 0) {
      const inAnyWhitelist = whitelists.some((wl: { symbols: string[] }) => {
        const symbols: string[] = wl.symbols ?? [];
        return symbols.map((s: string) => s.toUpperCase()).includes(upperTicker);
      });
      if (!inAnyWhitelist) {
        return `Ticker '${ticker}' is not in any active whitelist`;
      }
    }

    return null;
  } catch (err) {
    logger.warn('auto-execution.universeRestriction.exception', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 'Unable to verify universe restrictions';
  }
}

/**
 * Count today's auto-executed trades by querying recommendation_events
 * for events with actor_type='policy' and event_type='auto_approved'.
 */
async function isDailyLimitExceeded(): Promise<boolean> {
  try {
    const db = getSupabaseClient();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { count, error } = await db
      .from('recommendation_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'auto_approved')
      .eq('actor_type', 'policy')
      .gte('created_at', todayStart.toISOString());

    if (error) {
      logger.warn('auto-execution.dailyCount.error', { error: error.message });
      // Fail closed — if we can't count, don't auto-execute
      return true;
    }

    return (count ?? 0) >= DAILY_AUTO_TRADE_LIMIT;
  } catch (err) {
    logger.warn('auto-execution.dailyCount.exception', {
      error: err instanceof Error ? err.message : String(err),
    });
    return true;
  }
}

/**
 * Fetch the active risk policy from Supabase.
 * Returns null if no active policy is found.
 */
export async function fetchActivePolicy(): Promise<PolicyInput | null> {
  try {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from('risk_policies')
      .select('autonomy_mode, version, max_position_pct, daily_loss_limit_pct')
      .is('disabled_at', null)
      .order('enabled_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data as PolicyInput;
  } catch {
    return null;
  }
}

/**
 * Fetch system controls from Supabase.
 * Returns a safe default (halted) if the query fails.
 */
export async function fetchSystemControls(): Promise<SystemControlsInput> {
  try {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from('system_controls')
      .select('trading_halted, live_execution_enabled')
      .limit(1)
      .single();

    if (error || !data) return { trading_halted: true };
    return data as SystemControlsInput;
  } catch {
    return { trading_halted: true };
  }
}

/**
 * Log an auto-execution decision to recommendation_events for audit trail.
 */
export async function logAutoExecutionDecision(
  recommendationId: string,
  decision: AutoExecutionDecision,
): Promise<void> {
  try {
    const db = getSupabaseClient();
    await db.from('recommendation_events').insert({
      recommendation_id: recommendationId,
      event_type: decision.canAutoExecute ? 'auto_approved' : 'auto_execution_denied',
      actor_type: 'policy',
      actor_id: `policy_v${decision.policyVersion}`,
      payload: {
        decision: {
          canAutoExecute: decision.canAutoExecute,
          reason: decision.reason,
          policyVersion: decision.policyVersion,
          checks: decision.checks,
        },
      },
    });
  } catch (err) {
    logger.error('AUDIT GAP: auto-execution.logDecision.failed', {
      recommendationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
