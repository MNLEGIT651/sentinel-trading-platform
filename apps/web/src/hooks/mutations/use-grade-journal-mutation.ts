'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { JournalEntry, JournalEntryUpdate } from '@sentinel/shared';

interface GradeJournalInput {
  id: string;
  update: JournalEntryUpdate;
}

export function useGradeJournalMutation() {
  const queryClient = useQueryClient();

  return useMutation<JournalEntry, Error, GradeJournalInput>({
    mutationFn: async ({ id, update }) => {
      const res = await fetch(`/api/journal/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Failed to update journal entry');
      }
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.entry(id) });
    },
  });
}
