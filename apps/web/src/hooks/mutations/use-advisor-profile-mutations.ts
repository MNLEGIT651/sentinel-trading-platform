'use client';

import { queryKeys } from '@/lib/query-keys';
import { useMutationWithInvalidation } from '@/hooks/use-mutation-with-invalidation';
import type { AdvisorProfilePatch, AdvisorProfile } from '@sentinel/shared';

async function patchProfile(patch: AdvisorProfilePatch): Promise<AdvisorProfile> {
  const res = await fetch('/api/advisor/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update profile');
  return res.json();
}

export function useAdvisorProfileMutation() {
  return useMutationWithInvalidation(patchProfile, [
    queryKeys.advisor.profile(),
    queryKeys.advisor.memoryEvents.all(),
  ]);
}
