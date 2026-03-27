'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { agentsClient } from '@/lib/agents-client';

export function useTriggerCycleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => agentsClient.runCycle(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.status() });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.recommendations() });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.alerts() });
    },
  });
}
