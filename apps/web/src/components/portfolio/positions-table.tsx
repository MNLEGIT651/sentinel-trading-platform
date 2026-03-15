'use client';

import { ArrowUpDown, PieChart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface Position {
  ticker: string;
  name: string;
  shares: number;
  avgEntry: number;
  currentPrice: number;
  sector: string;
  unrealizedPl?: number;
  unrealizedPlPct?: number;
}

export type SortField = 'ticker' | 'marketValue' | 'pnl' | 'pnlPct';
export type SortDir = 'asc' | 'desc';

export function pnl(p: Position) {
  return (p.currentPrice - p.avgEntry) * p.shares;
}

export function pnlPct(p: Position) {
  if (p.avgEntry === 0) return 0;
  return ((p.currentPrice - p.avgEntry) / p.avgEntry) * 100;
}

export function marketValue(p: Position) {
  return p.currentPrice * p.shares;
}

const sectorBadges: Record<string, string> = {
  Technology: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Financials: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Consumer: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Index: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  Healthcare: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  Energy: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Industrials: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
};

interface PositionsTableProps {
  sortedPositions: Position[];
  sortField: SortField;
  sortDir: SortDir;
  onToggleSort: (field: SortField) => void;
}

export function PositionsTable({ sortedPositions, onToggleSort }: PositionsTableProps) {
  if (sortedPositions.length === 0) {
    return (
      <Card className="bg-card border-border overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PieChart className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No open positions</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Use the Quick Order panel above to place your first trade
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {(
                  [
                    ['ticker', 'Ticker'],
                    ['marketValue', 'Market Value'],
                    ['pnl', 'P&L'],
                    ['pnlPct', 'P&L %'],
                  ] as [SortField, string][]
                ).map(([field, label]) => (
                  <th key={field} className="px-4 py-2.5 text-left">
                    <button
                      onClick={() => onToggleSort(field)}
                      className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {label}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-2.5 text-left">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Shares
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Avg Entry
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Current
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Sector
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedPositions.map((p) => {
                const pl = pnl(p);
                const plPct = pnlPct(p);
                return (
                  <tr key={p.ticker} className="transition-colors hover:bg-accent/30">
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-sm font-semibold text-foreground">{p.ticker}</span>
                        <p className="text-[11px] text-muted-foreground">{p.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-foreground">
                        $
                        {marketValue(p).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn('text-sm font-mono', pl >= 0 ? 'text-profit' : 'text-loss')}
                      >
                        {pl >= 0 ? '+' : ''}$
                        {pl.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={cn(
                          'border text-[10px] font-semibold font-mono',
                          plPct >= 0
                            ? 'bg-profit/15 text-profit border-profit/30'
                            : 'bg-loss/15 text-loss border-loss/30',
                        )}
                      >
                        {plPct >= 0 ? '+' : ''}
                        {plPct.toFixed(2)}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-muted-foreground">{p.shares}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-muted-foreground">
                        ${p.avgEntry.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-foreground">
                        ${p.currentPrice.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={cn(
                          'border text-[10px]',
                          sectorBadges[p.sector] ?? 'bg-muted text-muted-foreground border-border',
                        )}
                      >
                        {p.sector}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
