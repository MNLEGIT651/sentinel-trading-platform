'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Fill } from '@sentinel/shared';

export type FillsFilters = {
  order_id?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  from?: string | undefined;
  to?: string | undefined;
};

interface FillsResponse {
  data: Fill[];
  total: number;
}

interface RecordFillInput {
  order_id: string;
  fill_price: number;
  fill_qty: number;
  commission?: number | undefined;
  slippage?: number | undefined;
  venue?: string | undefined;
  broker_fill_id?: string | undefined;
}

const FILLS_KEY = 'fills';

export function useFillsQuery(filters?: FillsFilters | undefined) {
  return useQuery<FillsResponse>({
    queryKey: [FILLS_KEY, 'list', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.order_id) params.set('order_id', filters.order_id);
      if (filters?.limit != null) params.set('limit', String(filters.limit));
      if (filters?.offset != null) params.set('offset', String(filters.offset));
      if (filters?.from) params.set('from', filters.from);
      if (filters?.to) params.set('to', filters.to);

      const qs = params.toString();
      const res = await fetch(`/api/fills${qs ? `?${qs}` : ''}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Failed to fetch fills');
      }
      return res.json();
    },
    staleTime: 15_000,
  });
}

export function useRecordFillMutation() {
  const queryClient = useQueryClient();

  return useMutation<Fill, Error, RecordFillInput>({
    mutationFn: async (input) => {
      const res = await fetch('/api/fills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Failed to record fill');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FILLS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}
