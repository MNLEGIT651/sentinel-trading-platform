'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  RecommendationEvent,
  RiskEvaluation,
  Order,
  Fill,
  OperatorAction,
} from '@sentinel/shared';

interface RecommendationRecord {
  id: string;
  ticker: string;
  side: string;
  order_type: string;
  quantity: number;
  limit_price: number | null;
  reason: string | null;
  strategy_name: string | null;
  signal_strength: number | null;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  order_id: string | null;
}

export type RecommendationDetail = {
  recommendation: RecommendationRecord;
  events: RecommendationEvent[];
  riskEvaluations: RiskEvaluation[];
  order: Order | null;
  fills: Fill[];
  operatorActions: OperatorAction[];
};

async function fetchRecommendationEvents(id: string): Promise<RecommendationDetail> {
  const response = await fetch(`/api/recommendations/${id}/events`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to fetch recommendation events (${response.status})`);
  }
  return response.json();
}

export function useRecommendationEventsQuery(id: string) {
  return useQuery<RecommendationDetail>({
    queryKey: ['recommendations', 'events', id],
    queryFn: () => fetchRecommendationEvents(id),
    staleTime: 15_000,
    enabled: !!id,
  });
}

export function useAddRecommendationEventMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      event_type,
      actor_type,
      actor_id,
      payload,
    }: {
      id: string;
      event_type: string;
      actor_type?: string | undefined;
      actor_id?: string | undefined;
      payload?: Record<string, unknown> | undefined;
    }) => {
      const response = await fetch(`/api/recommendations/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type, actor_type, actor_id, payload }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to add event (${response.status})`);
      }
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['recommendations', 'events', variables.id],
      });
    },
  });
}
