'use client';

import { useState, useEffect, useMemo } from 'react';
import { Brain, ChevronDown, ChevronRight, Loader2, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { StrategyCard, type StrategyEntry } from '@/components/strategies/strategy-card';
import { strategyFamilies, type StrategyFamily } from '@/components/strategies/strategy-data';
import { familyConfig } from '@/components/strategies/family-config';
import { useStrategiesQuery, useStrategyHealthQuery } from '@/hooks/queries';
import { HealthBadge, HealthMetricsCard } from '@/components/strategies/strategy-health';
import type { StrategyHealthSnapshot } from '@sentinel/shared';
import { markPageVisited } from '@/components/dashboard/setup-progress';

type TabId = 'strategies' | 'health';

function formatPercent(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return `${(v * 100).toFixed(1)}`;
}

function buildMetrics(s: StrategyHealthSnapshot) {
  return [
    { label: 'Win Rate', value: formatPercent(s.win_rate), trend: s.win_rate_trend, suffix: '%' },
    {
      label: 'Avg Return',
      value: s.avg_return_pct !== null ? s.avg_return_pct.toFixed(2) : null,
      trend: s.expectancy_trend,
      suffix: '%',
    },
    { label: 'Sharpe', value: s.sharpe_ratio !== null ? s.sharpe_ratio.toFixed(2) : null },
    { label: 'Trades', value: s.total_trades },
    { label: 'Signals', value: s.total_signals, trend: s.signal_freq_trend },
    { label: 'Expectancy', value: s.expectancy !== null ? s.expectancy.toFixed(3) : null },
  ];
}

export default function StrategiesPage() {
  useEffect(() => {
    markPageVisited('strategies');
  }, []);

  const { data: fetchedStrategies, isPending } = useStrategiesQuery();
  const { data: healthSnapshots, isPending: healthLoading } = useStrategyHealthQuery();
  const [activeTab, setActiveTab] = useState<TabId>('strategies');
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>(
    Object.fromEntries(strategyFamilies.map((f) => [f.family, true])),
  );

  // Build a map of strategy name → health snapshot for badge display
  const healthMap = useMemo(() => {
    const map = new Map<string, StrategyHealthSnapshot>();
    if (healthSnapshots) {
      for (const snap of healthSnapshots) {
        map.set(snap.strategy_name, snap);
      }
    }
    return map;
  }, [healthSnapshots]);

  const liveData = useMemo(() => {
    if (!fetchedStrategies) return null;
    const familyMap = new Map<string, StrategyEntry[]>();
    for (const s of fetchedStrategies) {
      const family = s.family ?? 'unknown';
      if (!familyMap.has(family)) familyMap.set(family, []);
      familyMap.get(family)!.push({
        id: s.name,
        name: s.name
          .split('_')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
        description: s.description ?? '',
        version: '1.0.0',
        is_active: true,
        parameters: s.default_params as Record<string, unknown>,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    return Array.from(familyMap.entries()).map(([family, strategies]) => ({
      family,
      strategies,
    })) as StrategyFamily[];
  }, [fetchedStrategies]);

  const loadingStrategies = isPending;
  const displayFamilies: StrategyFamily[] = liveData ?? strategyFamilies;

  const toggleFamily = (family: string) => {
    setExpandedFamilies((prev) => ({ ...prev, [family]: !prev[family] }));
  };

  const totalStrategies = displayFamilies.reduce((sum, f) => sum + f.strategies.length, 0);
  const activeStrategies = displayFamilies.reduce(
    (sum, f) => sum + f.strategies.filter((s) => s.is_active).length,
    0,
  );

  // Health summary stats
  const healthyCount = healthSnapshots?.filter((s) => s.health_label === 'healthy').length ?? 0;
  const warningCount = healthSnapshots?.filter((s) => s.health_label === 'warning').length ?? 0;
  const criticalCount = healthSnapshots?.filter((s) => s.health_label === 'critical').length ?? 0;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-heading-page text-foreground">Strategies</h1>
            <p className="text-xs text-muted-foreground">
              {activeStrategies} active of {totalStrategies} total strategies across{' '}
              {displayFamilies.length} families
            </p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
        <button
          onClick={() => setActiveTab('strategies')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            activeTab === 'strategies'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Brain className="h-3.5 w-3.5" />
          Registry
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            activeTab === 'health'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Activity className="h-3.5 w-3.5" />
          Health Monitor
          {(warningCount > 0 || criticalCount > 0) && (
            <span
              className={cn(
                'ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                criticalCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400',
              )}
            >
              {criticalCount + warningCount}
            </span>
          )}
        </button>
      </div>

      {/* Strategy Registry Tab */}
      {activeTab === 'strategies' && (
        <>
          {loadingStrategies ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {displayFamilies.map((family) => {
                const config = familyConfig[family.family];
                const isExpanded = expandedFamilies[family.family];
                const Icon = config?.icon ?? Brain;
                const activeCount = family.strategies.filter((s) => s.is_active).length;

                return (
                  <div key={family.family} className="space-y-2">
                    {/* Family Header */}
                    <button
                      onClick={() => toggleFamily(family.family)}
                      className="card-interactive flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/50"
                    >
                      <Icon
                        className={cn('h-4 w-4 shrink-0', config?.color ?? 'text-muted-foreground')}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {config?.label ?? family.family}
                          </span>
                          <Badge
                            className={cn(
                              'border text-[10px]',
                              config?.badgeClass ?? 'bg-muted text-muted-foreground border-border',
                            )}
                          >
                            {family.strategies.length} strateg
                            {family.strategies.length === 1 ? 'y' : 'ies'}
                          </Badge>
                          {activeCount > 0 && (
                            <StatusBadge status="active" label={`${activeCount} active`} />
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {/* Strategy Cards */}
                    {isExpanded && (
                      <div className="grid grid-cols-1 gap-3 pl-4 lg:grid-cols-2 xl:grid-cols-3">
                        {family.strategies.map((strategy) => {
                          const health = healthMap.get(strategy.id);
                          return (
                            <div key={strategy.id} className="relative">
                              <StrategyCard
                                strategy={strategy}
                                {...(config?.color !== undefined && { accentColor: config.color })}
                              />
                              {health && (
                                <div className="absolute top-2 right-2">
                                  <HealthBadge
                                    score={health.health_score}
                                    label={health.health_label}
                                    compact
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Health Monitor Tab */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          {/* Health Summary Strip */}
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2">
              <StatusBadge status="success" label={`${healthyCount} Healthy`} />
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2">
              <StatusBadge status="warning" label={`${warningCount} Warning`} />
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2">
              <StatusBadge status="error" label={`${criticalCount} Critical`} />
            </div>
          </div>

          {/* Health Cards */}
          {healthLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : healthSnapshots && healthSnapshots.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {healthSnapshots.map((snap) => (
                <HealthMetricsCard
                  key={snap.id}
                  strategyName={snap.strategy_name}
                  metrics={buildMetrics(snap)}
                  healthScore={snap.health_score}
                  healthLabel={snap.health_label}
                  windowDays={snap.window_days}
                  computedAt={snap.computed_at}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
              <Activity className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">No Health Data Yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm text-center">
                Strategy health snapshots are computed from trading outcomes and signal history. Run
                scans and execute trades to begin building health metrics.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
