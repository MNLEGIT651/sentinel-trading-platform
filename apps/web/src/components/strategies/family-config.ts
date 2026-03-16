import { TrendingUp, Zap, BarChart3, DollarSign, GitBranch } from 'lucide-react';
import type { ElementType } from 'react';

export interface FamilyConfig {
  label: string;
  icon: ElementType;
  color: string;
  badgeClass: string;
}

export const familyConfig: Record<string, FamilyConfig> = {
  trend_following: {
    label: 'Trend Following',
    icon: TrendingUp,
    color: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  momentum: {
    label: 'Momentum',
    icon: Zap,
    color: 'text-amber-400',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  mean_reversion: {
    label: 'Mean Reversion',
    icon: BarChart3,
    color: 'text-sky-400',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
  value: {
    label: 'Value',
    icon: DollarSign,
    color: 'text-violet-400',
    badgeClass: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  },
  pairs: {
    label: 'Pairs Trading',
    icon: GitBranch,
    color: 'text-rose-400',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
};
