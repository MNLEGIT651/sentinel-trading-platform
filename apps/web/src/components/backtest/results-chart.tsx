'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BacktestSummary } from './metrics-table';

export type { BacktestSummary };

function EquityCurveChart({ curve, className }: { curve: number[]; className?: string }) {
  if (curve.length === 0) return null;

  const min = Math.min(...curve);
  const max = Math.max(...curve);
  const range = max - min || 1;
  const h = 200;
  const w = curve.length;

  const points = curve
    .map((v, i) => `${(i / (w - 1)) * 100},${h - ((v - min) / range) * (h - 20)}`)
    .join(' ');

  const isPositive = (curve[curve.length - 1] ?? 0) >= (curve[0] ?? 0);

  return (
    <div className={cn('w-full', className)}>
      <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="w-full h-40">
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${h} ${points} 100,${h}`} fill="url(#equityGrad)" />
        <polyline
          points={points}
          fill="none"
          stroke={isPositive ? '#22c55e' : '#ef4444'}
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

interface ResultsChartProps {
  summary: BacktestSummary;
  equityCurve: number[];
}

export function ResultsChart({ summary: s, equityCurve }: ResultsChartProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Equity Curve</CardTitle>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              Start: ${s.initial_capital.toLocaleString()}
            </span>
            <span className={s.final_equity >= s.initial_capital ? 'text-profit' : 'text-loss'}>
              End: ${s.final_equity.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <EquityCurveChart curve={equityCurve} />
      </CardContent>
    </Card>
  );
}
