'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { RecommendationExplanation } from '@sentinel/shared';

async function fetchExplanation(recommendationId: string): Promise<RecommendationExplanation> {
  const res = await fetch(`/api/recommendations/${recommendationId}/explanation`);
  if (!res.ok) throw new Error('Failed to fetch explanation');
  return res.json();
}

export function useRecommendationExplanationQuery(recommendationId: string | null) {
  return useQuery({
    queryKey: queryKeys.explanations.byRec(recommendationId ?? ''),
    queryFn: () => fetchExplanation(recommendationId!),
    enabled: !!recommendationId,
    retry: false, // 404 is expected when no explanation exists
  });
}
