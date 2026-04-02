'use client';

import { useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Zap,
  Shield,
  Activity,
  Clock,
  Bot,
} from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { AlertFeed } from '@/components/dashboard/alert-feed';
import { PriceTicker } from '@/components/dashboard/price-ticker';
import { IncidentControls } from '@/components/dashboard/incident-controls';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { SetupProgress } from '@/components/dashboard/setup-progress';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { SimulatedBadge } from '@/components/ui/simulated-badge';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { useAppStore } from '@/stores/app-store';
import type { Alert } from '@sentinel/shared';
import { cn } from '@/lib/utils';
import {
  useQuotesQuery,
  useAccountQuery,
  useAlertsQuery,
  useRecommendationsQuery,
  useSystemControlsQuery,
  useAgentStatusQuery,
} from '@/hooks/queries';
import { useOnboardingProfile, useInvalidateOnboarding } from '@/hooks/use-onboarding';

const TICKER_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'SPY'];

const fallbackTickerData = [
  { ticker: 'AAPL', price: 178.72, change: 1.24 },
  { ticker: 'MSFT', price: 378.91, change: 0.82 },
  { ticker: 'GOOGL', price: 141.8, change: -0.56 },
  { ticker: 'AMZN', price: 178.25, change: 1.89 },
  { ticker: 'NVDA', price: 495.22, change: 3.12 },
  { ticker: 'TSLA', price: 248.48, change: -2.15 },
  { ticker: 'META', price: 355.64, change: 0.45 },
  { ticker: 'SPY', price: 456.38, change: 0.62 },
];

export default function DashboardPage() {
  const engineOnline = useAppStore((s) => s.engineOnline);
  const agentsOnline = useAppStore((s) => s.agentsOnline);

  const { data: quotes } = useQuotesQuery(TICKER_SYMBOLS, 30_000);
  const { data: account } = useAccountQuery();
  const { data: agentAlerts } = useAlertsQuery(30_000);
  const { data: filledRecs } = useRecommendationsQuery('filled', 30_000);
  const { data: systemControls } = useSystemControlsQuery();
  const { data: pendingRecs } = useRecommendationsQuery('pending', 30_000);
  const { data: agentStatus } = useAgentStatusQuery();

  const { data: onboardingProfile } = useOnboardingProfile();
  const invalidateOnboarding = useInvalidateOnboarding();

  const isLive = engineOnline === true && !!quotes;

  const tickerData = useMemo(() => {
    if (!quotes) return fallbackTickerData;
    return TICKER_SYMBOLS.map((sym) => {
      const q = quotes.find((q) => q.ticker === sym);
      return {
        ticker: sym,
        price: q?.close ?? 0,
        change: q?.change_pct ?? 0,
      };
    }).filter((t) => t.price > 0);
  }, [quotes]);

  const alerts: Alert[] = useMemo(() => {
    if (!agentAlerts || agentAlerts.length === 0) return [];
    return agentAlerts.map((a) => ({
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
    }));
  }, [agentAlerts]);

  const recentSignals = useMemo(() => {
    if (!filledRecs) return [];
    return filledRecs.slice(0, 5).map((r) => ({
      ticker: r.ticker,
      side: r.side,
      reason: r.reason ?? '',
      strength: r.signal_strength ?? null,
      ts: r.created_at,
    }));
  }, [filledRecs]);

  const equity = account?.equity ?? 100_000;
  const pnl = equity - (account?.initial_capital ?? 100_000);
  const pnlPct = account?.initial_capital ? (pnl / account.initial_capital) * 100 : 0;

  return (
    <div className="space-y-4 p-4 page-enter">
      <h1 className="text-heading-page">Dashboard</h1>

      {engineOnline === false && <OfflineBanner service="engine" />}
      {agentsOnline === false && <OfflineBanner service="agents" />}

      {/* System Health Strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm sm:px-4">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          {systemControls?.trading_halted ? (
            <span className="font-medium text-loss">Halted</span>
          ) : (
            <span className="font-medium text-profit">Active</span>
          )}
        </div>
        <span className="hidden sm:inline text-border">|</span>
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase">
            {systemControls?.global_mode ?? 'paper'}
          </span>
        </div>
        <span className="hidden sm:inline text-border">|</span>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Pending:</span>
          <span
            className={cn(
              'font-medium',
              (pendingRecs?.length ?? 0) > 0 ? 'text-amber-500' : 'text-muted-foreground',
            )}
          >
            {pendingRecs?.length ?? 0}
          </span>
        </div>
        <span className="hidden sm:inline text-border">|</span>
        <div className="flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          <span
            className={cn(
              'font-medium',
              agentStatus?.halted
                ? 'text-loss'
                : agentStatus?.isRunning
                  ? 'text-profit'
                  : 'text-muted-foreground',
            )}
          >
            {agentStatus?.halted ? 'Halted' : agentStatus?.isRunning ? 'Running' : 'Idle'}
          </span>
          {agentStatus?.cycleCount != null && (
            <span className="text-xs text-muted-foreground">#{agentStatus.cycleCount}</span>
          )}
        </div>
      </div>

      {/* Incident Controls */}
      <IncidentControls />

      {/* Row 1: Metric Cards */}
      <div className="@container">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 stagger-grid">
          <MetricCard
            label={
              <>
                Total Equity{' '}
                <InfoTooltip content="Total value of all assets including cash and open positions." />
              </>
            }
            value={<AnimatedNumber value={equity} prefix="$" decimals={2} />}
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          />
          <MetricCard
            label={
              <>
                Daily P&L{' '}
                <InfoTooltip content="Today's profit or loss across all positions, updated in real-time during market hours." />
              </>
            }
            value={
              <AnimatedNumber value={Math.abs(pnl)} prefix={pnl >= 0 ? '+$' : '-$'} decimals={2} />
            }
            change={pnlPct}
            icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          />
          <MetricCard
            label={
              <>
                Cash Available <InfoTooltip content="Uninvested cash available for new trades." />
              </>
            }
            value={<AnimatedNumber value={account?.cash ?? 100_000} prefix="$" decimals={2} />}
            icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
          />
          <MetricCard
            label="Positions Value"
            value={<AnimatedNumber value={account?.positions_value ?? 0} prefix="$" decimals={2} />}
            icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* Row 2: Price Ticker */}
      <div className="relative">
        <PriceTicker items={tickerData} />
        <span className="absolute -top-1.5 right-2">
          {isLive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-profit/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-profit uppercase">
              <span className="h-1 w-1 rounded-full bg-profit animate-pulse" />
              Live
            </span>
          ) : (
            <SimulatedBadge />
          )}
        </span>
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
              <EmptyState
                icon={Zap}
                title="No Recent Signals"
                description="Strategies generate signals during market hours."
                className="border-0 bg-transparent py-6"
              />
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
                          s.side === 'buy' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss',
                        )}
                      >
                        {s.side.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{s.ticker}</span>
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

      {/* Setup Progress */}
      <SetupProgress />

      {/* Onboarding Wizard (shows for new users) */}
      {onboardingProfile && (
        <OnboardingWizard
          onboardingStep={onboardingProfile.onboarding_step}
          onComplete={invalidateOnboarding}
        />
      )}
    </div>
  );
}
