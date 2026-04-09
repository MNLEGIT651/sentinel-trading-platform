'use client';

import { queryKeys } from '@/lib/query-keys';
import { useMutationWithInvalidation } from '@/hooks/use-mutation-with-invalidation';
import type { AdvisorThread, AdvisorThreadCreate, AdvisorThreadUpdate } from '@sentinel/shared';

async function createThread(input: AdvisorThreadCreate): Promise<AdvisorThread> {
  const res = await fetch('/api/advisor/threads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to create thread');
  return res.json();
}

async function updateThread(args: {
  id: string;
  update: AdvisorThreadUpdate;
}): Promise<AdvisorThread> {
  const res = await fetch(`/api/advisor/threads/${args.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args.update),
  });
  if (!res.ok) throw new Error('Failed to update thread');
  return res.json();
}

async function deleteThread(id: string): Promise<void> {
  const res = await fetch(`/api/advisor/threads/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete thread');
}

export function useCreateThreadMutation() {
  return useMutationWithInvalidation(createThread, [queryKeys.advisor.threads.all()]);
}

export function useUpdateThreadMutation() {
  return useMutationWithInvalidation(updateThread, [queryKeys.advisor.threads.all()]);
}

export function useDeleteThreadMutation() {
  return useMutationWithInvalidation(deleteThread, [queryKeys.advisor.threads.all()]);
}
