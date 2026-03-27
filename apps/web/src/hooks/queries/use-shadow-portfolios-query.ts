'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export interface ShadowPortfolio {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  max_position_pct: number | null;
  max_sector_pct: number | null;
  daily_loss_limit_pct: number | null;
  soft_drawdown_pct: number | null;
  hard_drawdown_pct: number | null;
  max_open_positions: number | null;
  enabled_strategies: string[];
  disabled_strategies: string[];
  initial_capital: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShadowPortfolioSnapshot {
  id: number;
  shadow_portfolio_id: string;
  snapshot_at: string;
  equity: number;
  cash: number;
  positions_value: number;
  total_pnl: number;
  total_return_pct: number;
  positions_count: number;
  max_drawdown_pct: number;
  signals_generated: number;
  signals_approved: number;
  signals_blocked: number;
  created_at: string;
}

export interface ShadowPortfolioCreate {
  name: string;
  description?: string | undefined;
  max_position_pct?: number | undefined;
  max_sector_pct?: number | undefined;
  daily_loss_limit_pct?: number | undefined;
  soft_drawdown_pct?: number | undefined;
  hard_drawdown_pct?: number | undefined;
  max_open_positions?: number | undefined;
  enabled_strategies?: string[] | undefined;
  disabled_strategies?: string[] | undefined;
  initial_capital?: number | undefined;
}

// ── List all shadow portfolios ──────────────────────────────────────────────

async function fetchShadowPortfolios(): Promise<ShadowPortfolio[]> {
  const res = await fetch('/api/shadow-portfolios');
  if (!res.ok) throw new Error('Failed to fetch shadow portfolios');
  const data = await res.json();
  return data.shadow_portfolios ?? [];
}

export function useShadowPortfoliosQuery() {
  return useQuery({
    queryKey: queryKeys.shadowPortfolios.list(),
    queryFn: fetchShadowPortfolios,
    staleTime: 60_000,
  });
}

// ── Get shadow portfolio detail ─────────────────────────────────────────────

async function fetchShadowPortfolioDetail(
  id: string,
): Promise<{ portfolio: ShadowPortfolio; snapshots: ShadowPortfolioSnapshot[] }> {
  const res = await fetch(`/api/shadow-portfolios/${id}`);
  if (!res.ok) throw new Error('Failed to fetch shadow portfolio detail');
  return res.json();
}

export function useShadowPortfolioDetailQuery(id: string | null) {
  return useQuery({
    queryKey: queryKeys.shadowPortfolios.detail(id ?? ''),
    queryFn: () => fetchShadowPortfolioDetail(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// ── Create shadow portfolio ─────────────────────────────────────────────────

export function useCreateShadowPortfolioMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: ShadowPortfolioCreate) => {
      const res = await fetch('/api/shadow-portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create' }));
        throw new Error(err.error ?? 'Failed to create shadow portfolio');
      }
      return res.json() as Promise<ShadowPortfolio>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shadowPortfolios.all });
    },
  });
}

// ── Delete shadow portfolio ─────────────────────────────────────────────────

export function useDeleteShadowPortfolioMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/shadow-portfolios/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete shadow portfolio');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shadowPortfolios.all });
    },
  });
}
