'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PieChart, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { DataProvenance } from '@/components/ui/data-provenance';
import type { DataProvenanceProps } from '@/components/ui/data-provenance';
import { useAppStore } from '@/stores/app-store';
import { SnapshotMetrics } from '@/components/portfolio/snapshot-metrics';
import {
  PositionsTable,
  marketValue,
  pnl,
  pnlPct,
  type Position,
  type SortField,
  type SortDir,
} from '@/components/portfolio/positions-table';
import { AllocationChart } from '@/components/portfolio/allocation-chart';
import { OrderHistory } from '@/components/portfolio/order-history';
import { QuickOrder } from '@/components/portfolio/quick-order';
import { RecentOrders } from '@/components/portfolio/recent-orders';
import { markPageVisited } from '@/components/dashboard/setup-progress';
import { TICKER_NAMES, SECTOR_MAP, SECTOR_COLORS } from '@/lib/portfolio-data';
import {
  useAccountQuery,
  usePositionsQuery,
  useQuotesQuery,
  useOrderHistoryQuery,
  useOrderStatusQuery,
  useSubmitOrderMutation,
} from '@/hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { BrokerAccount } from '@/lib/engine-client';

const FALLBACK_ACCOUNT: BrokerAccount = {
  cash: 100_000,
  positions_value: 0,
  equity: 100_000,
  initial_capital: 100_000,
};

