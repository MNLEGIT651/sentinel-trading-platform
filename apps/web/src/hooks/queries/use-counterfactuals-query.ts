'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export interface CounterfactualRecommendation {
  id: string;
  created_at: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  order_type: string;
  limit_price: number | null;
  reason: string | null;
  strategy_name: string | null;
  signal_strength: number | null;
  status: string;
  reviewed_at: string | null;
  metadata: Record<string, unknown>;
}

export interface CounterfactualResult {
  id: string;
  recommendation: CounterfactualRecommendation;
  entry_price: number | null;
  current_price: number | null;
  hypothetical_pnl: number | null;
  hypothetical_return_pct: number | null;
  days_since_rejection: number;
  price_available: boolean;
}

export interface CounterfactualStats {
  total_rejected: number;
  total_risk_blocked: number;
  would_be_winners: number;
  would_be_losers: number;
  total_missed_pnl: number;
  avg_hypothetical_return_pct: number;
  win_rate_pct: number;
}

export interface CounterfactualsResponse {
  counterfactuals: CounterfactualResult[];
  stats: CounterfactualStats;
  total: number;
  limit: number;
  offset: number;
}

async function fetchCounterfactuals(
  limit: number,
  offset: number,
): Promise<CounterfactualsResponse> {
  const res = await fetch(`/api/counterfactuals?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error('Failed to fetch counterfactuals');
  return res.json();
}

export function useCounterfactualsQuery(limit = 50, offset = 0) {
  return useQuery({
    queryKey: queryKeys.counterfactuals.list(limit, offset),
    queryFn: () => fetchCounterfactuals(limit, offset),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}
