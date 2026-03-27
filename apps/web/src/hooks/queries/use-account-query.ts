'use client';

import { useQuery } from '@tanstack/react-query';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';
import { useAppStore } from '@/stores/app-store';
import { queryKeys } from '@/lib/query-keys';

export interface BrokerAccount {
  equity: number;
  cash: number;
  buying_power: number;
  portfolio_value: number;
  daily_pnl: number;
  daily_pnl_pct: number;
}

async function fetchAccount(): Promise<BrokerAccount> {
  const res = await fetch(engineUrl('/api/v1/portfolio/account'), {
    signal: AbortSignal.timeout(6000),
    headers: engineHeaders(),
  });
  if (!res.ok) throw new Error(`Account fetch failed: ${res.status}`);
  return res.json();
}

export function useAccountQuery() {
  const engineOnline = useAppStore((s) => s.engineOnline);

  return useQuery({
    queryKey: queryKeys.portfolio.account(),
    queryFn: fetchAccount,
    enabled: engineOnline === true,
    refetchInterval: 30_000,
  });
}
