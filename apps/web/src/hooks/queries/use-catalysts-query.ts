'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

// ── Types ──────────────────────────────────────────────

export type CatalystEventType =
  | 'earnings'
  | 'dividend'
  | 'split'
  | 'ipo'
  | 'macro'
  | 'fed_meeting'
  | 'economic_data'
  | 'options_expiry'
  | 'ex_dividend'
  | 'conference'
  | 'custom';

export type CatalystImpact = 'high' | 'medium' | 'low';

export interface CatalystEvent {
  id: string;
  event_type: CatalystEventType;
  ticker: string | null;
  sector: string | null;
  event_date: string;
  event_time: string | null;
  title: string;
  description: string | null;
  impact: CatalystImpact;
  eps_estimate: number | null;
  revenue_estimate: number | null;
  eps_actual: number | null;
  revenue_actual: number | null;
  source: string;
  source_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export interface CatalystFilters {
  from?: string | undefined;
  to?: string | undefined;
  ticker?: string | undefined;
  type?: CatalystEventType | undefined;
  impact?: CatalystImpact | undefined;
}

export interface CatalystStats {
  total: number;
  byType: Record<string, number>;
  byImpact: Record<string, number>;
}

export interface CatalystResponse {
  events: CatalystEvent[];
  byDate: Record<string, CatalystEvent[]>;
  stats: CatalystStats;
}

export interface CatalystEventCreate {
  event_type: CatalystEventType;
  ticker?: string | undefined;
  sector?: string | undefined;
  event_date: string;
  event_time?: string | undefined;
  title: string;
  description?: string | undefined;
  impact?: CatalystImpact | undefined;
  eps_estimate?: number | undefined;
  revenue_estimate?: number | undefined;
  source?: string | undefined;
  source_id?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

// ── Fetch ──────────────────────────────────────────────

async function fetchCatalysts(filters: CatalystFilters): Promise<CatalystResponse> {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.ticker) params.set('ticker', filters.ticker);
  if (filters.type) params.set('type', filters.type);
  if (filters.impact) params.set('impact', filters.impact);

  const res = await fetch(`/api/catalysts?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Catalyst fetch failed: ${res.status}`);
  }
  return res.json();
}

async function createCatalyst(data: CatalystEventCreate): Promise<CatalystEvent> {
  const res = await fetch('/api/catalysts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Create catalyst failed: ${res.status}`);
  }
  return res.json();
}

// ── Hooks ──────────────────────────────────────────────

export function useCatalystsQuery(filters: CatalystFilters = {}) {
  return useQuery({
    queryKey: queryKeys.catalysts.list(filters),
    queryFn: () => fetchCatalysts(filters),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateCatalystMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCatalyst,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.catalysts.all });
    },
  });
}
