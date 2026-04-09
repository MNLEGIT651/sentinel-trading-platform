import { useMemo } from 'react';
import { Activity, BarChart3, DollarSign, ArrowUpDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import type { Fill, RiskEvaluation } from '@sentinel/shared';
import type { OrderHistoryEntry } from '@/hooks/queries/use-order-history-query';
import { formatCurrency } from './helpers';

interface StatsRowProps {
  fills: Fill[];
  riskEvals: RiskEvaluation[];
  orders: OrderHistoryEntry[];
  isLoading: boolean;
}

export function StatsRow({ fills, riskEvals, orders, isLoading }: StatsRowProps) {
  const stats = useMemo(() => {
    const totalFills = fills.length;
    const totalRiskEvals = riskEvals.length;
    const totalOrders = orders.length;
    const totalEntries = totalFills + totalRiskEvals + totalOrders;

    const totalCommission = fills.reduce((sum, f) => sum + (f.commission ?? 0), 0);

    const slippageValues = fills.filter((f) => f.slippage != null).map((f) => f.slippage as number);
    const avgSlippage =
      slippageValues.length > 0
        ? slippageValues.reduce((a, b) => a + b, 0) / slippageValues.length
        : null;

    const fillRate =
      totalOrders > 0
        ? ((orders.filter((o) => o.status === 'filled').length / totalOrders) * 100).toFixed(1)
        : '—';

    return { totalEntries, totalFills, totalOrders, fillRate, totalCommission, avgSlippage };
  }, [fills, riskEvals, orders]);

  if (isLoading) {
    return (
      <div className="stagger-grid grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="flex items-center justify-center p-4">
              <Spinner size="sm" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cells = [
    {
      label: 'Total Events',
      value: String(stats.totalEntries),
      icon: Activity,
    },
    {
      label: 'Fill Rate',
      value: `${stats.fillRate}%`,
      icon: BarChart3,
    },
    {
      label: 'Total Commission',
      value: formatCurrency(stats.totalCommission),
      icon: DollarSign,
    },
    {
      label: 'Avg Slippage',
      value: stats.avgSlippage != null ? `${stats.avgSlippage.toFixed(4)}` : '—',
      icon: ArrowUpDown,
    },
  ];

  return (
    <div className="stagger-grid grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {cells.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-zinc-500" />
                <p className="text-xs text-zinc-500">{c.label}</p>
              </div>
              <p className="mt-1 text-data-primary text-zinc-100">{c.value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
