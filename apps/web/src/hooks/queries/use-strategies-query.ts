'use client';

import { useQuery } from '@tanstack/react-query';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';
import { useAppStore } from '@/stores/app-store';
import { queryKeys } from '@/lib/query-keys';

export interface StrategyInfo {
  name: string;
  family: string;
  description?: string;
  default_params?: Record<string, unknown>;
}

export interface StrategyFamily {
  family: string;
  strategies: StrategyInfo[];
}

async function fetchStrategies(): Promise<StrategyFamily[]> {
  const res = await fetch(engineUrl('/api/v1/strategies/'), {
    signal: AbortSignal.timeout(6000),
    headers: engineHeaders(),
  });
  if (!res.ok) throw new Error(`Strategies fetch failed: ${res.status}`);
  return res.json();
}

export function useStrategiesQuery() {
  const engineOnline = useAppStore((s) => s.engineOnline);

  return useQuery({
    queryKey: queryKeys.strategies.list(),
    queryFn: fetchStrategies,
    enabled: engineOnline === true,
    staleTime: 60_000,
  });
}
