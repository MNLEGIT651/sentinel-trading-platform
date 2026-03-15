'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface TradeEntry {
  side: string;
  entry_bar: number;
  exit_bar: number;
  entry_price: number;
  exit_price: number;
  pnl: number;
  return_pct: number;
}

interface TradeLogProps {
  trades: TradeEntry[];
}

export function TradeLog({ trades }: TradeLogProps) {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-96">
          <table className="w-full">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                {[
                  '#',
                  'Side',
                  'Entry Bar',
                  'Exit Bar',
                  'Entry Price',
                  'Exit Price',
                  'P&L',
                  'Return',
                ].map((h) => (
                  <th key={h} className="px-4 py-2 text-left">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {h}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {trades.map((t, i) => (
                <tr key={i} className="transition-colors hover:bg-accent/30">
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2">
                    <Badge
                      className={cn(
                        'border text-[10px]',
                        t.side === 'long'
                          ? 'bg-profit/15 text-profit border-profit/30'
                          : 'bg-loss/15 text-loss border-loss/30',
                      )}
                    >
                      {t.side.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground">
                    {t.entry_bar}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground">
                    {t.exit_bar}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-foreground">
                    ${t.entry_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-foreground">
                    ${t.exit_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={cn('text-xs font-mono', t.pnl >= 0 ? 'text-profit' : 'text-loss')}
                    >
                      {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        'text-xs font-mono',
                        t.return_pct >= 0 ? 'text-profit' : 'text-loss',
                      )}
                    >
                      {t.return_pct >= 0 ? '+' : ''}
                      {t.return_pct.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
