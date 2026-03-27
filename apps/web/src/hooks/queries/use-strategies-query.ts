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

interface StrategyListResponse {
  strategies: StrategyInfo[];
  families: string[];
  total: number;
}

async function fetchStrategies(): Promise<StrategyInfo[]> {
  const res = await fetch(engineUrl('/api/v1/strategies/'), {
    signal: AbortSignal.timeout(6000),
    headers: engineHeaders(),
  });
  if (!res.ok) throw new Error(`Strategies fetch failed: ${res.status}`);
  const data: StrategyListResponse = await res.json();
  return data.strategies;
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
