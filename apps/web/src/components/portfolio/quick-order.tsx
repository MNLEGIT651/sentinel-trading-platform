'use client';

import { SendHorizonal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type OrderType = 'market' | 'limit';
export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok';

const TIF_LABELS: Record<TimeInForce, string> = {
  day: 'Day',
  gtc: 'GTC',
  ioc: 'IOC',
  fok: 'FOK',
};

interface QuickOrderProps {
  symbol: string;
  side: 'buy' | 'sell';
  qty: string;
  orderType: OrderType;
  timeInForce: TimeInForce;
  limitPrice: string;
  status: string | null;
  submitting: boolean;
  disabled?: boolean;
  onSymbolChange: (v: string) => void;
  onSideChange: (v: 'buy' | 'sell') => void;
  onQtyChange: (v: string) => void;
  onOrderTypeChange: (v: OrderType) => void;
  onTimeInForceChange: (v: TimeInForce) => void;
  onLimitPriceChange: (v: string) => void;
  onSubmit: () => void;
}

function statusColorClass(status: string | null): string {
  if (!status) return '';
  if (status.startsWith('Filled')) return 'text-profit';
  if (
    status.startsWith('Order failed') ||
    status.startsWith('Rejected') ||
    status.startsWith('Expired')
  )
    return 'text-loss';
  if (status.startsWith('Cancelled')) return 'text-loss';
  if (status.startsWith('Order accepted') || status.startsWith('Order pending'))
    return 'text-amber-400';
  return 'text-muted-foreground';
}

export function QuickOrder({
  symbol,
  side,
  qty,
  orderType,
  timeInForce,
  limitPrice,
  status,
  submitting,
  disabled = false,
  onSymbolChange,
  onSideChange,
  onQtyChange,
  onOrderTypeChange,
  onTimeInForceChange,
  onLimitPriceChange,
  onSubmit,
}: QuickOrderProps) {
  const qtyNum = Number(qty);
  const validQty = qty !== '' && Number.isFinite(qtyNum) && qtyNum > 0 && Number.isInteger(qtyNum);
  const validSymbol = /^[A-Z]{1,5}$/.test(symbol);
  const limitNum = Number(limitPrice);
  const validLimitPrice =
    orderType === 'market' || (limitPrice !== '' && Number.isFinite(limitNum) && limitNum > 0);
  const canSubmit = !submitting && !disabled && validSymbol && validQty && validLimitPrice;

  return (
    <Card className={cn('bg-card border-border', disabled && 'opacity-50')}>
      <CardContent className="py-3 px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Quick Order
            {disabled && <span className="ml-1.5 text-amber-400">(Engine offline)</span>}
          </span>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Side toggle */}
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

            {/* Order type toggle */}
            <div className="flex items-center gap-1.5 rounded-md bg-muted/50 p-0.5">
              <button
                onClick={() => onOrderTypeChange('market')}
                aria-label="Market order"
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  orderType === 'market'
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Market
              </button>
              <button
                onClick={() => onOrderTypeChange('limit')}
                aria-label="Limit order"
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  orderType === 'limit'
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Limit
              </button>
            </div>

            {/* Symbol */}
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

            {/* Quantity */}
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

            {/* Limit price (visible only for limit orders) */}
            {orderType === 'limit' && (
              <div className="flex flex-col">
                <label htmlFor="quick-order-limit-price" className="sr-only">
                  Limit Price
                </label>
                <input
                  id="quick-order-limit-price"
                  type="number"
                  value={limitPrice}
                  onChange={(e) => onLimitPriceChange(e.target.value)}
                  placeholder="Price"
                  min="0.01"
                  step="0.01"
                  aria-invalid={limitPrice !== '' && !validLimitPrice ? true : undefined}
                  className={cn(
                    'w-20 sm:w-24 rounded-md border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary',
                    limitPrice !== '' && !validLimitPrice ? 'border-loss' : 'border-border',
                  )}
                />
                {limitPrice !== '' && !validLimitPrice && (
                  <span className="text-[10px] text-loss mt-0.5">Positive number</span>
                )}
              </div>
            )}

            {/* Time in force */}
            <div className="flex flex-col">
              <label htmlFor="quick-order-tif" className="sr-only">
                Time in Force
              </label>
              <select
                id="quick-order-tif"
                value={timeInForce}
                onChange={(e) => onTimeInForceChange(e.target.value as TimeInForce)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {(Object.keys(TIF_LABELS) as TimeInForce[]).map((tif) => (
                  <option key={tif} value={tif}>
                    {TIF_LABELS[tif]}
                  </option>
                ))}
              </select>
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
          <span aria-live="polite" className={cn('text-xs font-mono', statusColorClass(status))}>
            {status ?? ''}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
