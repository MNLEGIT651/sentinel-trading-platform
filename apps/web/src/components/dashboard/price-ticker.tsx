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
    <div className="scrollbar-none flex items-center gap-4 overflow-x-auto rounded-md border border-border/70 bg-background/40 px-3 py-2">
      {items.map((item) => (
        <div key={item.ticker} className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{item.ticker}</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            ${item.price.toFixed(2)}
          </span>
          <span
            className={cn(
              'font-mono text-xs font-medium tabular-nums',
              item.change >= 0 ? 'text-profit' : 'text-loss',
            )}
          >
            {item.change >= 0 ? '+' : ''}
            {item.change.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}
