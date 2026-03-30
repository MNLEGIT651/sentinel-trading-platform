'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { AdvisorPreference } from '@sentinel/shared';

interface PreferencesResponse {
  preferences: AdvisorPreference[];
  total: number;
}

async function fetchPreferences(filters?: {
  status?: string;
  category?: string;
}): Promise<PreferencesResponse> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.category) params.set('category', filters.category);
  const qs = params.toString();
  const res = await fetch(`/api/advisor/preferences${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch preferences');
  return res.json();
}

export function useAdvisorPreferencesQuery(filters?: { status?: string; category?: string }) {
  return useQuery({
    queryKey: queryKeys.advisor.preferences.list(filters),
    queryFn: () => fetchPreferences(filters),
  });
}
