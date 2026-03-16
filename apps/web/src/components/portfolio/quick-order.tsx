'use client';

import { SendHorizonal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface QuickOrderProps {
  symbol: string;
  side: 'buy' | 'sell';
  qty: string;
  status: string | null;
  submitting: boolean;
  onSymbolChange: (v: string) => void;
  onSideChange: (v: 'buy' | 'sell') => void;
  onQtyChange: (v: string) => void;
  onSubmit: () => void;
}

export function QuickOrder({
  symbol,
  side,
  qty,
  status,
  submitting,
  onSymbolChange,
  onSideChange,
  onQtyChange,
  onSubmit,
}: QuickOrderProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="py-3 px-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Quick Order
          </span>
          <div className="flex items-center gap-1.5 rounded-md bg-muted/50 p-0.5">
            <button
              onClick={() => onSideChange('buy')}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                side === 'buy'
                  ? 'bg-profit/20 text-profit'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Buy
            </button>
            <button
              onClick={() => onSideChange('sell')}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                side === 'sell'
                  ? 'bg-loss/20 text-loss'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Sell
            </button>
          </div>
          <input
            type="text"
            value={symbol}
            onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
            placeholder="Symbol"
            className="w-24 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="number"
            value={qty}
            onChange={(e) => onQtyChange(e.target.value)}
            placeholder="Qty"
            min="1"
            className="w-20 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={onSubmit}
            disabled={submitting || !symbol || !qty}
            className="flex items-center gap-1.5 rounded-md bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 transition-colors disabled:opacity-40"
          >
            <SendHorizonal className="h-3.5 w-3.5" />
            {submitting ? 'Sending...' : 'Submit'}
          </button>
          {status && (
            <span
              className={cn(
                'text-xs font-mono',
                status.startsWith('Filled') ? 'text-profit' : 'text-loss',
              )}
            >
              {status}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
