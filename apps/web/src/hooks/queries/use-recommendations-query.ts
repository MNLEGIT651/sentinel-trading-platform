'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import { queryKeys } from '@/lib/query-keys';
import { agentsClient, type TradeRecommendation } from '@/lib/agents-client';

async function fetchRecommendations(
  status: 'pending' | 'approved' | 'rejected' | 'filled' | 'risk_blocked' | 'all',
): Promise<TradeRecommendation[]> {
  const { recommendations } = await agentsClient.getRecommendations(status);
  return recommendations;
}

export function useRecommendationsQuery(
  status: 'pending' | 'approved' | 'rejected' | 'filled' | 'risk_blocked' | 'all' = 'pending',
  refetchInterval = 5_000,
) {
  const agentsOnline = useAppStore((s) => s.agentsOnline);

  return useQuery({
    queryKey: queryKeys.agents.recommendations(status),
    queryFn: () => fetchRecommendations(status),
    enabled: agentsOnline === true,
    refetchInterval,
    staleTime: 4_000,
  });
}
