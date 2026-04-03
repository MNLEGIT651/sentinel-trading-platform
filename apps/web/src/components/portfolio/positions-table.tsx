'use client';

import { memo } from 'react';
import { PieChart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortableTableHead,
  type SortState,
} from '@/components/ui/table';
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

export const PositionsTable = memo(function PositionsTable({
  sortedPositions,
  sortField,
  sortDir,
  onToggleSort,
}: PositionsTableProps) {
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

  const sortState: SortState = { column: sortField, direction: sortDir };

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="p-0">
        <Table aria-label="Open positions">
          <TableHeader>
            <TableRow>
              {(
                [
                  ['ticker', 'Ticker'],
                  ['marketValue', 'Market Value'],
                  ['pnl', 'P&L'],
                  ['pnlPct', 'P&L %'],
                ] as [SortField, string][]
              ).map(([field, label]) => (
                <SortableTableHead
                  key={field}
                  column={field}
                  sortState={sortState}
                  onSort={(col) => onToggleSort(col as SortField)}
                  className="text-[11px] uppercase tracking-wider"
                >
                  {label}
                </SortableTableHead>
              ))}
              <TableHead className="text-[11px] uppercase tracking-wider">Shares</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Avg Entry</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Current</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Sector</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPositions.map((p) => {
              const pl = pnl(p);
              const plPct = pnlPct(p);
              return (
                <TableRow key={p.ticker}>
                  <TableCell className="px-4 py-3">
                    <div>
                      <span className="text-sm font-semibold text-foreground">{p.ticker}</span>
                      <p className="text-[11px] text-muted-foreground">{p.name}</p>
                    </div>
                  </TableCell>
                  <TableCell numeric className="px-4 py-3">
                    <span className="text-sm font-mono text-foreground">
                      $
                      {marketValue(p).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </TableCell>
                  <TableCell numeric className="px-4 py-3">
                    <span
                      className={cn('text-sm font-mono', pl >= 0 ? 'text-profit' : 'text-loss')}
                    >
                      {pl >= 0 ? '+' : ''}$
                      {pl.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </TableCell>
                  <TableCell numeric className="px-4 py-3">
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
                  </TableCell>
                  <TableCell numeric className="px-4 py-3">
                    <span className="text-sm font-mono text-muted-foreground">{p.shares}</span>
                  </TableCell>
                  <TableCell numeric className="px-4 py-3">
                    <span className="text-sm font-mono text-muted-foreground">
                      ${p.avgEntry.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell numeric className="px-4 py-3">
                    <span className="text-sm font-mono text-foreground">
                      ${p.currentPrice.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge
                      className={cn(
                        'border text-[10px]',
                        sectorBadges[p.sector] ?? 'bg-muted text-muted-foreground border-border',
                      )}
                    >
                      {p.sector}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
});
