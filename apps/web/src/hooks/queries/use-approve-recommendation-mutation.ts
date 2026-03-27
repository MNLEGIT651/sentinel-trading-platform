'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { agentsClient } from '@/lib/agents-client';

export function useApproveRecommendationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => agentsClient.approveRecommendation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.recommendations() });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.orders.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.account() });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.positions() });
    },
  });
}
