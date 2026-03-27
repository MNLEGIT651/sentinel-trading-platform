'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TradingPolicy, TradingPolicyUpdate } from '@sentinel/shared';
import { DEFAULT_TRADING_POLICY } from '@sentinel/shared';

interface UseTradingPolicyResult {
  /** Current policy (defaults until loaded) */
  policy: TradingPolicy | null;
  /** Whether the initial fetch is in progress */
  loading: boolean;
  /** Whether a save is in progress */
  saving: boolean;
  /** Error message from last operation */
  error: string | null;
  /** Update policy fields and persist to server */
  updatePolicy: (update: TradingPolicyUpdate) => Promise<boolean>;
  /** Refresh policy from server */
  refresh: () => Promise<void>;
}

/**
 * Hook for reading and writing the user's trading policy from Supabase.
 *
 * - On mount, fetches the user's policy (auto-creates default if none).
 * - `updatePolicy()` sends a PUT to persist changes and returns success status.
 * - Optimistic update: UI updates immediately, rolls back on failure.
 */
export function useTradingPolicy(): UseTradingPolicyResult {
  const [policy, setPolicy] = useState<TradingPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchPolicy = useCallback(async () => {
    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch('/api/settings/policy', {
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as TradingPolicy;
      setPolicy(data);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load policy');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicy();
    return () => abortRef.current?.abort();
  }, [fetchPolicy]);

  const updatePolicy = useCallback(
    async (update: TradingPolicyUpdate): Promise<boolean> => {
      setSaving(true);
      setError(null);

      // Optimistic update
      const previous = policy;
      if (policy) {
        setPolicy({ ...policy, ...update });
      }

      try {
        const res = await fetch('/api/settings/policy', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as TradingPolicy;
        setPolicy(data);
        return true;
      } catch (err) {
        // Rollback on failure
        setPolicy(previous);
        setError(err instanceof Error ? err.message : 'Failed to save policy');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [policy],
  );

  return { policy, loading, saving, error, updatePolicy, refresh: fetchPolicy };
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
