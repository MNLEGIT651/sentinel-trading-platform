'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PieChart, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { useAppStore } from '@/stores/app-store';
import { cn } from '@/lib/utils';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';
import type { BrokerAccount, BrokerPosition, MarketQuote } from '@/lib/engine-client';
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
import { TICKER_NAMES, SECTOR_MAP, SECTOR_COLORS } from '@/lib/portfolio-data';

export default function PortfolioPage() {
  const engineOnline = useAppStore((s) => s.engineOnline);
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [sortField, setSortField] = useState<SortField>('marketValue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [positions, setPositions] = useState<Position[]>([]);
  const [account, setAccount] = useState<BrokerAccount | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Order entry state
  const [orderSymbol, setOrderSymbol] = useState('');
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderQty, setOrderQty] = useState('');
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchPortfolio = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [acctRes, posRes] = await Promise.all([
        fetch(engineUrl('/api/v1/portfolio/account'), {
          signal: AbortSignal.timeout(6000),
          headers: engineHeaders(),
        }),
        fetch(engineUrl('/api/v1/portfolio/positions'), {
          signal: AbortSignal.timeout(6000),
          headers: engineHeaders(),
        }),
      ]);
      if (!acctRes.ok || !posRes.ok) throw new Error('Engine error');

      const acct: BrokerAccount = await acctRes.json();
      const brokerPositions: BrokerPosition[] = await posRes.json();
      setAccount(acct);

      // Enrich positions with live prices if we have positions
      if (brokerPositions.length > 0) {
        const tickers = brokerPositions.map((p) => p.instrument_id);
        let quotes: MarketQuote[] = [];
        try {
          const quotesRes = await fetch(
            engineUrl(`/api/v1/data/quotes?tickers=${tickers.join(',')}`),
            { signal: AbortSignal.timeout(8000), headers: engineHeaders() },
          );
          if (quotesRes.ok) quotes = await quotesRes.json();
        } catch {
          // Live prices unavailable — use avg_price as fallback
        }

        setPositions(
          brokerPositions.map((bp) => {
            const quote = quotes.find((q) => q.ticker === bp.instrument_id);
            const currentPrice = bp.current_price ?? quote?.close ?? bp.avg_price;
            const pos: import('@/components/portfolio/positions-table').Position = {
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
          }),
        );
      } else {
        setPositions([]);
      }
      setIsLive(true);
    } catch {
      // Engine offline — show empty portfolio
      setAccount({ cash: 100_000, positions_value: 0, equity: 100_000, initial_capital: 100_000 });
      setPositions([]);
      setIsLive(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchPortfolio(), 30_000);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  const handleSubmitOrder = async () => {
    if (!orderSymbol || !orderQty || Number(orderQty) <= 0) return;
    setSubmitting(true);
    setOrderStatus(null);
    try {
      const res = await fetch(engineUrl('/api/v1/portfolio/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...engineHeaders() },
        body: JSON.stringify({
          symbol: orderSymbol.toUpperCase(),
          side: orderSide,
          quantity: Number(orderQty),
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const result = await res.json();
      setOrderStatus(
        result.status === 'filled'
          ? `Filled ${result.fill_quantity} @ $${result.fill_price?.toFixed(2)}`
          : `Order ${result.status}`,
      );
      setOrderSymbol('');
      setOrderQty('');
      // Poll for order fill — Alpaca paper fills asynchronously
      const orderId = (result as { order_id?: string }).order_id;
      if (orderId) {
        const POLL_INTERVAL = 2000;
        const MAX_POLLS = 10;
        let polls = 0;
        const poll = async () => {
          if (!mountedRef.current) return;
          try {
            const ordersRes = await fetch(engineUrl('/api/v1/portfolio/orders?status=open'), {
              signal: AbortSignal.timeout(5000),
              headers: engineHeaders(),
            });
            if (ordersRes.ok) {
              const orders = (await ordersRes.json()) as Array<{ order_id: string }>;
              const isStillOpen = orders.some((o) => o.order_id === orderId);
              if (!isStillOpen || polls >= MAX_POLLS) {
                await fetchPortfolio();
                return;
              }
            }
          } catch {
            /* ignore */
          }
          polls++;
          setTimeout(poll, POLL_INTERVAL);
        };
        setTimeout(poll, POLL_INTERVAL);
      } else {
        setTimeout(() => fetchPortfolio(), 500);
      }
    } catch {
      if (mountedRef.current) setOrderStatus('Order failed — check engine');
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const totalValue = positions.reduce((s, p) => s + marketValue(p), 0);
  const totalPnl = positions.reduce((s, p) => s + pnl(p), 0);
  const totalCost = positions.reduce((s, p) => s + p.avgEntry * p.shares, 0);
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const cashBalance = account?.cash ?? 100_000;
  const portfolioTotal =
    (account?.equity ?? cashBalance) > 0
      ? (account?.equity ?? cashBalance + totalValue)
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
      {!engineOnline && <OfflineBanner service="engine" />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PieChart className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Portfolio</h1>
            <p className="text-xs text-muted-foreground">
              {positions.length} position{positions.length !== 1 ? 's' : ''} &middot;{' '}
              <span className={isLive ? 'text-profit' : 'text-muted-foreground'}>
                {isLive ? 'Live' : 'Offline'}
              </span>
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchPortfolio(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
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
        submitting={submitting}
        disabled={!engineOnline}
        onSymbolChange={setOrderSymbol}
        onSideChange={setOrderSide}
        onQtyChange={setOrderQty}
        onSubmit={handleSubmitOrder}
      />

      <Tabs defaultValue="positions" className="space-y-3">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="allocation">Allocation</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
        </TabsList>

        <TabsContent value="positions">
          <PositionsTable
            sortedPositions={sortedPositions}
            sortField={sortField}
            sortDir={sortDir}
            onToggleSort={toggleSort}
          />
        </TabsContent>

        <TabsContent value="allocation">
          <AllocationChart
            positions={positions}
            allocations={allocations}
            totalValue={totalValue}
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
