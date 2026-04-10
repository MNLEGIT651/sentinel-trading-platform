'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

const PriceChart = dynamic(
  () => import('@/components/charts/price-chart').then((m) => ({ default: m.PriceChart })),
  { ssr: false },
);
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { DataProvenance } from '@/components/ui/data-provenance';
import { ConfigBanner } from '@/components/ui/config-banner';
import { ErrorBoundary } from '@/components/error-boundary';
import {
  PageContainer,
  ResponsivePaneLayout,
  SectionStack,
} from '@/components/layout/responsive-primitives';
import { ErrorState } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAppStore } from '@/stores/app-store';
import { cn } from '@/lib/utils';
import { getStatusColors } from '@/lib/status-colors';
import type { OHLCV } from '@sentinel/shared';
import { useQuotesQuery, useBarsQuery } from '@/hooks/queries';
import {
  TICKER_SYMBOLS,
  WATCHLIST_TICKERS,
  FALLBACK_PRICES,
  FALLBACK_CHANGES,
} from '@/lib/constants';

const TICKER_NAMES = WATCHLIST_TICKERS.map((w) => w.ticker);

interface WatchlistItem {
  ticker: string;
  name: string;
  price: number;
  change: number;
}

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

function MarketsContent() {
  const engineOnline = useAppStore((s) => s.engineOnline);
  const [selectedTicker, setSelectedTicker] = useState(TICKER_SYMBOLS[0] ?? 'AAPL');

  const {
    data: quotes,
    isPending: quotesLoading,
    isError: quotesError,
    error: quotesErrorObj,
    refetch: refetchQuotes,
    dataUpdatedAt: quotesUpdatedAt,
  } = useQuotesQuery(TICKER_NAMES);
  const {
    data: bars,
    isPending: chartLoading,
    isFetching: chartFetching,
    isError: barsError,
    error: barsErrorObj,
    refetch: refetchBars,
    dataUpdatedAt: barsUpdatedAt,
  } = useBarsQuery(selectedTicker);

  const isLive = engineOnline === true && !!quotes;
  const loading = engineOnline === null || (engineOnline === true && quotesLoading);

  const quotesMode = isLive ? 'live' : engineOnline === false ? 'offline' : 'cached';
  const chartMode = bars && bars.length > 0 ? 'live' : 'simulated';

  const barsErrorMessage = useMemo(() => {
    if (!barsError) return null;
    const raw = barsErrorObj?.message ?? '';
    const match = raw.match(/Bars fetch failed:\s*(\d+)/);
    const status = match ? Number(match[1]) : null;
    if (status === 503) return 'Live market data is temporarily unavailable upstream.';
    if (status === 429) return 'Live market data rate limit reached. Please retry shortly.';
    if (status === 404) return 'No historical bars found for this ticker.';
    if (status && status >= 500) return 'The market data service is having trouble right now.';
    return 'Could not load live price history.';
  }, [barsError, barsErrorObj]);

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
    const stock = watchlist.find((w) => w.ticker === selectedTicker);
    return generateSampleData(stock?.price || 150);
  }, [bars, watchlist, selectedTicker]);

  const selectedStock = watchlist.find((w) => w.ticker === selectedTicker);

  if (quotesError && engineOnline === true) {
    return (
      <PageContainer className="page-enter" density="compact">
        <ErrorState
          title="Failed to load market data"
          message={quotesErrorObj?.message ?? 'Could not fetch quotes from the engine.'}
          onRetry={() => refetchQuotes()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="page-enter" density="compact">
      <SectionStack spacing="default">
        {engineOnline === false && <OfflineBanner service="engine" />}
        {engineOnline === true && !isLive && !loading && (
          <ConfigBanner
            message="Showing simulated data. Configure your Polygon API key for live market data."
            linkHref="/settings"
            linkLabel="Go to Settings"
          />
        )}
        <ResponsivePaneLayout
          className="stagger-grid"
          primary={
            <Card className="bg-card border-border" role="region" aria-label="Price chart panel">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2.5">
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
                            getStatusColors(selectedStock.change >= 0 ? 'success' : 'error').text,
                          )}
                        >
                          {selectedStock.change >= 0 ? '+' : ''}
                          {selectedStock.change.toFixed(2)}%
                        </span>
                      )}
                    </>
                  )}
                  {chartFetching && <Spinner size="sm" className="text-muted-foreground" />}
                  {!chartFetching && (
                    <DataProvenance
                      mode={chartMode}
                      lastUpdated={barsUpdatedAt ? new Date(barsUpdatedAt) : null}
                      staleThresholdMs={120_000}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="min-h-[18rem] p-0 px-2 pb-2 sm:px-4 sm:pb-4 lg:min-h-[30rem]">
                {barsError && engineOnline === true && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mx-2 mt-2 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 sm:mx-0"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{barsErrorMessage} Showing simulated data.</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => refetchBars()}
                      className="h-7 gap-1 px-2 text-xs text-amber-100 hover:bg-amber-500/20 hover:text-amber-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry
                    </Button>
                  </div>
                )}
                <PriceChart
                  data={chartData}
                  loading={chartLoading || loading}
                  className="rounded-md"
                />
              </CardContent>
            </Card>
          }
          secondary={
            <Card
              className="w-full shrink-0 bg-card border-border"
              role="region"
              aria-label="Watchlist panel"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Watchlist
                  </CardTitle>
                  {loading ? (
                    <Spinner size="sm" className="text-muted-foreground" />
                  ) : (
                    <DataProvenance
                      mode={quotesMode}
                      lastUpdated={quotesUpdatedAt ? new Date(quotesUpdatedAt) : null}
                      staleThresholdMs={60_000}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[min(44svh,24rem)] lg:h-[min(64dvh,40rem)]">
                  <Table aria-label="Watchlist stocks">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Symbol</TableHead>
                        <TableHead className="text-right text-xs">Price</TableHead>
                        <TableHead className="text-right text-xs">Change</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {watchlist.map((stock) => {
                        const changeColors = getStatusColors(
                          stock.change >= 0 ? 'success' : 'error',
                        );

                        return (
                          <TableRow
                            key={stock.ticker}
                            onClick={() => setSelectedTicker(stock.ticker)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedTicker(stock.ticker);
                              }
                            }}
                            tabIndex={0}
                            aria-label={`View chart for ${stock.ticker}`}
                            aria-current={selectedTicker === stock.ticker || undefined}
                            className={cn(
                              'cursor-pointer transition-colors',
                              selectedTicker === stock.ticker
                                ? 'bg-accent text-foreground'
                                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                            )}
                          >
                            <TableCell className="py-2.5">
                              <p className="text-sm font-medium">{stock.ticker}</p>
                              <p className="text-[11px] text-muted-foreground">{stock.name}</p>
                            </TableCell>
                            <TableCell numeric className="py-2.5 text-right text-sm font-medium">
                              {stock.price > 0 ? `$${stock.price.toFixed(2)}` : '--'}
                            </TableCell>
                            <TableCell
                              numeric
                              className={cn(
                                'py-2.5 text-right text-[11px] font-medium',
                                changeColors.text,
                              )}
                            >
                              {stock.price > 0
                                ? `${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%`
                                : '--'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          }
        />
      </SectionStack>
    </PageContainer>
  );
}

export default function MarketsPage() {
  return (
    <ErrorBoundary>
      <MarketsContent />
    </ErrorBoundary>
  );
}
