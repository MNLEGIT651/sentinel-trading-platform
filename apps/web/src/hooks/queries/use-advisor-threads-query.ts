'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { AdvisorThread } from '@sentinel/shared';

interface ThreadsResponse {
  threads: AdvisorThread[];
  total: number;
}

async function fetchThreads(): Promise<ThreadsResponse> {
  const res = await fetch('/api/advisor/threads');
  if (!res.ok) throw new Error('Failed to fetch advisor threads');
  return res.json();
}

export function useAdvisorThreadsQuery() {
  return useQuery({
    queryKey: queryKeys.advisor.threads.list(),
    queryFn: fetchThreads,
  });
}
