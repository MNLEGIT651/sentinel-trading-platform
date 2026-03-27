'use client';

import { useQuery } from '@tanstack/react-query';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';
import { useAppStore } from '@/stores/app-store';
import { queryKeys } from '@/lib/query-keys';
import type { OHLCV } from '@sentinel/shared';

async function fetchBars(ticker: string, timeframe: string, days: number): Promise<OHLCV[]> {
  const res = await fetch(
    engineUrl(`/api/v1/data/bars/${ticker}?timeframe=${timeframe}&days=${days}`),
    { signal: AbortSignal.timeout(10000), headers: engineHeaders() },
  );
  if (!res.ok) throw new Error(`Bars fetch failed: ${res.status}`);
  return res.json();
}

export function useBarsQuery(ticker: string, timeframe = '1d', days = 90) {
  const engineOnline = useAppStore((s) => s.engineOnline);

  return useQuery({
    queryKey: queryKeys.data.bars(ticker, timeframe, days),
    queryFn: () => fetchBars(ticker, timeframe, days),
    enabled: engineOnline === true && !!ticker,
    staleTime: 60_000,
  });
}
