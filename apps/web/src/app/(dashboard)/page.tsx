'use client';

import { useMemo } from 'react';
import {
  DollarSign,
  BarChart3,
  AlertTriangle,
  Zap,
  Shield,
  Activity,
  Clock,
  Bot,
  Waves,
  ListChecks,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
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
import { SimulatedBadge } from '@/components/ui/simulated-badge';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Button } from '@/components/ui/button';
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
import {
  TICKER_SYMBOLS,
  FALLBACK_TICKER_DATA,
  POLL_INTERVAL,
  FALLBACK_ACCOUNT,
  MAX_LIVE_SCAN_TICKERS,
} from '@/lib/constants';
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
    if (!quotes) return [...FALLBACK_TICKER_DATA];
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
      id: r.id,
      ticker: r.ticker,
      side: r.side,
      reason: r.reason ?? '',
      strength: r.signal_strength ?? null,
      ts: r.created_at,
    }));
  }, [filledRecs]);

  const watchlist = useMemo(
    () =>
      tickerData.slice(0, 8).map((item) => ({
        ...item,
        signalCount: recentSignals.filter((sig) => sig.ticker === item.ticker).length,
      })),
    [tickerData, recentSignals],
  );

  const equity = account?.equity ?? FALLBACK_ACCOUNT.equity;
  const pnl = equity - (account?.initial_capital ?? FALLBACK_ACCOUNT.initial_capital);
  const pnlPct = account?.initial_capital ? (pnl / account.initial_capital) * 100 : 0;

  const tradingColors = getStatusColors(systemControls?.trading_halted ? 'error' : 'success');
  const pendingColors = getStatusColors('warning');
  const agentColors = getStatusColors(
    agentStatus?.halted ? 'error' : agentStatus?.isRunning ? 'success' : 'neutral',
  );

  const heroTicker = tickerData[0];

  return (
    <div className="space-y-4 p-3 sm:p-4 xl:p-5 page-enter" aria-label="Trading dashboard">
      <h1 className="text-heading-page">Dashboard</h1>

      {engineOnline === false && <OfflineBanner service="engine" />}
      {agentsOnline === false && <OfflineBanner service="agents" />}

      <section aria-label="System state" className="workstation-strip">
        <div className="workspace-keyline">
          <p className="workspace-label">Trading</p>
          <div className={cn('workspace-value', tradingColors.text)}>
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            {systemControls?.trading_halted ? 'Halted' : 'Active'}
          </div>
        </div>
        <div className="workspace-keyline">
          <p className="workspace-label">Market Mode</p>
          <div className="workspace-value text-foreground/90">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="uppercase">{systemControls?.global_mode ?? 'paper'}</span>
          </div>
        </div>
        <div className="workspace-keyline">
          <p className="workspace-label">Approvals</p>
          <div
            className={cn(
              'workspace-value',
              (pendingRecs?.length ?? 0) > 0 ? pendingColors.text : 'text-muted-foreground',
            )}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {pendingRecs?.length ?? 0}
          </div>
        </div>
        <div className="workspace-keyline">
          <p className="workspace-label">Agents</p>
          <div className={cn('workspace-value', agentColors.text)}>
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            {agentStatus?.halted ? 'Halted' : agentStatus?.isRunning ? 'Running' : 'Idle'}
            {agentStatus?.cycleCount != null && (
              <span className="text-[11px] text-muted-foreground">#{agentStatus.cycleCount}</span>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Market prices" className="relative">
        <PriceTicker items={tickerData} />
        <span className="absolute -top-1.5 right-2">
          {isLive ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-profit/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-profit uppercase"
              aria-label="Live market data"
            >
              <span className="h-1 w-1 rounded-full bg-profit animate-pulse" aria-hidden="true" />
              Live
            </span>
          ) : (
            <SimulatedBadge />
          )}
        </span>
      </section>

      <section aria-label="Trading workstation" className="workstation-grid">
        <Card className="workstation-panel workstation-watchlist @container/watchlist">
          <CardHeader className="pb-2">
            <CardTitle className="text-heading-card">Watchlist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-0">
            {watchlist.map((item) => (
              <article
                key={item.ticker}
                className="grid grid-cols-[4rem_1fr_auto] items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-accent/40"
              >
                <span className="font-mono text-foreground/90">{item.ticker}</span>
                <span className="font-mono text-muted-foreground">${item.price.toFixed(2)}</span>
                <div className="text-right">
                  <span className={cn('font-mono', item.change >= 0 ? 'text-profit' : 'text-loss')}>
                    {item.change >= 0 ? '+' : ''}
                    {item.change.toFixed(2)}%
                  </span>
                  {item.signalCount > 0 && (
                    <p className="text-[10px] text-muted-foreground">{item.signalCount} sig</p>
                  )}
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card className="workstation-panel workstation-primary-pane @container/primary">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-heading-card">Market Workspace</CardTitle>
              <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
                <Link href="/markets">
                  Open detailed market view <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="rounded-lg border border-border bg-background/50 p-3 min-h-56">
              <div className="flex items-center justify-between">
                <p className="workspace-label">Primary Instrument</p>
                <Waves className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 @[32rem]/primary:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-md border border-border/70 bg-card/40 p-3 min-h-36">
                  <p className="text-xs text-muted-foreground">
                    {heroTicker?.ticker ?? 'SPY'} intraday context
                  </p>
                  <p className="mt-2 text-data-primary">
                    <AnimatedNumber value={heroTicker?.price ?? 0} prefix="$" decimals={2} />
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-xs font-mono',
                      (heroTicker?.change ?? 0) >= 0 ? 'text-profit' : 'text-loss',
                    )}
                  >
                    {(heroTicker?.change ?? 0) >= 0 ? '+' : ''}
                    {(heroTicker?.change ?? 0).toFixed(2)}%
                  </p>
                </div>
                <div className="rounded-md border border-border/70 bg-card/40 p-3">
                  <p className="workspace-label">Session P&L</p>
                  <p className="mt-2 text-data-primary">
                    <AnimatedNumber
                      value={Math.abs(pnl)}
                      prefix={pnl >= 0 ? '+$' : '-$'}
                      decimals={2}
                    />
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-xs font-mono',
                      pnlPct >= 0 ? 'text-profit' : 'text-loss',
                    )}
                  >
                    {pnlPct >= 0 ? '+' : ''}
                    {pnlPct.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 @[38rem]/primary:grid-cols-2">
              <div className="rounded-md border border-border/70 bg-background/40 p-3">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="workspace-label">Total Equity</p>
                  <InfoTooltip content="Total value of all assets including cash and open positions." />
                </div>
                <p className="mt-1.5 text-data-primary">
                  <AnimatedNumber value={equity} prefix="$" decimals={2} />
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-background/40 p-3">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="workspace-label">Deployable Cash</p>
                </div>
                <p className="mt-1.5 text-data-primary">
                  <AnimatedNumber
                    value={account?.cash ?? FALLBACK_ACCOUNT.cash}
                    prefix="$"
                    decimals={2}
                  />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="workstation-ops-rail space-y-3">
          <IncidentControls />
          <AlertFeed alerts={alerts} />
        </div>
      </section>

      <section
        aria-label="Signal and setup band"
        className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_1fr]"
      >
        <Card className="workstation-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-heading-card">Active Signals</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
                    key={s.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-border/50 py-1.5 last:border-0"
                    role="listitem"
                  >
                    <span
                      className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded',
                        sideColors[s.side] ?? sideColors.buy,
                      )}
                    >
                      {s.side.toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{s.ticker}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.reason || 'No rationale provided'}
                      </p>
                    </div>
                    {s.strength != null ? (
                      <span
                        className={cn(
                          'text-xs font-mono px-1.5 py-0.5 rounded border',
                          getSignalStrengthColor(s.strength),
                        )}
                      >
                        {(s.strength * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <SetupProgress />
      </section>

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
