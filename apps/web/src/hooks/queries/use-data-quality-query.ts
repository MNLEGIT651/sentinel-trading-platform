'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

// ── Types ────────────────────────────────────────────────────────────────────

export type DataQualityEventType =
  | 'stale_quote'
  | 'missing_bars'
  | 'delayed_quote'
  | 'provider_fallback'
  | 'cache_miss'
  | 'cache_hit'
  | 'data_gap'
  | 'api_error'
  | 'rate_limited';

export type DataQualitySeverity = 'info' | 'warning' | 'error' | 'critical';

export interface DataQualityEvent {
  id: number;
  user_id: string;
  event_type: DataQualityEventType;
  severity: DataQualitySeverity;
  provider: string | null;
  ticker: string | null;
  message: string;
  metadata: Record<string, unknown>;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface DataQualityStats {
  total: number;
  unresolved: number;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
}

export interface DataQualityResponse {
  events: DataQualityEvent[];
  stats: DataQualityStats;
}

export interface DataQualityFilters {
  event_type?: string | undefined;
  severity?: string | undefined;
  resolved?: boolean | undefined;
  ticker?: string | undefined;
  limit?: number | undefined;
}

// ── Query ────────────────────────────────────────────────────────────────────

async function fetchDataQuality(filters: DataQualityFilters): Promise<DataQualityResponse> {
  const params = new URLSearchParams();
  if (filters.event_type) params.set('event_type', filters.event_type);
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.resolved !== undefined) params.set('resolved', String(filters.resolved));
  if (filters.ticker) params.set('ticker', filters.ticker);
  if (filters.limit) params.set('limit', String(filters.limit));

  const qs = params.toString();
  const res = await fetch(`/api/data-quality${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch data quality events');
  return res.json();
}

export function useDataQualityQuery(filters: DataQualityFilters = {}) {
  return useQuery({
    queryKey: queryKeys.dataQuality.list(filters),
    queryFn: () => fetchDataQuality(filters),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// ── Record Event ─────────────────────────────────────────────────────────────

export function useRecordDataQualityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      event_type: DataQualityEventType;
      severity?: DataQualitySeverity | undefined;
      provider?: string | undefined;
      ticker?: string | undefined;
      message: string;
      metadata?: Record<string, unknown> | undefined;
    }) => {
      const res = await fetch('/api/data-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to record event' }));
        throw new Error(err.error ?? 'Failed to record event');
      }
      return res.json() as Promise<DataQualityEvent>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dataQuality.all });
    },
  });
}

// ── Resolve Events ───────────────────────────────────────────────────────────

export function useResolveEventsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, resolved }: { ids: number[]; resolved: boolean }) => {
      const res = await fetch('/api/data-quality', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, resolved }),
      });
      if (!res.ok) throw new Error('Failed to resolve events');
      return res.json() as Promise<{ updated: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dataQuality.all });
    },
  });
}
