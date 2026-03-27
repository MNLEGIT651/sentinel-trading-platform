'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { JournalStats } from '@sentinel/shared';

export function useJournalStatsQuery() {
  return useQuery<JournalStats>({
    queryKey: queryKeys.journal.stats(),
    queryFn: async () => {
      const res = await fetch('/api/journal/stats');
      if (!res.ok) throw new Error('Failed to fetch journal stats');
      return res.json();
    },
    staleTime: 60_000,
  });
}
