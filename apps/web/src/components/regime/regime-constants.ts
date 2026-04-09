import { TrendingUp, TrendingDown, Minus, AlertTriangle, Flame } from 'lucide-react';
import type { MarketRegime } from '@/hooks/queries';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RegimeMeta {
  value: MarketRegime;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

export const REGIMES: RegimeMeta[] = [
  {
    value: 'bull',
    label: 'Bull',
    icon: TrendingUp,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
  },
  { value: 'bear', label: 'Bear', icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/15' },
  {
    value: 'sideways',
    label: 'Sideways',
    icon: Minus,
    color: 'text-zinc-400',
    bg: 'bg-zinc-500/15',
  },
  {
    value: 'volatile',
    label: 'Volatile',
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
  },
  { value: 'crisis', label: 'Crisis', icon: Flame, color: 'text-red-500', bg: 'bg-red-600/15' },
];

export const STRATEGY_FAMILIES: Record<string, string[]> = {
  'Trend Following': ['sma_crossover', 'ema_momentum_trend', 'macd_trend'],
  Momentum: ['rsi_momentum', 'roc_momentum', 'obv_divergence'],
  'Mean Reversion': ['bollinger_reversion', 'zscore_reversion', 'rsi_mean_reversion'],
  Value: ['price_to_ma_value', 'relative_value'],
  Pairs: ['pairs_spread'],
};

// ── Helpers ────────────────────────────────────────────────────────────────

export function formatStrategy(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const SIDEWAYS_META: RegimeMeta = {
  value: 'sideways' as const,
  label: 'Sideways',
  icon: Minus,
  color: 'text-zinc-400',
  bg: 'bg-zinc-500/15',
};

export function getRegimeMeta(regime: MarketRegime): RegimeMeta {
  return REGIMES.find((r) => r.value === regime) ?? SIDEWAYS_META;
}
