'use client';

import { useQuery } from '@tanstack/react-query';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';
import { useAppStore } from '@/stores/app-store';
import { queryKeys } from '@/lib/query-keys';
import type { OHLCV } from '@sentinel/shared';

type BarsFetchError = Error & { status?: number };

async function readBarsError(response: Response): Promise<string> {
  const fallback = `Bars fetch failed: ${response.status}`;
  const contentType = response.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      const body = (await response.json()) as { message?: string; error?: string };
      return body.message ?? body.error ?? fallback;
    }

    const text = await response.text();
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}

async function fetchBars(ticker: string, timeframe: string, days: number): Promise<OHLCV[]> {
  const res = await fetch(
    engineUrl(`/api/v1/data/bars/${ticker}?timeframe=${timeframe}&days=${days}`),
    { signal: AbortSignal.timeout(10000), headers: engineHeaders() },
  );
  if (!res.ok) {
    const error = new Error(await readBarsError(res)) as BarsFetchError;
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export function useBarsQuery(ticker: string, timeframe = '1d', days = 90) {
  const engineOnline = useAppStore((s) => s.engineOnline);

  return useQuery({
    queryKey: queryKeys.data.bars(ticker, timeframe, days),
    queryFn: () => fetchBars(ticker, timeframe, days),
    enabled: engineOnline === true && !!ticker,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as BarsFetchError).status;
      if (status === 503 || status === 502 || status === 504) return failureCount < 3;
      return failureCount < 2;
    },
  });
}
