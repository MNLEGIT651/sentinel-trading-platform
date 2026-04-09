'use client';

import { queryKeys } from '@/lib/query-keys';
import { useMutationWithInvalidation } from '@/hooks/use-mutation-with-invalidation';
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

const INVALIDATE_KEYS = [queryKeys.advisor.preferences.all(), queryKeys.advisor.memoryEvents.all()];

export function useCreatePreferenceMutation() {
  return useMutationWithInvalidation(createPreference, INVALIDATE_KEYS);
}

export function useUpdatePreferenceMutation() {
  return useMutationWithInvalidation(updatePreference, INVALIDATE_KEYS);
}

export function useConfirmPreferenceMutation() {
  return useMutationWithInvalidation(confirmPreference, INVALIDATE_KEYS);
}

export function useDismissPreferenceMutation() {
  return useMutationWithInvalidation(dismissPreference, INVALIDATE_KEYS);
}

export function useDeletePreferenceMutation() {
  return useMutationWithInvalidation(deletePreference, INVALIDATE_KEYS);
}
