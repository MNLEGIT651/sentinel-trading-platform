'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { engineUrl } from '@/lib/engine-fetch';
import type { UniverseRestriction, RestrictionType } from '@sentinel/shared';

const UNIVERSE_RESTRICTIONS_KEY = ['universe-restrictions'] as const;

async function fetchUniverseRestrictions(): Promise<UniverseRestriction[]> {
  const res = await fetch(engineUrl('/risk/universe-restrictions'), {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail ?? `Failed to fetch universe restrictions (${res.status})`);
  }
  return res.json();
}

export function useUniverseRestrictionsQuery() {
  return useQuery<UniverseRestriction[]>({
    queryKey: UNIVERSE_RESTRICTIONS_KEY,
    queryFn: fetchUniverseRestrictions,
    staleTime: 15_000,
  });
}

export interface CreateRestrictionInput {
  restriction_type: RestrictionType;
  symbols: string[];
  sectors: string[];
  asset_classes: string[];
  reason: string | null;
}

async function createRestriction(input: CreateRestrictionInput): Promise<UniverseRestriction> {
  const res = await fetch(engineUrl('/risk/universe-restrictions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail ?? `Failed to create restriction (${res.status})`);
  }
  return res.json();
}

async function deleteRestriction(id: string): Promise<void> {
  const res = await fetch(engineUrl(`/risk/universe-restrictions/${id}`), {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail ?? `Failed to delete restriction (${res.status})`);
  }
}

export function useCreateRestrictionMutation() {
  const queryClient = useQueryClient();

  return useMutation<UniverseRestriction, Error, CreateRestrictionInput>({
    mutationFn: createRestriction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: UNIVERSE_RESTRICTIONS_KEY });
    },
  });
}

export function useDeleteRestrictionMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteRestriction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: UNIVERSE_RESTRICTIONS_KEY });
    },
  });
}
