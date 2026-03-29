import { getSupabaseClient } from '../supabase-client.js';
import { logger } from '../logger.js';

export interface ActiveExperiment {
  id: string;
  name: string;
  status: string;
  halted: boolean;
  max_daily_trades: number;
  max_position_value: number;
  signal_strength_threshold: number;
  max_total_exposure: number;
  initial_capital: number;
  config: Record<string, unknown>;
}

const ACTIVE_STATUSES = ['pending', 'week1_shadow', 'week2_execution'] as const;

/** Fetch the currently active experiment, if any. Returns null if none active or halted. */
export async function getActiveExperiment(): Promise<ActiveExperiment | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('experiments')
    .select(
      'id, name, status, halted, max_daily_trades, max_position_value, signal_strength_threshold, max_total_exposure, initial_capital, config',
    )
    .in('status', ACTIVE_STATUSES as unknown as string[])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error('experiment.fetch_active.failed', { error: error.message });
    return null;
  }

  if (!data) {
    logger.debug('experiment.fetch_active.none');
    return null;
  }

  if (data.halted) {
    logger.info('experiment.fetch_active.halted', {
      experimentId: data.id,
      name: data.name,
    });
    return null;
  }

  return data as ActiveExperiment;
}

/** Check if a given experiment is in shadow mode. */
export function isShadowPhase(experiment: ActiveExperiment): boolean {
  return experiment.status === 'week1_shadow';
}

/** Check if a given experiment is in execution mode. */
export function isExecutionPhase(experiment: ActiveExperiment): boolean {
  return experiment.status === 'week2_execution';
}

export { ShadowTracker } from './shadow-tracker.js';
export { BoundedExecutor } from './bounded-executor.js';
export { SnapshotJob } from './snapshot-job.js';
export { computeVerdict, finalizeExperiment } from './verdict.js';
export type { VerdictResult } from './verdict.js';
