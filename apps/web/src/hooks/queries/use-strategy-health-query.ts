'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { StrategyHealthSnapshot } from '@sentinel/shared';

interface StrategyHealthListResponse {
  snapshots: StrategyHealthSnapshot[];
}

interface StrategyHealthDetailResponse {
  strategy_name: string;
  latest: StrategyHealthSnapshot;
  history: StrategyHealthSnapshot[];
}

async function fetchStrategyHealth(): Promise<StrategyHealthSnapshot[]> {
  const res = await fetch('/api/strategy-health');
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`Failed to fetch strategy health: ${res.status}`);
  }
  const json: StrategyHealthListResponse = await res.json();
  return json.snapshots;
}

async function fetchStrategyHealthDetail(
  name: string,
): Promise<StrategyHealthDetailResponse | null> {
  const res = await fetch(`/api/strategy-health/${encodeURIComponent(name)}`);
  if (!res.ok) {
    if (res.status === 404 || res.status === 401) return null;
    throw new Error(`Failed to fetch strategy health detail: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch latest health snapshots for all strategies.
 */
export function useStrategyHealthQuery() {
  return useQuery({
    queryKey: queryKeys.strategies.health.all(),
    queryFn: fetchStrategyHealth,
    staleTime: 60_000,
  });
}

/**
 * Fetch health detail (latest + history) for a single strategy.
 */
export function useStrategyHealthDetailQuery(name: string | null) {
  return useQuery({
    queryKey: queryKeys.strategies.health.byName(name ?? ''),
    queryFn: () => fetchStrategyHealthDetail(name!),
    enabled: !!name,
    staleTime: 60_000,
  });
}
