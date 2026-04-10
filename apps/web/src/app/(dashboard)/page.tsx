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
  Radar,
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
import { ErrorBoundary } from '@/components/error-boundary';
import { OfflineBanner } from '@/components/ui/offline-banner';
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
import { TICKER_SYMBOLS, POLL_INTERVAL, MAX_LIVE_SCAN_TICKERS } from '@/lib/constants';
import { sideColors, getSignalStrengthColor, getStatusColors } from '@/lib/status-colors';

function DashboardContent() {
  const engineOnline = useAppStore((s) => s.engineOnline);
  const agentsOnline = useAppStore((s) => s.agentsOnline);

  const { data: quotes } = useQuotesQuery(TICKER_SYMBOLS, POLL_INTERVAL);
  const { data: account } = useAccountQuery();
  const { data: agentAlerts } = useAlertsQuery(POLL_INTERVAL);
  const { data: filledRecs } = useRecommendationsQuery('filled', POLL_INTERVAL);
  const { data: systemControls } = useSystemControlsQuery();
  const { data: pendingRecs } = useRecommendationsQuery('pending', POLL_INTERVAL);
  const { data: agentStatus } = useAgentStatusQuery();

  const { data: onboardingProfile } = useOnboardingProfile();
  const invalidateOnboarding = useInvalidateOnboarding();

  const isLive = engineOnline === true && !!quotes;

  const tickerData = useMemo(() => {
    if (!quotes) return [];
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
    return filledRecs.slice(0, MAX_LIVE_SCAN_TICKERS).map((r) => ({
      ticker: r.ticker,
      side: r.side,
      reason: r.reason ?? '',
      strength: r.signal_strength ?? null,
      ts: r.created_at,
    }));
  }, [filledRecs]);

  const equity = account?.equity ?? 0;
  const pnl = account ? equity - account.initial_capital : 0;
  const pnlPct = account?.initial_capital ? (pnl / account.initial_capital) * 100 : 0;

  const tradingColors = getStatusColors(systemControls?.trading_halted ? 'error' : 'success');
  const pendingColors = getStatusColors('warning');
  const agentColors = getStatusColors(
    agentStatus?.halted ? 'error' : agentStatus?.isRunning ? 'success' : 'neutral',
  );

  return (
    <div className="space-y-4 p-3 sm:p-4 xl:p-6 page-enter" aria-label="Trading dashboard">
      <h1 className="text-heading-page">Dashboard</h1>

      {engineOnline === false && <OfflineBanner service="engine" />}
      {agentsOnline === false && <OfflineBanner service="agents" />}

      <section
        aria-label="System health status"
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm sm:px-4"
      >
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" aria-hidden="true" />
          <span className={cn('font-medium', tradingColors.text)}>
            {systemControls?.trading_halted ? 'Halted' : 'Active'}
          </span>
        </div>
        <span className="hidden text-border sm:inline" aria-hidden="true">
          |
        </span>
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase">
            {systemControls?.global_mode ?? 'paper'}
          </span>
        </div>
        <span className="hidden text-border sm:inline" aria-hidden="true">
          |
        </span>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Pending:</span>
          <span
            className={cn(
              'font-medium',
              (pendingRecs?.length ?? 0) > 0 ? pendingColors.text : 'text-muted-foreground',
            )}
          >
            {pendingRecs?.length ?? 0}
          </span>
        </div>
        <span className="hidden text-border sm:inline" aria-hidden="true">
          |
        </span>
        <div className="flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className={cn('font-medium', agentColors.text)}>
            {agentStatus?.halted ? 'Halted' : agentStatus?.isRunning ? 'Running' : 'Idle'}
          </span>
          {agentStatus?.cycleCount != null && (
            <span className="text-xs text-muted-foreground">#{agentStatus.cycleCount}</span>
          )}
        </div>
      </section>

      <section
        aria-label="Trading workspace"
        className="grid gap-4 xl:grid-cols-[1.15fr,1.7fr,1.15fr]"
      >
        <div className="space-y-4">
          <section aria-label="Market prices">
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-heading-card">Watchlist</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <PriceTicker items={tickerData} />
                <div className="mt-2 flex justify-end">
                  {isLive ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-profit/30 bg-profit/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-profit"
                      aria-label="Live market data"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-profit" aria-hidden="true" />
                      Live
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400"
                      aria-label={engineOnline === false ? 'Engine offline' : 'Paper trading mode'}
                    >
                      {engineOnline === false ? 'Offline' : 'Paper'}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          <section aria-label="Signals and alerts">
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-heading-card">Active Signals</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
                  <div className="space-y-2" role="list" aria-label="Recent trading signals">
                    {recentSignals.map((s) => (
                      <article
                        key={`${s.ticker}-${s.side}-${s.strength ?? 'na'}`}
                        className="grid grid-cols-[auto,1fr,auto] items-center gap-2 border-b border-border/50 py-1.5 last:border-0"
                        role="listitem"
                      >
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-bold',
                            sideColors[s.side] ?? sideColors.buy,
                          )}
                        >
                          {s.side.toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{s.ticker}</span>
                        {s.strength != null && (
                          <span
                            className={cn(
                              'rounded border px-1.5 py-0.5 font-mono text-xs',
                              getSignalStrengthColor(s.strength),
                            )}
                          >
                            {(s.strength * 100).toFixed(0)}%
                          </span>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        <div className="space-y-4">
          <MetricCard
            emphasis="hero"
            label={
              <>
                Total Equity{' '}
                <InfoTooltip content="Total value of all assets including cash and open positions." />
              </>
            }
            value={<AnimatedNumber value={equity} prefix="$" decimals={2} />}
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          />

          <IncidentControls />

          <section aria-label="Portfolio metrics">
            <div className="@container">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MetricCard
                  label={
                    <>
                      Daily P&L{' '}
                      <InfoTooltip content="Today's profit or loss across all positions, updated in real-time during market hours." />
                    </>
                  }
                  value={
                    <AnimatedNumber
                      value={Math.abs(pnl)}
                      prefix={pnl >= 0 ? '+$' : '-$'}
                      decimals={2}
                    />
                  }
                  change={pnlPct}
                  icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                />
                <MetricCard
                  label={
                    <>
                      Cash Available{' '}
                      <InfoTooltip content="Uninvested cash available for new trades." />
                    </>
                  }
                  value={<AnimatedNumber value={account?.cash ?? 0} prefix="$" decimals={2} />}
                  icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
                />
                <MetricCard
                  label="Positions Value"
                  value={
                    <AnimatedNumber value={account?.positions_value ?? 0} prefix="$" decimals={2} />
                  }
                  icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
                />
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-heading-card">Execution Context</CardTitle>
              <Radar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Market data</span>
                <span className="font-medium text-foreground">
                  {isLive ? 'Live feed' : 'Unavailable'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Trade mode</span>
                <span className="font-medium uppercase text-foreground">
                  {systemControls?.global_mode ?? 'paper'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Pending approvals</span>
                <span className="font-mono tabular-nums text-foreground">
                  {pendingRecs?.length ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Agent loop</span>
                <span className="font-medium text-foreground">
                  {agentStatus?.halted ? 'Halted' : agentStatus?.isRunning ? 'Running' : 'Idle'}
                </span>
              </div>
            </CardContent>
          </Card>

          <AlertFeed alerts={alerts} />
        </div>
      </section>

      <SetupProgress />

      {onboardingProfile && (
        <OnboardingWizard
          onboardingStep={onboardingProfile.onboarding_step}
          onComplete={invalidateOnboarding}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
}
