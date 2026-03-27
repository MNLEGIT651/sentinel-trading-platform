'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { JournalEntry, JournalEntryCreate } from '@sentinel/shared';

export function useCreateJournalEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation<JournalEntry, Error, Partial<JournalEntryCreate>>({
    mutationFn: async (entry) => {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Failed to create journal entry');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.all });
    },
  });
}
