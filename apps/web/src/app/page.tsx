'use client';

import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, BarChart3, AlertTriangle, Zap } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { AlertFeed } from '@/components/dashboard/alert-feed';
import { PriceTicker } from '@/components/dashboard/price-ticker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Alert } from '@sentinel/shared';
import type { MarketQuote, BrokerAccount } from '@/lib/engine-client';
import type { AgentAlert } from '@/lib/agents-client';
import { cn } from '@/lib/utils';

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000';
const AGENTS_URL = process.env.NEXT_PUBLIC_AGENTS_URL ?? 'http://localhost:3001';

const TICKER_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'SPY'];

const fallbackTickerData = [
  { ticker: 'AAPL', price: 178.72, change: 1.24 },
  { ticker: 'MSFT', price: 378.91, change: 0.82 },
  { ticker: 'GOOGL', price: 141.80, change: -0.56 },
  { ticker: 'AMZN', price: 178.25, change: 1.89 },
  { ticker: 'NVDA', price: 495.22, change: 3.12 },
  { ticker: 'TSLA', price: 248.48, change: -2.15 },
  { ticker: 'META', price: 355.64, change: 0.45 },
  { ticker: 'SPY', price: 456.38, change: 0.62 },
];

const sampleAlerts: Alert[] = [
  {
    id: '1',
    account_id: null,
    instrument_id: null,
    severity: 'info',
    status: 'active',
    title: 'System Online',
    message: 'Sentinel trading engine connected and operational.',
    metadata: null,
    triggered_at: new Date().toISOString(),
    acknowledged_at: null,
    resolved_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    account_id: null,
    instrument_id: 'nvda',
    severity: 'warning',
    status: 'active',
    title: 'High Volatility Detected',
    message: 'NVDA showing unusual volume and price movement.',
    metadata: null,
    triggered_at: new Date(Date.now() - 300000).toISOString(),
    acknowledged_at: null,
    resolved_at: null,
    created_at: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: '3',
    account_id: null,
    instrument_id: null,
    severity: 'critical',
    status: 'active',
    title: 'Risk Limit Approaching',
    message: 'Portfolio drawdown nearing configured threshold.',
    metadata: null,
    triggered_at: new Date(Date.now() - 600000).toISOString(),
    acknowledged_at: null,
    resolved_at: null,
    created_at: new Date(Date.now() - 600000).toISOString(),
  },
];

export default function DashboardPage() {
  const [tickerData, setTickerData] = useState(fallbackTickerData);
  const [isLive, setIsLive] = useState(false);
  const [account, setAccount] = useState<BrokerAccount | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>(sampleAlerts);
  const [recentSignals, setRecentSignals] = useState<Array<{
    ticker: string;
    side: string;
    reason: string;
    strength: number | null;
    ts: string;
  }>>([]);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(
        `${ENGINE_URL}/api/v1/data/quotes?tickers=${TICKER_SYMBOLS.join(',')}`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const quotes: MarketQuote[] = await res.json();

      setTickerData(
        TICKER_SYMBOLS.map((sym) => {
          const q = quotes.find((q) => q.ticker === sym);
          return {
            ticker: sym,
            price: q?.close ?? 0,
            change: q?.change_pct ?? 0,
          };
        }).filter((t) => t.price > 0),
      );
      setIsLive(true);
    } catch {
      // Keep fallback data
    }
  }, []);

  const fetchAccount = useCallback(async () => {
    try {
      const res = await fetch(`${ENGINE_URL}/api/v1/portfolio/account`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setAccount(await res.json());
    } catch {
      // Keep default values
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const [alertsRes, recsRes] = await Promise.allSettled([
        fetch(`${AGENTS_URL}/alerts`, { signal: AbortSignal.timeout(3000) }),
        fetch(`${AGENTS_URL}/recommendations?status=filled`, { signal: AbortSignal.timeout(3000) }),
      ]);

      if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
        const data = await alertsRes.value.json() as { alerts: AgentAlert[] };
        if (data.alerts.length > 0) {
          setAlerts(data.alerts.map((a) => ({
            id: a.id,
            account_id: null,
            instrument_id: a.ticker ?? null,
            severity: a.severity,
            status: 'active' as const,
            title: a.title,
            message: a.message,
            metadata: null,
            triggered_at: a.created_at,
            acknowledged_at: null,
            resolved_at: null,
            created_at: a.created_at,
          })));
        }
      }

      if (recsRes.status === 'fulfilled' && recsRes.value.ok) {
        const data = await recsRes.value.json() as {
          recommendations: Array<{
            ticker: string;
            side: string;
            reason?: string;
            signal_strength?: number | null;
            created_at: string;
          }>;
        };
        setRecentSignals(
          data.recommendations.slice(0, 5).map((r) => ({
            ticker: r.ticker,
            side: r.side,
            reason: r.reason ?? '',
            strength: r.signal_strength ?? null,
            ts: r.created_at,
          })),
        );
      }
    } catch {
      // Agents offline — keep sampleAlerts
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    fetchAccount();
    fetchAlerts();
  }, [fetchPrices, fetchAccount, fetchAlerts]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPrices();
      fetchAccount();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchPrices, fetchAccount]);

  const equity = account?.equity ?? 100_000;
  const pnl = equity - (account?.initial_capital ?? 100_000);
  const pnlPct = account?.initial_capital ? (pnl / account.initial_capital) * 100 : 0;

  return (
    <div className="space-y-4 p-4">
      {/* Row 1: Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-grid">
        <MetricCard
          label="Total Equity"
          value={`$${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          label="Daily P&L"
          value={`${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change={pnlPct}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          label="Cash Available"
          value={`$${(account?.cash ?? 100_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          label="Positions Value"
          value={`$${(account?.positions_value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Row 2: Price Ticker */}
      <div className="relative">
        <PriceTicker items={tickerData} />
        {isLive && (
          <span className="absolute -top-1.5 right-2 inline-flex items-center gap-1 rounded-full bg-profit/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-profit uppercase">
            <span className="h-1 w-1 rounded-full bg-profit animate-pulse" />
            Live
          </span>
        )}
      </div>

      {/* Row 3: Two columns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Active Signals */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Signals
            </CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {recentSignals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No recent signals. Strategies generate signals during market hours.
              </p>
            ) : (
              <div className="space-y-2">
                {recentSignals.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded',
                          s.side === 'buy'
                            ? 'bg-profit/15 text-profit'
                            : 'bg-loss/15 text-loss',
                        )}
                      >
                        {s.side.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {s.ticker}
                      </span>
                    </div>
                    {s.strength != null && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {(s.strength * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alert Feed */}
        <AlertFeed alerts={alerts} />
      </div>
    </div>
  );
}
