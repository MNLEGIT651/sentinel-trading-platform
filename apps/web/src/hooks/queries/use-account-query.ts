'use client';

import { useQuery } from '@tanstack/react-query';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';
import { useAppStore } from '@/stores/app-store';
import { queryKeys } from '@/lib/query-keys';
import type { BrokerAccount } from '@/lib/engine-client';

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

export type { BrokerAccount } from '@/lib/engine-client';
