'use client';

import { DollarSign, TrendingUp, TrendingDown, BarChart3, Percent } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SnapshotMetricsProps {
  portfolioTotal: number;
  totalPnl: number;
  totalPnlPct: number;
  totalCost: number;
  cashBalance: number;
  positionCount: number;
  totalValue: number;
}

export function SnapshotMetrics({
  portfolioTotal,
  totalPnl,
  totalPnlPct,
  totalCost,
  cashBalance,
  positionCount,
  totalValue,
}: SnapshotMetricsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card className="bg-card border-border">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Portfolio Value</span>
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="mt-1 text-xl font-bold text-foreground">
            $
            {portfolioTotal.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Unrealized P&L</span>
            {totalPnl >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-profit" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-loss" />
            )}
          </div>
          <p className={cn('mt-1 text-xl font-bold', totalPnl >= 0 ? 'text-profit' : 'text-loss')}>
            {totalPnl >= 0 ? '+' : ''}$
            {totalPnl.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          {totalCost > 0 && (
            <p className={cn('text-xs', totalPnl >= 0 ? 'text-profit' : 'text-loss')}>
              {totalPnlPct >= 0 ? '+' : ''}
              {totalPnlPct.toFixed(2)}%
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Cash Balance</span>
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="mt-1 text-xl font-bold text-foreground">
            $
            {cashBalance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Positions</span>
            <Percent className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="mt-1 text-xl font-bold text-foreground">{positionCount}</p>
          <p className="text-xs text-muted-foreground">
            {portfolioTotal > 0 ? ((totalValue / portfolioTotal) * 100).toFixed(1) : '0.0'}%
            invested
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
