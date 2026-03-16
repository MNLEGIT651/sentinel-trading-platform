'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PriceChart } from '@/components/charts/price-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { OHLCV } from '@sentinel/shared';
import type { MarketQuote } from '@/lib/engine-client';

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

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000';

interface WatchlistItem {
  ticker: string;
  name: string;
  price: number;
  change: number;
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
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() =>
    WATCHLIST_TICKERS.map((w) => ({ ...w, price: 0, change: 0 })),
  );
  const [chartData, setChartData] = useState<OHLCV[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch all watchlist quotes from the engine
  useEffect(() => {
    let cancelled = false;
    async function fetchQuotes() {
      try {
        const tickers = WATCHLIST_TICKERS.map((w) => w.ticker).join(',');
        const res = await fetch(`${ENGINE_URL}/api/v1/data/quotes?tickers=${tickers}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const quotes: MarketQuote[] = await res.json();
        if (cancelled) return;

        setWatchlist(
          WATCHLIST_TICKERS.map((w) => {
            const q = quotes.find((q) => q.ticker === w.ticker);
            return {
              ...w,
              price: q?.close ?? 0,
              change: q?.change_pct ?? 0,
            };
          }),
        );
        setIsLive(true);
      } catch {
        if (cancelled) return;
        // Fallback: use static placeholder prices
        const staticPrices = [
          178.72, 378.91, 141.8, 178.25, 495.22, 248.48, 355.64, 172.96, 261.53, 456.38,
        ];
        const staticChanges = [1.24, 0.82, -0.56, 1.89, 3.12, -2.15, 0.45, 0.33, 0.78, 0.62];
        setWatchlist(
          WATCHLIST_TICKERS.map((w, i) => ({
            ...w,
            price: staticPrices[i] ?? 0,
            change: staticChanges[i] ?? 0,
          })),
        );
        setIsLive(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchQuotes();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch bars when ticker changes
  const fetchBars = useCallback(
    async (ticker: string) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setChartLoading(true);

      try {
        const res = await fetch(`${ENGINE_URL}/api/v1/data/bars/${ticker}?timeframe=1d&days=90`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const bars = await res.json();
        if (controller.signal.aborted) return;
        setChartData(
          bars.map(
            (b: {
              timestamp: string;
              open: number;
              high: number;
              low: number;
              close: number;
              volume: number;
            }) => ({
              timestamp: b.timestamp,
              open: b.open,
              high: b.high,
              low: b.low,
              close: b.close,
              volume: b.volume,
            }),
          ),
        );
      } catch {
        if (controller.signal.aborted) return;
        // Fallback: synthetic data
        const stock = watchlist.find((w) => w.ticker === ticker);
        setChartData(generateSampleData(stock?.price || 150));
      } finally {
        if (!controller.signal.aborted) setChartLoading(false);
      }
    },
    [watchlist],
  );

  useEffect(() => {
    fetchBars(selectedTicker);
  }, [selectedTicker, fetchBars]);

  const selectedStock = watchlist.find((w) => w.ticker === selectedTicker);

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Watchlist panel */}
      <Card className="w-72 shrink-0 bg-card border-border">
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
                <span className="text-lg font-semibold">
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
          </div>
        </CardHeader>
        <CardContent className="h-[calc(100vh-14rem)] p-0 px-4 pb-4">
          {chartData.length > 0 ? (
            <PriceChart data={chartData} className="rounded-md" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {loading ? 'Connecting to engine...' : 'No chart data available'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
