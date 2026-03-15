'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  DollarSign,
  Percent,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  SendHorizonal,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { BrokerAccount, BrokerPosition, MarketQuote } from '@/lib/engine-client';

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000';

// ── Types ───────────────────────────────────────────────────────────

interface Position {
  ticker: string;
  name: string;
  shares: number;
  avgEntry: number;
  currentPrice: number;
  sector: string;
  unrealizedPl?: number;
  unrealizedPlPct?: number;
}

const TICKER_NAMES: Record<string, string> = {
  AAPL: 'Apple Inc.', MSFT: 'Microsoft Corp.', GOOGL: 'Alphabet Inc.',
  AMZN: 'Amazon.com Inc.', NVDA: 'NVIDIA Corp.', TSLA: 'Tesla Inc.',
  META: 'Meta Platforms', JPM: 'JPMorgan Chase', V: 'Visa Inc.',
  SPY: 'SPDR S&P 500', QQQ: 'Invesco QQQ', AMD: 'AMD Inc.',
  NFLX: 'Netflix Inc.', DIS: 'Walt Disney', BA: 'Boeing Co.',
};

const SECTOR_MAP: Record<string, string> = {
  AAPL: 'Technology', MSFT: 'Technology', GOOGL: 'Technology',
  NVDA: 'Technology', META: 'Technology', AMD: 'Technology', NFLX: 'Technology',
  AMZN: 'Consumer', TSLA: 'Consumer', DIS: 'Consumer',
  JPM: 'Financials', V: 'Financials',
  SPY: 'Index', QQQ: 'Index',
  BA: 'Industrials',
};

const sectorColors: Record<string, string> = {
  Technology: 'bg-blue-500',
  Financials: 'bg-amber-500',
  Consumer: 'bg-emerald-500',
  Index: 'bg-violet-500',
  Healthcare: 'bg-rose-500',
  Energy: 'bg-orange-500',
  Industrials: 'bg-cyan-500',
};

const sectorBadges: Record<string, string> = {
  Technology: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Financials: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Consumer: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Index: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  Healthcare: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  Energy: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Industrials: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
};

type SortField = 'ticker' | 'marketValue' | 'pnl' | 'pnlPct';
type SortDir = 'asc' | 'desc';

function pnl(p: Position) {
  return (p.currentPrice - p.avgEntry) * p.shares;
}

function pnlPct(p: Position) {
  if (p.avgEntry === 0) return 0;
  return ((p.currentPrice - p.avgEntry) / p.avgEntry) * 100;
}

function marketValue(p: Position) {
  return p.currentPrice * p.shares;
}

// ── Simple SVG donut chart ──────────────────────────────────────────

