'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { OperatorAction } from '@sentinel/shared';

export type OperatorActionsFilters = {
  limit?: number | undefined;
  offset?: number | undefined;
  action_type?: string | undefined;
  operator_id?: string | undefined;
  target_type?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
};

export type OperatorActionsResponse = {
  data: OperatorAction[];
  total: number;
  limit: number;
  offset: number;
};

type RecordActionRequest = {
  action_type: string;
  target_type?: string | undefined;
  target_id?: string | undefined;
  reason?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
};

function buildQueryString(filters?: OperatorActionsFilters | undefined): string {
  const params = new URLSearchParams();
  if (filters?.limit != null) params.set('limit', String(filters.limit));
  if (filters?.offset != null) params.set('offset', String(filters.offset));
  if (filters?.action_type) params.set('action_type', filters.action_type);
  if (filters?.operator_id) params.set('operator_id', filters.operator_id);
  if (filters?.target_type) params.set('target_type', filters.target_type);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useOperatorActionsQuery(filters?: OperatorActionsFilters | undefined) {
  return useQuery<OperatorActionsResponse>({
    queryKey: ['operator-actions', 'list', filters] as const,
    queryFn: async () => {
      const res = await fetch(`/api/operator-actions${buildQueryString(filters)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to fetch operator actions' }));
        throw new Error(err.error ?? 'Failed to fetch operator actions');
      }
      return res.json();
    },
    staleTime: 15_000,
  });
}

export function useRecordActionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: RecordActionRequest) => {
      const res = await fetch('/api/operator-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to record action' }));
        throw new Error(err.error ?? 'Failed to record action');
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['operator-actions'] });
    },
  });
}
