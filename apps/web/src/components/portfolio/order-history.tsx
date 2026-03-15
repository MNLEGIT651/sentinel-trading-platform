'use client';

import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type Position, marketValue } from './positions-table';

function RiskGauge({ level, label }: { level: number; label: string }) {
  const pct = Math.min(Math.max(level, 0), 100);
  const color = pct < 30 ? 'bg-profit' : pct < 60 ? 'bg-amber-500' : 'bg-loss';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-mono text-foreground">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface OrderHistoryProps {
  positions: Position[];
  portfolioTotal: number;
  totalValue: number;
  totalCost: number;
  totalPnlPct: number;
  allocations: { label: string; pct: number; color: string }[];
}

export function OrderHistory({
  positions,
  portfolioTotal,
  totalValue,
  totalCost,
  totalPnlPct,
  allocations,
}: OrderHistoryProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-profit" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Risk Metrics
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <RiskGauge
            level={portfolioTotal > 0 ? (totalValue / portfolioTotal) * 100 : 0}
            label="Portfolio Utilization"
          />
          <RiskGauge level={totalCost > 0 ? Math.abs(totalPnlPct) : 0} label="Drawdown Exposure" />
          <RiskGauge
            level={
              positions.length > 0
                ? (Math.max(...positions.map(marketValue)) / totalValue) * 100
                : 0
            }
            label="Concentration (Largest Position)"
          />
          <RiskGauge
            level={allocations.length > 0 ? (allocations[0]?.pct ?? 0) : 0}
            label="Sector Tilt (Largest Sector)"
          />
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Risk Limits</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50 overflow-hidden">
            <div className="bg-muted/30 px-3 py-1.5">
              <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Current Configuration
              </p>
            </div>
            <div className="divide-y divide-border/50">
              {[
                ['Max Position Size', '5%'],
                ['Max Sector Exposure', '20%'],
                ['Daily Loss Limit', '2%'],
                ['Soft Drawdown Halt', '10%'],
                ['Hard Drawdown Halt', '15%'],
                ['Max Open Positions', '20'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs font-mono font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