function AllocationDonut({ allocations }: { allocations: { label: string; pct: number; color: string }[] }) {
  const radius = 60;
  const stroke = 18;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
        {allocations.map((a) => {
          const dashLen = (a.pct / 100) * circumference;
          const dashOffset = -offset;
          offset += dashLen;
          return (
            <circle
              key={a.label}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={dashOffset}
              className={a.color.replace('bg-', 'text-')}
              transform="rotate(-90 80 80)"
            />
          );
        })}
        <text x="80" y="76" textAnchor="middle" className="fill-foreground text-lg font-bold" fontSize="18">
          {allocations.length}
        </text>
        <text x="80" y="94" textAnchor="middle" className="fill-muted-foreground" fontSize="11">
          sectors
        </text>
      </svg>
      <div className="space-y-2">
        {allocations.map((a) => (
          <div key={a.label} className="flex items-center gap-2">
            <div className={cn('h-2.5 w-2.5 rounded-full', a.color)} />
            <span className="text-xs text-muted-foreground w-24">{a.label}</span>
            <span className="text-xs font-mono font-medium text-foreground">{a.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Risk gauge ──────────────────────────────────────────────────────

function RiskGauge({ level, label }: { level: number; label: string }) {
  const pct = Math.min(Math.max(level, 0), 100);
  const color = pct < 30 ? 'bg-profit' : pct < 60 ? 'bg-amber-500' : 'bg-loss';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-mono text-foreground">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────

export default function PortfolioPage() {
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
        fetch(`${ENGINE_URL}/api/v1/portfolio/account`, { signal: AbortSignal.timeout(6000) }),
        fetch(`${ENGINE_URL}/api/v1/portfolio/positions`, { signal: AbortSignal.timeout(6000) }),
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
            `${ENGINE_URL}/api/v1/data/quotes?tickers=${tickers.join(',')}`,
            { signal: AbortSignal.timeout(8000) },
          );
          if (quotesRes.ok) quotes = await quotesRes.json();
        } catch {
          // Live prices unavailable — use avg_price as fallback
        }

        setPositions(
          brokerPositions.map((bp) => {
            const quote = quotes.find((q) => q.ticker === bp.instrument_id);
            const currentPrice = bp.current_price ?? quote?.close ?? bp.avg_price;
            return {
              ticker: bp.instrument_id,
              name: TICKER_NAMES[bp.instrument_id] ?? bp.instrument_id,
              shares: bp.quantity,
              avgEntry: bp.avg_price,
              currentPrice,
              sector: SECTOR_MAP[bp.instrument_id] ?? 'Other',
              unrealizedPl: bp.unrealized_pl,
              unrealizedPlPct: bp.unrealized_plpc,
            };
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
      const res = await fetch(`${ENGINE_URL}/api/v1/portfolio/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          try {
            const ordersRes = await fetch(
              `${ENGINE_URL}/api/v1/portfolio/orders?status=open`,
              { signal: AbortSignal.timeout(5000) },
            );
            if (ordersRes.ok) {
              const orders = await ordersRes.json() as Array<{ order_id: string }>;
              const isStillOpen = orders.some((o) => o.order_id === orderId);
              if (!isStillOpen || polls >= MAX_POLLS) {
                await fetchPortfolio();
                return;
              }
            }
          } catch { /* ignore */ }
          polls++;
          setTimeout(poll, POLL_INTERVAL);
        };
        setTimeout(poll, POLL_INTERVAL);
      } else {
        setTimeout(() => fetchPortfolio(), 500);
      }
    } catch {
      setOrderStatus('Order failed — check engine');
    } finally {
      setSubmitting(false);
    }
  };

  const totalValue = positions.reduce((s, p) => s + marketValue(p), 0);
  const totalPnl = positions.reduce((s, p) => s + pnl(p), 0);
  const totalCost = positions.reduce((s, p) => s + p.avgEntry * p.shares, 0);
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const cashBalance = account?.cash ?? 100_000;
  const portfolioTotal = (account?.equity ?? cashBalance) > 0 ? (account?.equity ?? cashBalance + totalValue) : cashBalance + totalValue;

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
        color: sectorColors[label] ?? 'bg-gray-500',
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [positions, totalValue]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-muted-foreground animate-pulse">
          Connecting to engine...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
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

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Portfolio Value</span>
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">
              ${portfolioTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Unrealized P&L</span>
              {totalPnl >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-profit" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-loss" />
              )}
            </div>
            <p className={cn('mt-1 text-xl font-bold', totalPnl >= 0 ? 'text-profit' : 'text-loss')}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {totalCost > 0 && (
              <p className={cn('text-xs', totalPnl >= 0 ? 'text-profit' : 'text-loss')}>
                {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Cash Balance</span>
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">
              ${cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Positions</span>
              <Percent className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">{positions.length}</p>
            <p className="text-xs text-muted-foreground">
              {portfolioTotal > 0 ? ((totalValue / portfolioTotal) * 100).toFixed(1) : '0.0'}% invested
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Order Entry */}
      <Card className="bg-card border-border">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Quick Order
            </span>
            <div className="flex items-center gap-1.5 rounded-md bg-muted/50 p-0.5">
              <button
                onClick={() => setOrderSide('buy')}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  orderSide === 'buy'
                    ? 'bg-profit/20 text-profit'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Buy
              </button>
              <button
                onClick={() => setOrderSide('sell')}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  orderSide === 'sell'
                    ? 'bg-loss/20 text-loss'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Sell
              </button>
            </div>
            <input
              type="text"
              value={orderSymbol}
              onChange={(e) => setOrderSymbol(e.target.value.toUpperCase())}
              placeholder="Symbol"
              className="w-24 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="number"
              value={orderQty}
              onChange={(e) => setOrderQty(e.target.value)}
              placeholder="Qty"
              min="1"
              className="w-20 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleSubmitOrder}
              disabled={submitting || !orderSymbol || !orderQty}
              className="flex items-center gap-1.5 rounded-md bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 transition-colors disabled:opacity-40"
            >
              <SendHorizonal className="h-3.5 w-3.5" />
              {submitting ? 'Sending...' : 'Submit'}
            </button>
            {orderStatus && (
              <span className={cn(
                'text-xs font-mono',
                orderStatus.startsWith('Filled') ? 'text-profit' : 'text-loss',
              )}>
                {orderStatus}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="positions" className="space-y-3">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="allocation">Allocation</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
        </TabsList>

        {/* ── Positions Tab ────────────────────────────────────────── */}
        <TabsContent value="positions">
          <Card className="bg-card border-border overflow-hidden">
            <CardContent className="p-0">
              {positions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <PieChart className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No open positions</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Use the Quick Order panel above to place your first trade
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {([
                          ['ticker', 'Ticker'],
                          ['marketValue', 'Market Value'],
                          ['pnl', 'P&L'],
                          ['pnlPct', 'P&L %'],
                        ] as [SortField, string][]).map(([field, label]) => (
                          <th key={field} className="px-4 py-2.5 text-left">
                            <button
                              onClick={() => toggleSort(field)}
                              className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {label}
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                          </th>
                        ))}
                        <th className="px-4 py-2.5 text-left">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Shares
                          </span>
                        </th>
                        <th className="px-4 py-2.5 text-left">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Avg Entry
                          </span>
                        </th>
                        <th className="px-4 py-2.5 text-left">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Current
                          </span>
                        </th>
                        <th className="px-4 py-2.5 text-left">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Sector
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {sortedPositions.map((p) => {
                        const pl = pnl(p);
                        const plPct = pnlPct(p);
                        return (
                          <tr key={p.ticker} className="transition-colors hover:bg-accent/30">
                            <td className="px-4 py-3">
                              <div>
                                <span className="text-sm font-semibold text-foreground">{p.ticker}</span>
                                <p className="text-[11px] text-muted-foreground">{p.name}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-mono text-foreground">
                                ${marketValue(p).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn('text-sm font-mono', pl >= 0 ? 'text-profit' : 'text-loss')}>
                                {pl >= 0 ? '+' : ''}${pl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                className={cn(
                                  'border text-[10px] font-semibold font-mono',
                                  plPct >= 0
                                    ? 'bg-profit/15 text-profit border-profit/30'
                                    : 'bg-loss/15 text-loss border-loss/30',
                                )}
                              >
                                {plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-mono text-muted-foreground">{p.shares}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-mono text-muted-foreground">${p.avgEntry.toFixed(2)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-mono text-foreground">${p.currentPrice.toFixed(2)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={cn('border text-[10px]', sectorBadges[p.sector] ?? 'bg-muted text-muted-foreground border-border')}>
                                {p.sector}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Allocation Tab ───────────────────────────────────────── */}
        <TabsContent value="allocation">
          {positions.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <PieChart className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No positions to analyze</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Sector Allocation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AllocationDonut allocations={allocations} />
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Top Holdings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[...positions]
                    .sort((a, b) => marketValue(b) - marketValue(a))
                    .slice(0, 5)
                    .map((p) => {
                      const pct = (marketValue(p) / totalValue) * 100;
                      return (
                        <div key={p.ticker} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">{p.ticker}</span>
                            <span className="text-xs font-mono text-muted-foreground">{pct.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Risk Tab ─────────────────────────────────────────────── */}
        <TabsContent value="risk">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-profit" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Risk Metrics
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <RiskGauge
                  level={portfolioTotal > 0 ? (totalValue / portfolioTotal) * 100 : 0}
                  label="Portfolio Utilization"
                />
                <RiskGauge
                  level={totalCost > 0 ? Math.abs(totalPnlPct) : 0}
                  label="Drawdown Exposure"
                />
                <RiskGauge
                  level={positions.length > 0
                    ? (Math.max(...positions.map(marketValue)) / totalValue) * 100
                    : 0}
                  label="Concentration (Largest Position)"
                />
                <RiskGauge
                  level={allocations.length > 0 ? allocations[0]?.pct ?? 0 : 0}
                  label="Sector Tilt (Largest Sector)"
                />
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Risk Limits
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-border/50 overflow-hidden">
                  <div className="bg-muted/30 px-3 py-1.5">
                    <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                      Current Configuration
                    </p>
                  </div>
                  <div className="divide-y divide-border/50">
                    {[
                      ['Max Position Size', '5%'],
                      ['Max Sector Exposure', '20%'],
                      ['Daily Loss Limit', '2%'],
                      ['Soft Drawdown Halt', '10%'],
                      ['Hard Drawdown Halt', '15%'],
                      ['Max Open Positions', '20'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="text-xs font-mono font-medium text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
