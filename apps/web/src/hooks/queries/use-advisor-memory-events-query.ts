'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { AdvisorMemoryEvent } from '@sentinel/shared';

interface MemoryEventsResponse {
  events: AdvisorMemoryEvent[];
  total: number;
}

async function fetchMemoryEvents(filters?: {
  preferenceId?: string;
}): Promise<MemoryEventsResponse> {
  const params = new URLSearchParams();
  if (filters?.preferenceId) params.set('preference_id', filters.preferenceId);
  const qs = params.toString();
  const res = await fetch(`/api/advisor/memory-events${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch memory events');
  return res.json();
}

export function useAdvisorMemoryEventsQuery(filters?: { preferenceId?: string }) {
  return useQuery({
    queryKey: queryKeys.advisor.memoryEvents.list(filters),
    queryFn: () => fetchMemoryEvents(filters),
  });
}
