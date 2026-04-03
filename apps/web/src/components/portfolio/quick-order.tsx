'use client';

import { SendHorizonal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
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
  tickerSuggestions?: readonly string[];
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
  tickerSuggestions = [],
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
            <div
              className="flex items-center gap-1.5 rounded-md bg-muted/50 p-0.5"
              role="group"
              aria-label="Order side"
            >
              <button
                onClick={() => onSideChange('buy')}
                aria-label="Buy"
                aria-pressed={side === 'buy'}
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
                aria-pressed={side === 'sell'}
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
            <div
              className="flex items-center gap-1.5 rounded-md bg-muted/50 p-0.5"
              role="group"
              aria-label="Order type"
            >
              <button
                onClick={() => onOrderTypeChange('market')}
                aria-label="Market order"
                aria-pressed={orderType === 'market'}
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
                aria-pressed={orderType === 'limit'}
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
              <Label htmlFor="quick-order-symbol" className="sr-only">
                Symbol
              </Label>
              <Input
                id="quick-order-symbol"
                type="text"
                list="ticker-suggestions"
                value={symbol}
                onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
                placeholder="Symbol"
                aria-label="Ticker symbol"
                aria-invalid={symbol !== '' && !validSymbol ? true : undefined}
                className={cn('h-auto w-20 sm:w-24 px-2.5 py-1.5 text-xs font-mono')}
              />
              {tickerSuggestions.length > 0 && (
                <datalist id="ticker-suggestions">
                  {tickerSuggestions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              )}
              {symbol !== '' && !validSymbol && (
                <span className="text-[10px] text-loss mt-0.5">1-5 letters</span>
              )}
            </div>

            {/* Quantity */}
            <div className="flex flex-col">
              <Label htmlFor="quick-order-qty" className="sr-only">
                Quantity
              </Label>
              <Input
                id="quick-order-qty"
                type="number"
                value={qty}
                onChange={(e) => onQtyChange(e.target.value)}
                placeholder="Qty"
                min="1"
                aria-label="Order quantity"
                aria-invalid={qty !== '' && !validQty ? true : undefined}
                className={cn('h-auto w-16 sm:w-20 px-2.5 py-1.5 text-xs font-mono')}
              />
              {qty !== '' && !validQty && (
                <span className="text-[10px] text-loss mt-0.5">Positive int</span>
              )}
            </div>

            {/* Limit price (visible only for limit orders) */}
            {orderType === 'limit' && (
              <div className="flex flex-col">
                <Label htmlFor="quick-order-limit-price" className="sr-only">
                  Limit Price
                </Label>
                <Input
                  id="quick-order-limit-price"
                  type="number"
                  value={limitPrice}
                  onChange={(e) => onLimitPriceChange(e.target.value)}
                  placeholder="Price"
                  min="0.01"
                  step="0.01"
                  aria-label="Limit price"
                  aria-invalid={limitPrice !== '' && !validLimitPrice ? true : undefined}
                  className={cn('h-auto w-20 sm:w-24 px-2.5 py-1.5 text-xs font-mono')}
                />
                {limitPrice !== '' && !validLimitPrice && (
                  <span className="text-[10px] text-loss mt-0.5">Positive number</span>
                )}
              </div>
            )}

            {/* Time in force */}
            <div className="flex flex-col">
              <Label htmlFor="quick-order-tif" className="sr-only">
                Time in Force
              </Label>
              <Select
                id="quick-order-tif"
                value={timeInForce}
                onChange={(e) => onTimeInForceChange(e.target.value as TimeInForce)}
                aria-label="Time in Force"
                className="h-auto px-2 py-1.5 text-xs"
              >
                {(Object.keys(TIF_LABELS) as TimeInForce[]).map((tif) => (
                  <option key={tif} value={tif}>
                    {TIF_LABELS[tif]}
                  </option>
                ))}
              </Select>
            </div>

            <LoadingButton
              onClick={onSubmit}
              disabled={!canSubmit}
              loading={submitting}
              size="sm"
              variant="ghost"
              aria-label="Submit"
              className="gap-1.5 bg-primary/15 text-xs font-medium text-primary hover:bg-primary/25"
            >
              <SendHorizonal className="h-3.5 w-3.5" aria-hidden="true" />
              Submit
            </LoadingButton>
          </div>
          <span aria-live="polite" className={cn('text-xs font-mono', statusColorClass(status))}>
            {status ?? ''}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
