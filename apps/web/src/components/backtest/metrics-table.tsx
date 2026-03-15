'use client';

import { TrendingUp, TrendingDown, BarChart3, Target, Shield, Award, Timer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface BacktestSummary {
  strategy: string;
  ticker: string;
  initial_capital: number;
  final_equity: number;
  total_return: number;
  total_trades: number;
  win_rate: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  profit_factor: number;
  avg_trade_pnl: number;
  avg_holding_bars: number;
}

interface MetricsTableProps {
  summary: BacktestSummary;
}

export function MetricsTable({ summary: s }: MetricsTableProps) {
  const metrics = [
    {
      label: 'Total Return',
      value: `${(s.total_return * 100).toFixed(2)}%`,
      icon: s.total_return >= 0 ? TrendingUp : TrendingDown,
      color: s.total_return >= 0 ? 'text-profit' : 'text-loss',
    },
    {
      label: 'Sharpe Ratio',
      value: s.sharpe_ratio.toFixed(2),
      icon: BarChart3,
      color:
        s.sharpe_ratio >= 1 ? 'text-profit' : s.sharpe_ratio >= 0 ? 'text-amber-400' : 'text-loss',
    },
    {
      label: 'Win Rate',
      value: `${(s.win_rate * 100).toFixed(1)}%`,
      icon: Target,
      color: s.win_rate >= 0.5 ? 'text-profit' : 'text-loss',
    },
    {
      label: 'Max Drawdown',
      value: `${(s.max_drawdown * 100).toFixed(2)}%`,
      icon: Shield,
      color:
        s.max_drawdown > -0.1
          ? 'text-profit'
          : s.max_drawdown > -0.2
            ? 'text-amber-400'
            : 'text-loss',
    },
    {
      label: 'Profit Factor',
      value: s.profit_factor >= 999 ? '∞' : s.profit_factor.toFixed(2),
      icon: Award,
      color:
        s.profit_factor >= 1.5
          ? 'text-profit'
          : s.profit_factor >= 1
            ? 'text-amber-400'
            : 'text-loss',
    },
    {
      label: 'Avg Holding',
      value: `${s.avg_holding_bars.toFixed(0)} bars`,
      icon: Timer,
      color: 'text-muted-foreground',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {metrics.map(({ label, value, icon: Icon, color }) => (
        <Card key={label} className="bg-card border-border">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {label}
              </span>
              <Icon className={cn('h-3.5 w-3.5', color)} />
            </div>
            <p className={cn('text-lg font-bold font-mono', color)}>{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
