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
  disabled?: boolean;
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
  disabled = false,
  onSymbolChange,
  onSideChange,
  onQtyChange,
  onSubmit,
}: QuickOrderProps) {
  const qtyNum = Number(qty);
  const validQty = qty !== '' && Number.isFinite(qtyNum) && qtyNum > 0 && Number.isInteger(qtyNum);
  const validSymbol = /^[A-Z]{1,5}$/.test(symbol);
  const canSubmit = !submitting && !disabled && validSymbol && validQty;

  return (
    <Card className={cn('bg-card border-border', disabled && 'opacity-50')}>
      <CardContent className="py-3 px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Quick Order
            {disabled && <span className="ml-1.5 text-amber-400">(Engine offline)</span>}
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 rounded-md bg-muted/50 p-0.5">
              <button
                onClick={() => onSideChange('buy')}
                aria-label="Buy"
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  side === 'buy'
                    ? 'bg-profit/20 text-profit'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Buy
              </button>
              <button
                onClick={() => onSideChange('sell')}
                aria-label="Sell"
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  side === 'sell'
                    ? 'bg-loss/20 text-loss'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Sell
              </button>
            </div>
            <div className="flex flex-col">
              <label htmlFor="quick-order-symbol" className="sr-only">
                Symbol
              </label>
              <input
                id="quick-order-symbol"
                type="text"
                value={symbol}
                onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
                placeholder="Symbol"
                aria-invalid={symbol !== '' && !validSymbol ? true : undefined}
                className={cn(
                  'w-20 sm:w-24 rounded-md border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary',
                  symbol !== '' && !validSymbol ? 'border-loss' : 'border-border',
                )}
              />
              {symbol !== '' && !validSymbol && (
                <span className="text-[10px] text-loss mt-0.5">1-5 letters</span>
              )}
            </div>
            <div className="flex flex-col">
              <label htmlFor="quick-order-qty" className="sr-only">
                Quantity
              </label>
              <input
                id="quick-order-qty"
                type="number"
                value={qty}
                onChange={(e) => onQtyChange(e.target.value)}
                placeholder="Qty"
                min="1"
                aria-invalid={qty !== '' && !validQty ? true : undefined}
                className={cn(
                  'w-16 sm:w-20 rounded-md border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary',
                  qty !== '' && !validQty ? 'border-loss' : 'border-border',
                )}
              />
              {qty !== '' && !validQty && (
                <span className="text-[10px] text-loss mt-0.5">Positive int</span>
              )}
            </div>
            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              className="flex items-center gap-1.5 rounded-md bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 transition-colors disabled:opacity-40"
            >
              <SendHorizonal className="h-3.5 w-3.5" />
              {submitting ? 'Sending...' : 'Submit'}
            </button>
          </div>
          <span
            aria-live="polite"
            className={cn(
              'text-xs font-mono',
              status ? (status.startsWith('Filled') ? 'text-profit' : 'text-loss') : '',
            )}
          >
            {status ?? ''}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
