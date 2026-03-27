'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { agentsClient } from '@/lib/agents-client';

export function useRejectRecommendationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => agentsClient.rejectRecommendation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.recommendations() });
    },
  });
}
