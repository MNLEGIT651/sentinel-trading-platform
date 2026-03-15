'use client';

import { PieChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { marketValue, type Position } from './positions-table';

interface AllocationEntry {
  label: string;
  pct: number;
  color: string;
}

function AllocationDonut({ allocations }: { allocations: AllocationEntry[] }) {
  const radius = 60;
  const stroke = 18;
  const circumference = 2 * Math.PI * radius;

  const segments = allocations.reduce<
    { label: string; pct: number; color: string; dashLen: number; dashOffset: number }[]
  >((acc, a) => {
    const dashLen = (a.pct / 100) * circumference;
    const prevOffset =
      acc.length > 0 ? acc[acc.length - 1].dashOffset + acc[acc.length - 1].dashLen : 0;
    acc.push({ ...a, dashLen, dashOffset: -prevOffset });
    return acc;
  }, []);

  return (
    <div className="flex items-center gap-6">
      <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
        {segments.map((a) => (
          <circle
            key={a.label}
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeDasharray={`${a.dashLen} ${circumference - a.dashLen}`}
            strokeDashoffset={a.dashOffset}
            className={a.color.replace('bg-', 'text-')}
            transform="rotate(-90 80 80)"
          />
        ))}
        <text
          x="80"
          y="76"
          textAnchor="middle"
          className="fill-foreground text-lg font-bold"
          fontSize="18"
        >
          {allocations.length}
        </text>
        <text x="80" y="94" textAnchor="middle" className="fill-muted-foreground" fontSize="11">
          sectors
        </text>
      </svg>
      <div className="space-y-2">
        {allocations.map((a) => (
          <div key={a.label} className="flex items-center gap-2">
            <div className={cn('h-2.5 w-2.5 rounded-full', a.color)} />
            <span className="text-xs text-muted-foreground w-24">{a.label}</span>
            <span className="text-xs font-mono font-medium text-foreground">
              {a.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AllocationChartProps {
  positions: Position[];
  allocations: AllocationEntry[];
  totalValue: number;
}

export function AllocationChart({ positions, allocations, totalValue }: AllocationChartProps) {
  if (positions.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <PieChart className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No positions to analyze</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Sector Allocation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AllocationDonut allocations={allocations} />
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Top Holdings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...positions]
            .sort((a, b) => marketValue(b) - marketValue(a))
            .slice(0, 5)
            .map((p) => {
              const pct = (marketValue(p) / totalValue) * 100;
              return (
                <div key={p.ticker} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{p.ticker}</span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}
