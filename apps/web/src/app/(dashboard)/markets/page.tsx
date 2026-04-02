'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

const PriceChart = dynamic(
  () => import('@/components/charts/price-chart').then((m) => ({ default: m.PriceChart })),
  { ssr: false },
);
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { SimulatedBadge } from '@/components/ui/simulated-badge';
import { useAppStore } from '@/stores/app-store';
import { cn } from '@/lib/utils';
import type { OHLCV } from '@sentinel/shared';
import { useQuotesQuery, useBarsQuery } from '@/hooks/queries';

const WATCHLIST_TICKERS = [
  { ticker: 'AAPL', name: 'Apple Inc.' },
  { ticker: 'MSFT', name: 'Microsoft Corp.' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.' },
  { ticker: 'TSLA', name: 'Tesla Inc.' },
  { ticker: 'META', name: 'Meta Platforms' },
  { ticker: 'JPM', name: 'JPMorgan Chase' },
  { ticker: 'V', name: 'Visa Inc.' },
  { ticker: 'SPY', name: 'SPDR S&P 500' },
];

const TICKER_NAMES = WATCHLIST_TICKERS.map((w) => w.ticker);

interface WatchlistItem {
  ticker: string;
  name: string;
  price: number;
  change: number;
}

const FALLBACK_PRICES = [
  178.72, 378.91, 141.8, 178.25, 495.22, 248.48, 355.64, 172.96, 261.53, 456.38,
];
const FALLBACK_CHANGES = [1.24, 0.82, -0.56, 1.89, 3.12, -2.15, 0.45, 0.33, 0.78, 0.62];

function buildFallbackWatchlist(): WatchlistItem[] {
  return WATCHLIST_TICKERS.map((w, i) => ({
    ...w,
    price: FALLBACK_PRICES[i] ?? 0,
    change: FALLBACK_CHANGES[i] ?? 0,
  }));
}

// Generate synthetic OHLCV (fallback when engine is offline)
function generateSampleData(basePrice: number): OHLCV[] {
  const data: OHLCV[] = [];
  let current = basePrice * 0.9;
  for (let i = 90; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const vol = current * 0.02;
    const open = current + (Math.random() - 0.5) * vol;
    const close = open + (Math.random() - 0.45) * vol;
    const high = Math.max(open, close) + Math.random() * vol * 0.5;
    const low = Math.min(open, close) - Math.random() * vol * 0.5;
    data.push({
      timestamp: d.toISOString(),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(1_000_000 + Math.random() * 5_000_000),
    });
    current = close;
  }
  return data;
}

export default function MarketsPage() {
  const engineOnline = useAppStore((s) => s.engineOnline);
  const [selectedTicker, setSelectedTicker] = useState('AAPL');

  const { data: quotes, isPending: quotesLoading } = useQuotesQuery(TICKER_NAMES);
  const { data: bars, isPending: chartLoading } = useBarsQuery(selectedTicker);

  const isLive = engineOnline === true && !!quotes;
  const loading = engineOnline === null || (engineOnline === true && quotesLoading);

  const watchlist: WatchlistItem[] = useMemo(() => {
    if (!quotes)
      return engineOnline === false
        ? buildFallbackWatchlist()
        : WATCHLIST_TICKERS.map((w) => ({ ...w, price: 0, change: 0 }));
    return WATCHLIST_TICKERS.map((w) => {
      const q = quotes.find((q) => q.ticker === w.ticker);
      return { ...w, price: q?.close ?? 0, change: q?.change_pct ?? 0 };
    });
  }, [quotes, engineOnline]);

  const chartData: OHLCV[] = useMemo(() => {
    if (bars && bars.length > 0) return bars;
    // Fallback: synthetic data when engine offline or no bars
    const stock = watchlist.find((w) => w.ticker === selectedTicker);
    return generateSampleData(stock?.price || 150);
  }, [bars, watchlist, selectedTicker]);

  const selectedStock = watchlist.find((w) => w.ticker === selectedTicker);

  return (
    <div className="flex h-full flex-col gap-4 p-3 sm:p-4">
      {engineOnline === false && <OfflineBanner service="engine" />}
      <div className="flex flex-1 flex-col gap-4 min-h-0 lg:flex-row">
        {/* Watchlist panel */}
        <Card className="w-full shrink-0 bg-card border-border lg:w-72">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Watchlist</CardTitle>
              {!loading && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase',
                    isLive ? 'bg-profit/15 text-profit' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      isLive ? 'bg-profit animate-pulse' : 'bg-muted-foreground',
                    )}
                  />
                  {isLive ? 'Live' : 'Offline'}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-48 lg:h-[calc(100vh-12rem)]">
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
                      <p className="text-[11px] text-muted-foreground">{stock.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {stock.price > 0 ? `$${stock.price.toFixed(2)}` : '--'}
                      </p>
                      <p
                        className={cn(
                          'text-[11px] font-medium',
                          stock.change >= 0 ? 'text-profit' : 'text-loss',
                        )}
                      >
                        {stock.price > 0
                          ? `${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%`
                          : '--'}
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
              <CardTitle className="text-lg font-bold">{selectedTicker}</CardTitle>
              {selectedStock && (
                <>
                  <span className="text-sm text-muted-foreground">{selectedStock.name}</span>
                  <span className="text-lg font-semibold text-data-primary">
                    {selectedStock.price > 0 ? `$${selectedStock.price.toFixed(2)}` : '--'}
                  </span>
                  {selectedStock.price > 0 && (
                    <span
                      className={cn(
                        'text-sm font-medium',
                        selectedStock.change >= 0 ? 'text-profit' : 'text-loss',
                      )}
                    >
                      {selectedStock.change >= 0 ? '+' : ''}
                      {selectedStock.change.toFixed(2)}%
                    </span>
                  )}
                </>
              )}
              {chartLoading && (
                <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
              )}
              {!isLive && !chartLoading && <SimulatedBadge />}
            </div>
          </CardHeader>
          <CardContent className="h-[calc(100vh-14rem)] p-0 px-4 pb-4">
            <PriceChart data={chartData} loading={chartLoading || loading} className="rounded-md" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
