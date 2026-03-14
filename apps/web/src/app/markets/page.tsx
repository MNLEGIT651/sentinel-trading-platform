'use client';

import { useState, useMemo } from 'react';
import { PriceChart } from '@/components/charts/price-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { OHLCV } from '@sentinel/shared';

// Sample watchlist data
const watchlist = [
  { ticker: 'AAPL', name: 'Apple Inc.', price: 178.72, change: 1.24 },
  { ticker: 'MSFT', name: 'Microsoft Corp.', price: 378.91, change: 0.82 },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', price: 141.8, change: -0.56 },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', price: 178.25, change: 1.89 },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 495.22, change: 3.12 },
  { ticker: 'TSLA', name: 'Tesla Inc.', price: 248.48, change: -2.15 },
  { ticker: 'META', name: 'Meta Platforms', price: 355.64, change: 0.45 },
  { ticker: 'JPM', name: 'JPMorgan Chase', price: 172.96, change: 0.33 },
  { ticker: 'V', name: 'Visa Inc.', price: 261.53, change: 0.78 },
  { ticker: 'SPY', name: 'SPDR S&P 500', price: 456.38, change: 0.62 },
];

// Generate sample OHLCV data for a given ticker
function generateSampleData(ticker: string): OHLCV[] {
  const basePrice =
    watchlist.find((w) => w.ticker === ticker)?.price || 100;
  const data: OHLCV[] = [];
  let currentPrice = basePrice * 0.9;

  for (let i = 90; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const volatility = currentPrice * 0.02;
    const open = currentPrice + (Math.random() - 0.5) * volatility;
    const close = open + (Math.random() - 0.45) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = Math.floor(1000000 + Math.random() * 5000000);

    data.push({
      timestamp: date.toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    currentPrice = close;
  }

  return data;
}

export default function MarketsPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');

  const chartData = useMemo(
    () => generateSampleData(selectedTicker),
    [selectedTicker],
  );

  const selectedStock = watchlist.find((w) => w.ticker === selectedTicker);

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Watchlist panel */}
      <Card className="w-72 shrink-0 bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Watchlist
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <div className="space-y-0.5 px-2 pb-2">
              {watchlist.map((stock) => (
                <button
                  key={stock.ticker}
                  onClick={() => setSelectedTicker(stock.ticker)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors',
                    selectedTicker === stock.ticker
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <div>
                    <p className="text-sm font-medium">{stock.ticker}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {stock.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      ${stock.price.toFixed(2)}
                    </p>
                    <p
                      className={cn(
                        'text-[11px] font-medium',
                        stock.change >= 0 ? 'text-profit' : 'text-loss',
                      )}
                    >
                      {stock.change >= 0 ? '+' : ''}
                      {stock.change.toFixed(2)}%
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chart panel */}
      <Card className="flex-1 bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-bold">
              {selectedTicker}
            </CardTitle>
            {selectedStock && (
              <>
                <span className="text-sm text-muted-foreground">
                  {selectedStock.name}
                </span>
                <span className="text-lg font-semibold">
                  ${selectedStock.price.toFixed(2)}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    selectedStock.change >= 0 ? 'text-profit' : 'text-loss',
                  )}
                >
                  {selectedStock.change >= 0 ? '+' : ''}
                  {selectedStock.change.toFixed(2)}%
                </span>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="h-[calc(100vh-14rem)] p-0 px-4 pb-4">
          <PriceChart data={chartData} className="rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}
