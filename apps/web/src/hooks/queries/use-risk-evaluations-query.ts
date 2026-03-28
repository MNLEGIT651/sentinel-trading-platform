'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RiskEvaluation } from '@sentinel/shared';

export type RiskEvaluationsFilters = {
  recommendation_id?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

interface RiskEvaluationsResponse {
  data: RiskEvaluation[];
  total: number;
}

interface RecordRiskEvaluationInput {
  recommendation_id: string;
  policy_version?: string | undefined;
  allowed: boolean;
  original_quantity?: number | undefined;
  adjusted_quantity?: number | undefined;
  checks_performed?: unknown[] | undefined;
  reason?: string | undefined;
}

const RISK_EVALUATIONS_KEY = 'risk-evaluations';

export function useRiskEvaluationsQuery(filters?: RiskEvaluationsFilters | undefined) {
  return useQuery<RiskEvaluationsResponse>({
    queryKey: [RISK_EVALUATIONS_KEY, 'list', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.recommendation_id) params.set('recommendation_id', filters.recommendation_id);
      if (filters?.limit != null) params.set('limit', String(filters.limit));
      if (filters?.offset != null) params.set('offset', String(filters.offset));

      const qs = params.toString();
      const res = await fetch(`/api/risk-evaluations${qs ? `?${qs}` : ''}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Failed to fetch risk evaluations');
      }
      return res.json();
    },
    staleTime: 30_000,
    enabled: filters == null || filters.recommendation_id != null,
  });
}

export function useRecordRiskEvaluationMutation() {
  const queryClient = useQueryClient();

  return useMutation<RiskEvaluation, Error, RecordRiskEvaluationInput>({
    mutationFn: async (input) => {
      const res = await fetch('/api/risk-evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Failed to record risk evaluation');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RISK_EVALUATIONS_KEY] });
    },
  });
}