export default function PortfolioPage() {
  const engineOnline = useAppStore((s) => s.engineOnline);
  const queryClient = useQueryClient();

  const [sortField, setSortField] = useState<SortField>('marketValue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Order entry state
  const [orderSymbol, setOrderSymbol] = useState('');
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderQty, setOrderQty] = useState('');
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [pollingOrderId, setPollingOrderId] = useState<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    markPageVisited('portfolio');
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // TanStack Query hooks
  const {
    data: account,
    isPending: accountLoading,
    dataUpdatedAt: accountUpdatedAt,
  } = useAccountQuery();
  const { data: brokerPositions } = usePositionsQuery();
  const { data: orderHistory } = useOrderHistoryQuery();
  const submitOrder = useSubmitOrderMutation();

  // Get tickers for live quote enrichment
  const positionTickers = useMemo(
    () => (brokerPositions ?? []).map((p) => p.instrument_id),
    [brokerPositions],
  );
  const { data: positionQuotes } = useQuotesQuery(positionTickers);

  // Order polling
  const { isFetching: isPolling } = useOrderStatusQuery(pollingOrderId, {
    onSettled: () => {
      setPollingOrderId(null);
    },
  });

  const loading = engineOnline === null || (engineOnline === true && accountLoading);

  // Derive data provenance mode from engine + query state
  const provenanceMode: DataProvenanceProps['mode'] = useMemo(() => {
    if (engineOnline === true && account) return 'live';
    if (engineOnline === false && account) return 'cached';
    if (engineOnline === false && !account) return 'simulated';
    return 'offline';
  }, [engineOnline, account]);

  const provenanceLastUpdated = useMemo(
    () => (accountUpdatedAt ? new Date(accountUpdatedAt) : null),
    [accountUpdatedAt],
  );

  // Enrich positions with live prices
  const positions: Position[] = useMemo(() => {
    if (!brokerPositions || brokerPositions.length === 0) return [];
    return brokerPositions.map((bp) => {
      const quote = positionQuotes?.find((q) => q.ticker === bp.instrument_id);
      const currentPrice = bp.current_price ?? quote?.close ?? bp.avg_price;
      const pos: Position = {
        ticker: bp.instrument_id,
        name: TICKER_NAMES[bp.instrument_id] ?? bp.instrument_id,
        shares: bp.quantity,
        avgEntry: bp.avg_price,
        currentPrice,
        sector: SECTOR_MAP[bp.instrument_id] ?? 'Other',
      };
      if (bp.unrealized_pl !== undefined) pos.unrealizedPl = bp.unrealized_pl;
      if (bp.unrealized_plpc !== undefined) pos.unrealizedPlPct = bp.unrealized_plpc;
      return pos;
    });
  }, [brokerPositions, positionQuotes]);

  const recentOrders = orderHistory ?? [];

  const effectiveAccount = account ?? (engineOnline !== true ? FALLBACK_ACCOUNT : null);

  const handleSubmitOrder = useCallback(async () => {
    if (engineOnline !== true) {
      setOrderStatus('Order failed — engine offline');
      return;
    }

    if (!orderSymbol || !orderQty || Number(orderQty) <= 0) return;
    setOrderStatus(null);
    try {
      const result = await submitOrder.mutateAsync({
        symbol: orderSymbol.toUpperCase(),
        side: orderSide,
        qty: Number(orderQty),
      });
      setOrderStatus(
        result.status === 'filled' ? `Filled @ order ${result.order_id}` : `Order ${result.status}`,
      );
      setOrderSymbol('');
      setOrderQty('');

      // Start polling if order isn't already terminal
      if (result.order_id && result.status !== 'filled' && result.status !== 'rejected') {
        setPollingOrderId(result.order_id);
      }
    } catch {
      if (mountedRef.current) setOrderStatus('Order failed — check engine');
    }
  }, [engineOnline, orderSymbol, orderQty, orderSide, submitOrder]);

  const totalValue = positions.reduce((s, p) => s + marketValue(p), 0);
  const totalPnl = positions.reduce((s, p) => s + pnl(p), 0);
  const totalCost = positions.reduce((s, p) => s + p.avgEntry * p.shares, 0);
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const cashBalance = effectiveAccount?.cash ?? 100_000;
  const portfolioTotal =
    (effectiveAccount?.equity ?? cashBalance) > 0
      ? (effectiveAccount?.equity ?? cashBalance + totalValue)
      : cashBalance + totalValue;

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'ticker':
          return a.ticker.localeCompare(b.ticker) * mul;
        case 'marketValue':
          return (marketValue(a) - marketValue(b)) * mul;
        case 'pnl':
          return (pnl(a) - pnl(b)) * mul;
        case 'pnlPct':
          return (pnlPct(a) - pnlPct(b)) * mul;
        default:
          return 0;
      }
    });
  }, [positions, sortField, sortDir]);

  // Sector allocation
  const allocations = useMemo(() => {
    if (positions.length === 0) return [];
    const sectorMap = new Map<string, number>();
    for (const p of positions) {
      sectorMap.set(p.sector, (sectorMap.get(p.sector) ?? 0) + marketValue(p));
    }
    return Array.from(sectorMap.entries())
      .map(([label, val]) => ({
        label,
        pct: (val / totalValue) * 100,
        color: SECTOR_COLORS[label] ?? 'bg-gray-500',
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [positions, totalValue]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-muted-foreground animate-pulse">Connecting to engine...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {engineOnline === false && <OfflineBanner service="engine" />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PieChart className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-heading-page text-foreground">Portfolio</h1>
            <p className="text-xs text-muted-foreground">
              {positions.length} position{positions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <DataProvenance
            mode={provenanceMode}
            lastUpdated={provenanceLastUpdated}
            staleThresholdMs={60_000}
          />
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.account() });
            queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.positions() });
          }}
          disabled={engineOnline !== true}
          className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <SnapshotMetrics
        portfolioTotal={portfolioTotal}
        totalPnl={totalPnl}
        totalPnlPct={totalPnlPct}
        totalCost={totalCost}
        cashBalance={cashBalance}
        positionCount={positions.length}
        totalValue={totalValue}
      />

      <QuickOrder
        symbol={orderSymbol}
        side={orderSide}
        qty={orderQty}
        status={orderStatus}
        submitting={submitOrder.isPending}
        disabled={engineOnline !== true}
        onSymbolChange={setOrderSymbol}
        onSideChange={setOrderSide}
        onQtyChange={setOrderQty}
        onSubmit={handleSubmitOrder}
      />

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Recent Orders
            {isPolling && <span className="ml-1.5 text-amber-400 animate-pulse">polling...</span>}
          </span>
        </div>
        <RecentOrders orders={recentOrders} pollingOrderId={pollingOrderId} />
      </div>

      <Tabs defaultValue="positions" className="space-y-3">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="allocation">Allocation</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
        </TabsList>

        <TabsContent value="positions">
          {positions.length === 0 ? (
            <Card className="bg-muted/30 border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {provenanceMode === 'live' &&
                    'No open positions. Use Quick Order above to place your first trade.'}
                  {provenanceMode === 'cached' &&
                    'Cached data \u2014 no positions found. Reconnect engine for live updates.'}
                  {provenanceMode === 'simulated' &&
                    'Showing simulated portfolio \u2014 connect the engine for live data.'}
                  {provenanceMode === 'offline' && 'No data available \u2014 engine is offline.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <PositionsTable
              sortedPositions={sortedPositions}
              sortField={sortField}
              sortDir={sortDir}
              onToggleSort={toggleSort}
            />
          )}
        </TabsContent>

        <TabsContent value="allocation">
          <AllocationChart
            positions={positions}
            allocations={allocations}
            totalValue={totalValue}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="risk">
          <OrderHistory
            positions={positions}
            portfolioTotal={portfolioTotal}
            totalValue={totalValue}
            totalCost={totalCost}
            totalPnlPct={totalPnlPct}
            allocations={allocations}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
