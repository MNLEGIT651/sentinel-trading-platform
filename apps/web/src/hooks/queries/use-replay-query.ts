'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

// ── Types ──────────────────────────────────────────────

export type TimelineEventSeverity = 'info' | 'warning' | 'error' | 'success';
export type TimelineEventType = 'recommendation' | 'journal' | 'alert' | 'order' | 'data_quality';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  title: string;
  detail: string;
  severity: TimelineEventSeverity;
  metadata: Record<string, unknown>;
}

export interface ReplaySummary {
  timestamp: string;
  window: {
    start: string;
    end: string;
    minutes: number;
  };
  counts: {
    recommendations: number;
    journal_entries: number;
    active_alerts: number;
    orders: number;
    data_quality_events: number;
  };
  strategy_health: Array<Record<string, unknown>>;
  trading_policy: Record<string, unknown> | null;
}

export interface ReplayResponse {
  summary: ReplaySummary;
  timeline: TimelineEvent[];
}

// ── Fetch ──────────────────────────────────────────────

async function fetchReplay(timestamp: string, windowMinutes: number): Promise<ReplayResponse> {
  const params = new URLSearchParams({
    timestamp,
    window: windowMinutes.toString(),
  });
  const res = await fetch(`/api/replay?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Replay fetch failed: ${res.status}`);
  }
  return res.json();
}

// ── Hook ───────────────────────────────────────────────

export function useReplayQuery(timestamp: string | null, windowMinutes = 60) {
  return useQuery({
    queryKey: queryKeys.replay.snapshot(timestamp || '', windowMinutes),
    queryFn: () => fetchReplay(timestamp!, windowMinutes),
    enabled: !!timestamp,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}
