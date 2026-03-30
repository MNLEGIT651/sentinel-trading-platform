'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type {
  AdvisorPreference,
  AdvisorPreferenceCreate,
  AdvisorPreferenceUpdate,
} from '@sentinel/shared';

async function createPreference(input: AdvisorPreferenceCreate): Promise<AdvisorPreference> {
  const res = await fetch('/api/advisor/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to create preference');
  return res.json();
}

async function updatePreference(args: {
  id: string;
  update: AdvisorPreferenceUpdate;
}): Promise<AdvisorPreference> {
  const res = await fetch(`/api/advisor/preferences/${args.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args.update),
  });
  if (!res.ok) throw new Error('Failed to update preference');
  return res.json();
}

async function confirmPreference(id: string): Promise<AdvisorPreference> {
  const res = await fetch(`/api/advisor/preferences/${id}/confirm`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to confirm preference');
  return res.json();
}

async function dismissPreference(id: string): Promise<AdvisorPreference> {
  const res = await fetch(`/api/advisor/preferences/${id}/dismiss`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to dismiss preference');
  return res.json();
}

async function deletePreference(id: string): Promise<void> {
  const res = await fetch(`/api/advisor/preferences/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete preference');
}

function useInvalidateAdvisor() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.advisor.preferences.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.advisor.memoryEvents.all() });
  };
}

export function useCreatePreferenceMutation() {
  const invalidate = useInvalidateAdvisor();
  return useMutation({ mutationFn: createPreference, onSuccess: invalidate });
}

export function useUpdatePreferenceMutation() {
  const invalidate = useInvalidateAdvisor();
  return useMutation({ mutationFn: updatePreference, onSuccess: invalidate });
}

export function useConfirmPreferenceMutation() {
  const invalidate = useInvalidateAdvisor();
  return useMutation({ mutationFn: confirmPreference, onSuccess: invalidate });
}

export function useDismissPreferenceMutation() {
  const invalidate = useInvalidateAdvisor();
  return useMutation({ mutationFn: dismissPreference, onSuccess: invalidate });
}

export function useDeletePreferenceMutation() {
  const invalidate = useInvalidateAdvisor();
  return useMutation({ mutationFn: deletePreference, onSuccess: invalidate });
}
