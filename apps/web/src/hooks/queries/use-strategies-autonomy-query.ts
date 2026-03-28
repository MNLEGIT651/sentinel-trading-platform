'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { engineUrl } from '@/lib/engine-fetch';
import type { AutonomyMode } from '@sentinel/shared';

export interface StrategyAutonomyEntry {
  strategy_id: string;
  strategy_name: string;
  autonomy_mode: AutonomyMode;
}

const STRATEGIES_AUTONOMY_KEY = ['strategies', 'autonomy'] as const;

async function fetchStrategiesAutonomy(): Promise<StrategyAutonomyEntry[]> {
  const res = await fetch(engineUrl('/strategies'), {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail ?? `Failed to fetch strategies (${res.status})`);
  }
  const strategies = await res.json();
  return (strategies ?? []).map(
    (s: { name: string; autonomy_mode?: string; strategy_id?: string; id?: string }) => ({
      strategy_id: s.strategy_id ?? s.id ?? s.name,
      strategy_name: s.name,
      autonomy_mode: (s.autonomy_mode as AutonomyMode) ?? 'alert_only',
    }),
  );
}

export function useStrategiesAutonomyQuery() {
  return useQuery<StrategyAutonomyEntry[]>({
    queryKey: STRATEGIES_AUTONOMY_KEY,
    queryFn: fetchStrategiesAutonomy,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

async function updateStrategyAutonomy(
  strategyId: string,
  autonomyMode: AutonomyMode,
): Promise<StrategyAutonomyEntry> {
  const res = await fetch(engineUrl(`/strategies/${strategyId}/autonomy`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ autonomy_mode: autonomyMode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail ?? `Failed to update strategy autonomy (${res.status})`);
  }
  return res.json();
}

export function useUpdateStrategyAutonomyMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    StrategyAutonomyEntry,
    Error,
    { strategyId: string; autonomyMode: AutonomyMode }
  >({
    mutationFn: ({ strategyId, autonomyMode }) => updateStrategyAutonomy(strategyId, autonomyMode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STRATEGIES_AUTONOMY_KEY });
    },
  });
}
