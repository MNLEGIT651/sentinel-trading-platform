'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { AdvisorProfile } from '@sentinel/shared';

async function fetchProfile(): Promise<AdvisorProfile> {
  const res = await fetch('/api/advisor/profile');
  if (!res.ok) throw new Error('Failed to fetch advisor profile');
  return res.json();
}

export function useAdvisorProfileQuery() {
  return useQuery({
    queryKey: queryKeys.advisor.profile(),
    queryFn: fetchProfile,
  });
}
