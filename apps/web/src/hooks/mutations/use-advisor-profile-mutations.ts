'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: patchProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.advisor.profile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.advisor.memoryEvents.all() });
    },
  });
}
