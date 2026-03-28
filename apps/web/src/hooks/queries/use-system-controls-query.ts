'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SystemControls, SystemControlsUpdate } from '@sentinel/shared';

const SYSTEM_CONTROLS_KEY = ['system-controls'] as const;

interface SystemControlsResponse {
  data: SystemControls;
}

async function fetchSystemControls(): Promise<SystemControls> {
  const res = await fetch('/api/system-controls', {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `Failed to fetch system controls: ${res.status}`);
  }
  const json: SystemControlsResponse = await res.json();
  return json.data;
}

async function patchSystemControls(update: SystemControlsUpdate): Promise<SystemControls> {
  const res = await fetch('/api/system-controls', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? 'Failed to update system controls');
  }
  const json: SystemControlsResponse = await res.json();
  return json.data;
}

export function useSystemControlsQuery() {
  return useQuery<SystemControls>({
    queryKey: SYSTEM_CONTROLS_KEY,
    queryFn: fetchSystemControls,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useUpdateSystemControlsMutation() {
  const queryClient = useQueryClient();

  return useMutation<SystemControls, Error, SystemControlsUpdate>({
    mutationFn: patchSystemControls,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SYSTEM_CONTROLS_KEY });
    },
  });
}

export function useHaltSystemMutation() {
  const queryClient = useQueryClient();

  return useMutation<SystemControls, Error, void>({
    mutationFn: () => patchSystemControls({ trading_halted: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SYSTEM_CONTROLS_KEY });
    },
  });
}

export function useResumeSystemMutation() {
  const queryClient = useQueryClient();

  return useMutation<SystemControls, Error, void>({
    mutationFn: () => patchSystemControls({ trading_halted: false }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SYSTEM_CONTROLS_KEY });
    },
  });
}
