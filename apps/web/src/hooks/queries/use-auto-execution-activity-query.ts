'use client';

import { useQuery } from '@tanstack/react-query';

export interface AutoExecutionEvent {
  id: string;
  recommendation_id: string;
  event_type: 'auto_approved' | 'auto_execution_denied';
  event_ts: string;
  actor_type: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  /** Joined from recommendation */
  ticker?: string;
}

const AUTO_EXECUTION_KEY = ['auto-execution-activity'] as const;

async function fetchAutoExecutionActivity(): Promise<AutoExecutionEvent[]> {
  const res = await fetch('/api/autonomy/activity', {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `Failed to fetch auto-execution activity (${res.status})`);
  }
  const json = await res.json();
  return json.data ?? [];
}

export function useAutoExecutionActivityQuery() {
  return useQuery<AutoExecutionEvent[]>({
    queryKey: AUTO_EXECUTION_KEY,
    queryFn: fetchAutoExecutionActivity,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}
