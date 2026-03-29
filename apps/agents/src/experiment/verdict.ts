/**
 * Experiment Verdict Computation
 *
 * Computes go/no_go/inconclusive verdict based on experiment metrics.
 * Thresholds align with EXPERIMENT_VERDICT_THRESHOLDS in @sentinel/shared.
 */

import { getSupabaseClient } from '../supabase-client.js';
import { logger } from '../logger.js';

// Verdict thresholds (must match packages/shared/src/types.ts)
const THRESHOLDS = {
  go: {
    min_sharpe: 0.5,
    max_drawdown_pct: 15,
    min_win_rate: 0.4,
    max_error_rate: 0.05,
  },
  no_go: {
    max_sharpe: 0,
    min_drawdown_pct: 25,
    max_error_rate: 0.2,
  },
} as const;

export interface VerdictResult {
  verdict: 'go' | 'no_go' | 'inconclusive';
  reason: string;
  metrics: {
    sharpe_ratio: number | null;
    max_drawdown_pct: number;
    win_rate: number | null;
    error_rate: number;
    total_return_pct: number;
    profit_factor: number | null;
    total_orders: number;
    total_cycles: number;
  };
}

export async function computeVerdict(experimentId: string): Promise<VerdictResult> {
  const supabase = getSupabaseClient();

  // Fetch all snapshots
  const { data: snapshots, error: snapErr } = await supabase
    .from('experiment_snapshots')
    .select('*')
    .eq('experiment_id', experimentId)
    .order('snapshot_date', { ascending: true });

  if (snapErr || !snapshots || snapshots.length === 0) {
    logger.warn('verdict.compute.no_snapshots', { experimentId });
    return {
      verdict: 'inconclusive',
      reason: 'Insufficient data: no snapshots available',
      metrics: {
        sharpe_ratio: null,
        max_drawdown_pct: 0,
        win_rate: null,
        error_rate: 0,
        total_return_pct: 0,
        profit_factor: null,
        total_orders: 0,
        total_cycles: 0,
      },
    };
  }

  // Aggregate metrics from snapshots
  const lastSnapshot = snapshots[snapshots.length - 1]!;

  let maxDrawdown = 0;
  let totalCycles = 0;
  let totalErrors = 0;
  let totalOrders = 0;
  const dailyReturns: number[] = [];

  for (const s of snapshots) {
    if (s.max_drawdown_pct > maxDrawdown) maxDrawdown = s.max_drawdown_pct;
    totalCycles += s.cycle_count ?? 0;
    totalErrors += s.error_count ?? 0;
    totalOrders += s.orders_filled ?? 0;
    if (s.daily_return_pct !== undefined && s.daily_return_pct !== null) {
      dailyReturns.push(Number(s.daily_return_pct));
    }
  }

  // Compute Sharpe ratio from daily returns
  let sharpeRatio: number | null = null;
  if (dailyReturns.length >= 5) {
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / dailyReturns.length;
    const stdDev = Math.sqrt(variance);
    sharpeRatio = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;
  }

  const errorRate = totalCycles > 0 ? totalErrors / totalCycles : 0;
  const totalReturnPct = Number(lastSnapshot.cumulative_return_pct ?? 0);
  const winRate = lastSnapshot.win_rate != null ? Number(lastSnapshot.win_rate) : null;
  const profitFactor =
    lastSnapshot.profit_factor != null ? Number(lastSnapshot.profit_factor) : null;

  const metrics = {
    sharpe_ratio: sharpeRatio != null ? Math.round(sharpeRatio * 1000) / 1000 : null,
    max_drawdown_pct: Math.round(maxDrawdown * 100) / 100,
    win_rate: winRate,
    error_rate: Math.round(errorRate * 10000) / 10000,
    total_return_pct: Math.round(totalReturnPct * 100) / 100,
    profit_factor: profitFactor,
    total_orders: totalOrders,
    total_cycles: totalCycles,
  };

  // Apply verdict logic
  const reasons: string[] = [];
  let verdict: 'go' | 'no_go' | 'inconclusive' = 'inconclusive';

  // Check NO_GO conditions first
  const noGoReasons: string[] = [];
  if (sharpeRatio != null && sharpeRatio < THRESHOLDS.no_go.max_sharpe) {
    noGoReasons.push(`Sharpe ${sharpeRatio.toFixed(3)} < ${THRESHOLDS.no_go.max_sharpe}`);
  }
  if (maxDrawdown > THRESHOLDS.no_go.min_drawdown_pct) {
    noGoReasons.push(`Drawdown ${maxDrawdown.toFixed(1)}% > ${THRESHOLDS.no_go.min_drawdown_pct}%`);
  }
  if (errorRate > THRESHOLDS.no_go.max_error_rate) {
    noGoReasons.push(
      `Error rate ${(errorRate * 100).toFixed(1)}% > ${THRESHOLDS.no_go.max_error_rate * 100}%`,
    );
  }

  if (noGoReasons.length > 0) {
    verdict = 'no_go';
    reasons.push(...noGoReasons);
  } else {
    // Check GO conditions
    const goChecks = {
      sharpe: sharpeRatio != null && sharpeRatio >= THRESHOLDS.go.min_sharpe,
      drawdown: maxDrawdown <= THRESHOLDS.go.max_drawdown_pct,
      winRate: winRate != null && winRate >= THRESHOLDS.go.min_win_rate,
      errorRate: errorRate <= THRESHOLDS.go.max_error_rate,
    };

    const passedAll = Object.values(goChecks).every(Boolean);

    if (passedAll) {
      verdict = 'go';
      reasons.push('All GO thresholds met');
    } else {
      verdict = 'inconclusive';
      if (!goChecks.sharpe)
        reasons.push(
          `Sharpe ${sharpeRatio?.toFixed(3) ?? 'N/A'} < ${THRESHOLDS.go.min_sharpe} (GO threshold)`,
        );
      if (!goChecks.drawdown)
        reasons.push(
          `Drawdown ${maxDrawdown.toFixed(1)}% > ${THRESHOLDS.go.max_drawdown_pct}% (GO threshold)`,
        );
      if (!goChecks.winRate)
        reasons.push(
          `Win rate ${winRate != null ? (winRate * 100).toFixed(1) : 'N/A'}% < ${THRESHOLDS.go.min_win_rate * 100}% (GO threshold)`,
        );
      if (!goChecks.errorRate)
        reasons.push(
          `Error rate ${(errorRate * 100).toFixed(1)}% > ${THRESHOLDS.go.max_error_rate * 100}% (GO threshold)`,
        );
    }
  }

  const reason = reasons.join('; ');

  logger.info('verdict.compute.done', {
    experimentId,
    verdict,
    reason,
    ...metrics,
  });

  return { verdict, reason, metrics };
}

/** Finalize an experiment: compute verdict, update DB. */
export async function finalizeExperiment(experimentId: string): Promise<VerdictResult> {
  const result = await computeVerdict(experimentId);
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('experiments')
    .update({
      verdict: result.verdict,
      verdict_reason: result.reason,
      final_metrics: result.metrics,
      status: 'completed',
      week2_end: new Date().toISOString(),
    })
    .eq('id', experimentId);

  if (error) {
    logger.error('verdict.finalize.update_failed', {
      experimentId,
      error: error.message,
    });
  } else {
    logger.info('verdict.finalize.ok', {
      experimentId,
      verdict: result.verdict,
    });
  }

  return result;
}
