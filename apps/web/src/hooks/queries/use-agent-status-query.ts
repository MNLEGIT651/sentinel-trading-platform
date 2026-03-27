'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import { queryKeys } from '@/lib/query-keys';
import { agentsClient, type OrchestratorStatus } from '@/lib/agents-client';

async function fetchStatus(): Promise<OrchestratorStatus> {
  return agentsClient.getStatus();
}

export function useAgentStatusQuery() {
  const agentsOnline = useAppStore((s) => s.agentsOnline);

  return useQuery({
    queryKey: queryKeys.agents.status(),
    queryFn: fetchStatus,
    enabled: agentsOnline === true,
    refetchInterval: 5_000,
    staleTime: 4_000,
  });
}
