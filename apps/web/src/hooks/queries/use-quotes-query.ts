'use client';

import { useQuery } from '@tanstack/react-query';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';
import { useAppStore } from '@/stores/app-store';
import { queryKeys } from '@/lib/query-keys';

export interface QuoteData {
  ticker: string;
  price: number;
  change: number;
  change_pct: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  prev_close?: number;
}

async function fetchQuotes(tickers: string[]): Promise<QuoteData[]> {
  const res = await fetch(engineUrl(`/api/v1/data/quotes?tickers=${tickers.join(',')}`), {
    signal: AbortSignal.timeout(6000),
    headers: engineHeaders(),
  });
  if (!res.ok) throw new Error(`Quotes fetch failed: ${res.status}`);
  return res.json();
}

export function useQuotesQuery(tickers: string[], refetchInterval = 30_000) {
  const engineOnline = useAppStore((s) => s.engineOnline);

  return useQuery({
    queryKey: queryKeys.data.quotes(tickers),
    queryFn: () => fetchQuotes(tickers),
    enabled: engineOnline === true && tickers.length > 0,
    refetchInterval,
  });
}
