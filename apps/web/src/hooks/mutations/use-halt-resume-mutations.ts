'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { agentsClient } from '@/lib/agents-client';

export function useHaltMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => agentsClient.halt(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.status() });
    },
  });
}

export function useResumeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => agentsClient.resume(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.status() });
    },
  });
}
