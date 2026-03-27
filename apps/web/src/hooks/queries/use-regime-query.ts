'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

// ── Types ────────────────────────────────────────────────────────────────────

export type MarketRegime = 'bull' | 'bear' | 'sideways' | 'volatile' | 'crisis';
export type RegimeSource = 'manual' | 'agent' | 'algorithm';

export interface RegimeEntry {
  id: number;
  user_id: string;
  regime: MarketRegime;
  confidence: number;
  indicators: Record<string, unknown>;
  detected_at: string;
  expires_at: string | null;
  source: RegimeSource;
  notes: string | null;
  created_at: string;
}

export interface RegimePlaybook {
  id: string;
  user_id: string;
  name: string;
  regime: MarketRegime;
  description: string | null;
  is_active: boolean;
  enabled_strategies: string[];
  disabled_strategies: string[];
  strategy_weights: Record<string, number>;
  max_position_pct: number | null;
  max_sector_pct: number | null;
  daily_loss_limit_pct: number | null;
  position_size_modifier: number;
  auto_approve: boolean;
  require_confirmation: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegimeState {
  current: RegimeEntry | null;
  active_playbook: RegimePlaybook | null;
  history: RegimeEntry[];
}

export interface RegimePlaybookCreate {
  name: string;
  regime: MarketRegime;
  description?: string | undefined;
  enabled_strategies?: string[] | undefined;
  disabled_strategies?: string[] | undefined;
  strategy_weights?: Record<string, number> | undefined;
  max_position_pct?: number | undefined;
  max_sector_pct?: number | undefined;
  daily_loss_limit_pct?: number | undefined;
  position_size_modifier?: number | undefined;
  auto_approve?: boolean | undefined;
  require_confirmation?: boolean | undefined;
}

export interface RecordRegimeInput {
  regime: MarketRegime;
  confidence?: number | undefined;
  indicators?: Record<string, unknown> | undefined;
  source?: RegimeSource | undefined;
  notes?: string | undefined;
}

// ── Regime State ─────────────────────────────────────────────────────────────

async function fetchRegimeState(): Promise<RegimeState> {
  const res = await fetch('/api/regime');
  if (!res.ok) throw new Error('Failed to fetch regime state');
  return res.json();
}

export function useRegimeStateQuery() {
  return useQuery({
    queryKey: queryKeys.regime.state(),
    queryFn: fetchRegimeState,
    staleTime: 30_000,
  });
}

// ── Record Regime ────────────────────────────────────────────────────────────

export function useRecordRegimeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordRegimeInput) => {
      const res = await fetch('/api/regime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to record regime' }));
        throw new Error(err.error ?? 'Failed to record regime');
      }
      return res.json() as Promise<RegimeEntry>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.regime.all });
    },
  });
}

// ── Playbooks ────────────────────────────────────────────────────────────────

async function fetchPlaybooks(): Promise<RegimePlaybook[]> {
  const res = await fetch('/api/regime/playbooks');
  if (!res.ok) throw new Error('Failed to fetch playbooks');
  const data = await res.json();
  return data.playbooks ?? [];
}

export function usePlaybooksQuery() {
  return useQuery({
    queryKey: queryKeys.regime.playbooks(),
    queryFn: fetchPlaybooks,
    staleTime: 60_000,
  });
}

// ── Create Playbook ──────────────────────────────────────────────────────────

export function useCreatePlaybookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegimePlaybookCreate) => {
      const res = await fetch('/api/regime/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create playbook' }));
        throw new Error(err.error ?? 'Failed to create playbook');
      }
      return res.json() as Promise<RegimePlaybook>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.regime.all });
    },
  });
}

// ── Delete Playbook ──────────────────────────────────────────────────────────

export function useDeletePlaybookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/regime/playbooks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete playbook');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.regime.all });
    },
  });
}

// ── Toggle Playbook Active ───────────────────────────────────────────────────

export function useTogglePlaybookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await fetch(`/api/regime/playbooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      });
      if (!res.ok) throw new Error('Failed to toggle playbook');
      return res.json() as Promise<RegimePlaybook>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.regime.all });
    },
  });
}
