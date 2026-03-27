'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export interface PolicyImpact {
  metric: string;
  current: number;
  projected: number;
  limit: number;
  unit: string;
}

export interface RiskPreview {
  recommendation: {
    id: string;
    ticker: string;
    side: string;
    quantity: number;
    order_type: string;
    limit_price?: number | null;
    strategy_name?: string;
    signal_strength?: number | null;
    reason?: string;
  };
  impacts: PolicyImpact[];
  limits: {
    max_position_pct: number;
    max_sector_pct: number;
    max_open_positions: number;
    daily_loss_limit_pct: number;
    soft_drawdown_pct: number;
    hard_drawdown_pct: number;
  };
  portfolio: {
    equity: number;
    cash: number | null;
    positions_count: number;
    engine_connected: boolean;
  };
}

async function fetchRiskPreview(id: string): Promise<RiskPreview> {
  const res = await fetch(`/api/recommendations/${id}/risk-preview`);
  if (!res.ok) {
    throw new Error(`Risk preview failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch risk impact preview for a specific recommendation.
 * Only enabled when an ID is provided (dialog is open).
 */
export function useRiskPreviewQuery(recommendationId: string | null) {
  return useQuery({
    queryKey: queryKeys.agents.riskPreview(recommendationId ?? ''),
    queryFn: () => fetchRiskPreview(recommendationId!),
    enabled: !!recommendationId,
    staleTime: 10_000,
    gcTime: 30_000,
  });
}
