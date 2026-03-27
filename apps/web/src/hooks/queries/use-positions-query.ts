'use client';

import { useQuery } from '@tanstack/react-query';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';
import { useAppStore } from '@/stores/app-store';
import { queryKeys } from '@/lib/query-keys';
import type { BrokerPosition } from '@/lib/engine-client';

async function fetchPositions(): Promise<BrokerPosition[]> {
  const res = await fetch(engineUrl('/api/v1/portfolio/positions'), {
    signal: AbortSignal.timeout(6000),
    headers: engineHeaders(),
  });
  if (!res.ok) throw new Error(`Positions fetch failed: ${res.status}`);
  return res.json();
}

export function usePositionsQuery() {
  const engineOnline = useAppStore((s) => s.engineOnline);

  return useQuery({
    queryKey: queryKeys.portfolio.positions(),
    queryFn: fetchPositions,
    enabled: engineOnline === true,
    refetchInterval: 30_000,
  });
}

export type { BrokerPosition } from '@/lib/engine-client';
