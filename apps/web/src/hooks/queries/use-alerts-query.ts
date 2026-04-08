'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import { queryKeys } from '@/lib/query-keys';
import { agentsClient, type AgentAlert, type AlertsCursor } from '@/lib/agents-client';

async function fetchAlerts(): Promise<AgentAlert[]> {
  const { alerts } = await agentsClient.getAlerts();
  return alerts;
}

/** Latest alerts (flat array, auto-refetch). Used by NotificationCenter. */
export function useAlertsQuery(refetchInterval = 30_000) {
  const agentsOnline = useAppStore((s) => s.agentsOnline);

  return useQuery({
    queryKey: queryKeys.agents.alerts(),
    queryFn: fetchAlerts,
    enabled: agentsOnline === true,
    refetchInterval,
  });
}

/** Paginated alerts with cursor-based infinite loading. */
export function useAlertsInfiniteQuery(limit = 50) {
  const agentsOnline = useAppStore((s) => s.agentsOnline);

  return useInfiniteQuery({
    queryKey: [...queryKeys.agents.alerts(), 'infinite'],
    queryFn: ({ pageParam }) =>
      pageParam
        ? agentsClient.getAlerts({ limit, cursor: pageParam })
        : agentsClient.getAlerts({ limit }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as AlertsCursor | undefined,
    enabled: agentsOnline === true,
  });
}
