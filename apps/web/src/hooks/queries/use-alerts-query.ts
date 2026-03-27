'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import { queryKeys } from '@/lib/query-keys';
import { agentsClient, type AgentAlert } from '@/lib/agents-client';

async function fetchAlerts(): Promise<AgentAlert[]> {
  const { alerts } = await agentsClient.getAlerts();
  return alerts;
}

export function useAlertsQuery(refetchInterval = 30_000) {
  const agentsOnline = useAppStore((s) => s.agentsOnline);

  return useQuery({
    queryKey: queryKeys.agents.alerts(),
    queryFn: fetchAlerts,
    enabled: agentsOnline === true,
    refetchInterval,
    staleTime: 4_000,
  });
}
