'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { JournalEntry } from '@sentinel/shared';

export interface JournalFilters {
  event_type?: string;
  ticker?: string;
  grade?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

interface JournalResponse {
  entries: JournalEntry[];
  total: number;
  limit: number;
  offset: number;
}

export function useJournalQuery(filters?: JournalFilters) {
  return useQuery<JournalResponse>({
    queryKey: queryKeys.journal.entries(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.event_type) params.set('event_type', filters.event_type);
      if (filters?.ticker) params.set('ticker', filters.ticker);
      if (filters?.grade) params.set('grade', filters.grade);
      if (filters?.from) params.set('from', filters.from);
      if (filters?.to) params.set('to', filters.to);
      if (filters?.limit) params.set('limit', String(filters.limit));
      if (filters?.offset) params.set('offset', String(filters.offset));

      const qs = params.toString();
      const res = await fetch(`/api/journal${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch journal');
      return res.json();
    },
    staleTime: 30_000,
  });
}
