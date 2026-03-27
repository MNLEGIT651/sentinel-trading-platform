'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TradingPolicy, TradingPolicyUpdate } from '@sentinel/shared';
import { DEFAULT_TRADING_POLICY } from '@sentinel/shared';
import { queryKeys } from '@/lib/query-keys';

async function fetchPolicy(): Promise<TradingPolicy> {
  const res = await fetch('/api/settings/policy', { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function putPolicy(update: TradingPolicyUpdate): Promise<TradingPolicy> {
  const res = await fetch('/api/settings/policy', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * TanStack Query hook for user trading policy.
 *
 * Fetches the policy on mount (auto-creates default if none exists).
 * `updatePolicy()` performs an optimistic update with rollback on failure.
 */
export function useTradingPolicy() {
  const queryClient = useQueryClient();

  const {
    data: policy = null,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.settings.policy(),
    queryFn: fetchPolicy,
    staleTime: 60_000,
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: putPolicy,
    onMutate: async (update) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings.policy() });
      const previous = queryClient.getQueryData<TradingPolicy>(queryKeys.settings.policy());
      if (previous) {
        queryClient.setQueryData<TradingPolicy>(queryKeys.settings.policy(), {
          ...previous,
          ...update,
        });
      }
      return { previous };
    },
    onError: (_err, _update, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.settings.policy(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.policy() });
    },
  });

  const updatePolicy = async (update: TradingPolicyUpdate): Promise<boolean> => {
    try {
      await mutation.mutateAsync(update);
      return true;
    } catch {
      return false;
    }
  };

  return {
    policy,
    loading,
    saving: mutation.isPending,
    error: queryError?.message ?? mutation.error?.message ?? null,
    updatePolicy,
  };
}

/**
 * Get a policy value or fall back to default.
 * Useful in components that need a value before the policy loads.
 */
export function policyValue<K extends keyof typeof DEFAULT_TRADING_POLICY>(
  policy: TradingPolicy | null,
  key: K,
): (typeof DEFAULT_TRADING_POLICY)[K] {
  if (policy && key in policy) {
    return policy[key as keyof TradingPolicy] as (typeof DEFAULT_TRADING_POLICY)[K];
  }
  return DEFAULT_TRADING_POLICY[key];
}
