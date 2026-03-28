'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Table-to-query-key mapping — operator-facing tables only.
 *
 * Realtime is used selectively for tables the operator UI needs live updates
 * for (approvals, alerts, portfolio state, execution, signals, workflows).
 *
 * Internal / high-volume tables (strategy_health_snapshots, shadow_portfolios,
 * market_regime_history, data_quality_events, catalyst_events, backtest_results,
 * cycle_history, orchestrator_locks, agent_logs) are intentionally excluded.
 * Those are fetched on demand via TanStack Query polling or explicit refetch.
 * Keeping them off Realtime reduces connection load and avoids using Realtime
 * as an orchestration backbone.
 */
const TABLE_INVALIDATION_MAP: Record<string, readonly (readonly string[])[]> = {
  // Execution & portfolio
  orders: [queryKeys.portfolio.orders.all(), queryKeys.portfolio.account()],
  fills: [queryKeys.fills.all, queryKeys.portfolio.orders.all()],
  portfolio_positions: [queryKeys.portfolio.positions(), queryKeys.portfolio.account()],

  // Signals & recommendations
  signals: [queryKeys.agents.all, queryKeys.strategies.all],
  signal_runs: [queryKeys.signalRuns.all],
  agent_recommendations: [queryKeys.agents.all, queryKeys.counterfactuals.all],
  recommendation_events: [queryKeys.recommendationEvents.all],

  // Operator notifications & controls
  alerts: [queryKeys.agents.alerts()],
  system_controls: [queryKeys.systemControls.all],
  operator_actions: [queryKeys.operatorActions.all],
  risk_evaluations: [queryKeys.riskEvaluations.all],

  // Market data
  market_data: [queryKeys.data.all],

  // Workflow status
  workflow_jobs: [['workflow-jobs']],
  workflow_step_log: [['workflow-jobs']],

  // User-facing configuration & journal
  user_trading_policy: [queryKeys.settings.policy()],
  decision_journal: [queryKeys.journal.all],
  regime_playbooks: [queryKeys.regime.all],
  user_profiles: [queryKeys.roles.all(), queryKeys.roles.me()],
};

const SUBSCRIBED_TABLES = Object.keys(TABLE_INVALIDATION_MAP);

/**
 * Bridges Supabase Realtime → TanStack Query cache invalidation.
 *
 * Mount once at the app-shell level. When any Realtime-enabled table receives
 * an INSERT, UPDATE, or DELETE, the corresponding query keys are invalidated
 * and TanStack Query silently refetches in the background.
 *
 * This replaces the need for per-component polling or manual refetch triggers.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const channelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const channels: RealtimeChannel[] = [];

    for (const table of SUBSCRIBED_TABLES) {
      const channel = supabase
        .channel(`sentinel-sync:${table}`)
        .on('postgres_changes' as never, { event: '*', schema: 'public', table }, () => {
          const keys = TABLE_INVALIDATION_MAP[table];
          if (!keys) return;
          for (const queryKey of keys) {
            queryClient.invalidateQueries({ queryKey: [...queryKey] });
          }
        })
        .subscribe();

      channels.push(channel);
    }

    channelsRef.current = channels;

    return () => {
      for (const channel of channelsRef.current) {
        supabase.removeChannel(channel);
      }
      channelsRef.current = [];
    };
  }, [queryClient]);
}
