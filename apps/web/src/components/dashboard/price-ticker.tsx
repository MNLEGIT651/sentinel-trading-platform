'use client';

import { cn } from '@/lib/utils';

interface TickerItem {
  ticker: string;
  price: number;
  change: number;
}

interface PriceTickerProps {
  items: TickerItem[];
}

export function PriceTicker({ items }: PriceTickerProps) {
  return (
    <div className="flex items-center gap-4 overflow-x-auto rounded-lg border border-border bg-card pl-4 pr-14 py-2 scrollbar-none">
      {items.map((item) => (
        <div key={item.ticker} className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-foreground">{item.ticker}</span>
          <span className="text-xs text-muted-foreground">${item.price.toFixed(2)}</span>
          <span
            className={cn('text-xs font-medium', item.change >= 0 ? 'text-profit' : 'text-loss')}
          >
            {item.change >= 0 ? '+' : ''}
            {item.change.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}
