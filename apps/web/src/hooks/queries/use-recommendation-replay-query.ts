'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type {
  RecommendationEvent,
  RiskEvaluation,
  Order,
  Fill,
  OperatorAction,
} from '@sentinel/shared';

// ── Search types ───────────────────────────────────────

export interface RecommendationSearchFilters {
  id?: string | undefined;
  ticker?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  status?: string | undefined;
  limit?: number | undefined;
}

export interface RecommendationSearchResult {
  id: string;
  ticker: string;
  side: string;
  quantity: number;
  order_type: string;
  strategy_name: string | null;
  signal_strength: number | null;
  status: string;
  reason: string | null;
  created_at: string;
  order_id: string | null;
}

export interface RecommendationSearchResponse {
  recommendations: RecommendationSearchResult[];
  total: number;
}

// ── Full reconstruction types ──────────────────────────

export interface MarketRegimeSnapshot {
  id: number;
  regime: string;
  confidence: number;
  indicators: Record<string, unknown>;
  detected_at: string;
  source: string;
  notes: string | null;
}

export interface JournalEntryRecord {
  id: string;
  event_type: string;
  ticker: string | null;
  direction: string | null;
  quantity: number | null;
  price: number | null;
  agent_name: string | null;
  reasoning: string | null;
  confidence: number | null;
  strategy_name: string | null;
  market_regime: string | null;
  vix_at_time: number | null;
  sector: string | null;
  recommendation_id: string | null;
  order_id: string | null;
  signal_id: string | null;
  user_notes: string | null;
  user_grade: string | null;
  outcome_pnl: number | null;
  outcome_return_pct: number | null;
  outcome_hold_minutes: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  graded_at: string | null;
}

export interface RecommendationOutcome {
  status: string;
  pnl: number | null;
  return_pct: number | null;
  hold_minutes: number | null;
  grade: string | null;
  graded_at: string | null;
  total_slippage?: number;
  fill_count?: number;
  avg_fill_price?: number | null;
}

export interface RecommendationReplayData {
  recommendation: RecommendationSearchResult & {
    metadata: Record<string, unknown> | null;
    limit_price: number | null;
  };
  events: RecommendationEvent[];
  riskEvaluations: RiskEvaluation[];
  order: Order | null;
  fills: Fill[];
  operatorActions: OperatorAction[];
  journalEntries: JournalEntryRecord[];
  marketRegime: MarketRegimeSnapshot | null;
  outcome: RecommendationOutcome;
}

// ── Search fetch ───────────────────────────────────────

async function searchRecommendations(
  filters: RecommendationSearchFilters,
): Promise<RecommendationSearchResponse> {
  const params = new URLSearchParams();
  if (filters.id) params.set('id', filters.id);
  if (filters.ticker) params.set('ticker', filters.ticker);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.status) params.set('status', filters.status);
  if (filters.limit) params.set('limit', filters.limit.toString());

  const res = await fetch(`/api/replay/recommendation?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Search failed: ${res.status}`);
  }
  return res.json();
}

// ── Reconstruction fetch ───────────────────────────────

async function fetchRecommendationReplay(id: string): Promise<RecommendationReplayData> {
  const res = await fetch(`/api/replay/recommendation/${id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Reconstruction failed: ${res.status}`);
  }
  return res.json();
}

// ── Hooks ──────────────────────────────────────────────

export function useRecommendationSearchQuery(filters: RecommendationSearchFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.replay.search(filters),
    queryFn: () => searchRecommendations(filters),
    enabled: enabled && !!(filters.id || filters.ticker || filters.from),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useRecommendationReplayQuery(id: string | null) {
  return useQuery({
    queryKey: queryKeys.replay.reconstruction(id || ''),
    queryFn: () => fetchRecommendationReplay(id!),
    enabled: !!id,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });
}
