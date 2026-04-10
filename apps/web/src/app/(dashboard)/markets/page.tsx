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
import { DataProvenance } from '@/components/ui/data-provenance';
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
import { useQuotesQuery, useBarsQuery } from '@/hooks/queries';
import { TICKER_SYMBOLS, WATCHLIST_TICKERS } from '@/lib/constants';

const TICKER_NAMES = WATCHLIST_TICKERS.map((w) => w.ticker);

interface WatchlistItem {
  ticker: string;
  name: string;
  price: number;
  change: number;
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
  const chartMode =
    bars && bars.length > 0 ? 'live' : engineOnline === false ? 'offline' : 'cached';

  const watchlist: WatchlistItem[] = useMemo(() => {
    if (!quotes) return WATCHLIST_TICKERS.map((w) => ({ ...w, price: 0, change: 0 }));
    return WATCHLIST_TICKERS.map((w) => {
      const q = quotes.find((q) => q.ticker === w.ticker);
      return { ...w, price: q?.close ?? 0, change: q?.change_pct ?? 0 };
    });
  }, [quotes]);

  const chartData = useMemo(() => {
    return bars && bars.length > 0 ? bars : [];
  }, [bars]);

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
                {barsError && engineOnline === true ? (
                  <ErrorState
                    title="Chart data unavailable"
                    message={barsErrorObj?.message ?? 'Could not load price history.'}
                    onRetry={() => refetchBars()}
                    className="flex h-full items-center justify-center"
                  />
                ) : chartData.length === 0 && !chartLoading ? (
                  <ErrorState
                    title="Chart data unavailable"
                    message="No historical bars were returned by the engine for this ticker."
                    onRetry={() => refetchBars()}
                    className="flex h-full items-center justify-center"
                  />
                ) : (
                  <PriceChart
                    data={chartData}
                    loading={chartLoading || loading}
                    className="rounded-md"
                  />
                )}
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
