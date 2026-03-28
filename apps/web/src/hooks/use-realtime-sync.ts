'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Table-to-query-key mapping.
 *
 * When a Postgres change fires on a Realtime-enabled table, every query key
 * listed here is invalidated so TanStack Query triggers a background refetch.
 */
const TABLE_INVALIDATION_MAP: Record<string, readonly (readonly string[])[]> = {
  orders: [queryKeys.portfolio.orders.all(), queryKeys.portfolio.account()],
  portfolio_positions: [queryKeys.portfolio.positions(), queryKeys.portfolio.account()],
  alerts: [queryKeys.agents.alerts()],
  signals: [queryKeys.agents.all, queryKeys.strategies.all],
  market_data: [queryKeys.data.all],
  user_trading_policy: [queryKeys.settings.policy()],
  decision_journal: [queryKeys.journal.all],
  strategy_health_snapshots: [queryKeys.strategies.health.all(), queryKeys.strategies.all],
  agent_recommendations: [queryKeys.agents.all, queryKeys.counterfactuals.all],
  shadow_portfolios: [queryKeys.shadowPortfolios.all],
  market_regime_history: [queryKeys.regime.all],
  regime_playbooks: [queryKeys.regime.all],
  data_quality_events: [queryKeys.dataQuality.all],
  catalyst_events: [queryKeys.catalysts.all],
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
