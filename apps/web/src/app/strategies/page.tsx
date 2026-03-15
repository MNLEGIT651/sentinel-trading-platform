'use client';

import { useState, useEffect } from 'react';
import {
  Brain,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Zap,
  BarChart3,
  DollarSign,
  GitBranch,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Strategy family configuration with accent colors
const familyConfig: Record<
  string,
  { label: string; icon: React.ElementType; color: string; badgeClass: string }
> = {
  trend_following: {
    label: 'Trend Following',
    icon: TrendingUp,
    color: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  momentum: {
    label: 'Momentum',
    icon: Zap,
    color: 'text-amber-400',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  mean_reversion: {
    label: 'Mean Reversion',
    icon: BarChart3,
    color: 'text-sky-400',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
  value: {
    label: 'Value',
    icon: DollarSign,
    color: 'text-violet-400',
    badgeClass: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  },
  pairs: {
    label: 'Pairs Trading',
    icon: GitBranch,
    color: 'text-rose-400',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
};

// Sample strategy data grouped by family
const strategyFamilies = [
  {
    family: 'trend_following',
    strategies: [
      {
        id: 'tf-sma-cross',
        name: 'SMA Crossover',
        description:
          'Generates signals when a fast simple moving average crosses above or below a slow simple moving average, indicating trend direction changes.',
        version: '1.0.0',
        is_active: true,
        parameters: {
          fast_period: 20,
          slow_period: 50,
          signal_period: 9,
          timeframe: '1d',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'tf-ema-trend',
        name: 'EMA Trend Rider',
        description:
          'Uses exponential moving average slopes and price position relative to the EMA to identify and ride sustained trends.',
        version: '1.0.0',
        is_active: true,
        parameters: {
          ema_period: 21,
          atr_multiplier: 2.0,
          min_slope: 0.001,
          timeframe: '1d',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'tf-breakout',
        name: 'Donchian Breakout',
        description:
          'Identifies breakouts from Donchian channel highs and lows, entering positions when price exceeds the channel range.',
        version: '1.0.0',
        is_active: false,
        parameters: {
          channel_period: 20,
          exit_period: 10,
          volume_filter: true,
          timeframe: '1d',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    family: 'momentum',
    strategies: [
      {
        id: 'mom-rsi',
        name: 'RSI Momentum',
        description:
          'Uses the Relative Strength Index to detect overbought and oversold conditions, entering positions on momentum extremes.',
        version: '1.0.0',
        is_active: true,
        parameters: {
          rsi_period: 14,
          overbought: 70,
          oversold: 30,
          timeframe: '1d',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'mom-macd',
        name: 'MACD Divergence',
        description:
          'Detects divergences between MACD histogram and price action to identify potential momentum shifts before they occur.',
        version: '1.0.0',
        is_active: true,
        parameters: {
          fast_period: 12,
          slow_period: 26,
          signal_period: 9,
          timeframe: '1d',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    family: 'mean_reversion',
    strategies: [
      {
        id: 'mr-bollinger',
        name: 'Bollinger Band Reversion',
        description:
          'Enters positions when price touches or exceeds Bollinger Bands, expecting a reversion to the moving average center.',
        version: '1.0.0',
        is_active: true,
        parameters: {
          period: 20,
          std_dev: 2.0,
          exit_at_mean: true,
          timeframe: '1d',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'mr-zscore',
        name: 'Z-Score Reversion',
        description:
          'Calculates the z-score of price relative to its historical distribution and enters positions at statistical extremes.',
        version: '1.0.0',
        is_active: false,
        parameters: {
          lookback: 60,
          entry_threshold: 2.0,
          exit_threshold: 0.5,
          timeframe: '1d',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    family: 'value',
    strategies: [
      {
        id: 'val-pe-rank',
        name: 'P/E Ratio Ranking',
        description:
          'Ranks stocks by price-to-earnings ratio within their sector, favoring undervalued securities with improving fundamentals.',
        version: '1.0.0',
        is_active: false,
        parameters: {
          max_pe: 15,
          min_market_cap: 1000000000,
          sector_relative: true,
          rebalance_days: 30,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    family: 'pairs',
    strategies: [
      {
        id: 'pairs-cointegration',
        name: 'Cointegration Pairs',
        description:
          'Identifies cointegrated stock pairs and trades the spread when it deviates significantly from its historical equilibrium.',
        version: '1.0.0',
        is_active: true,
        parameters: {
          lookback: 252,
          entry_zscore: 2.0,
          exit_zscore: 0.5,
          min_half_life: 5,
          max_half_life: 120,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
];

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL ?? 'http://localhost:8000';

interface EngineStrategyInfo {
  name: string;
  family: string;
  description: string;
  default_params: Record<string, unknown>;
}

interface EngineStrategyListResponse {
  strategies: EngineStrategyInfo[];
  families: string[];
  total: number;
}

interface StrategyEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  is_active: boolean;
  parameters: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface StrategyFamily {
  family: string;
  strategies: StrategyEntry[];
}

interface StrategyCardProps {
  strategy: StrategyEntry;
  familyKey: string;
}

function StrategyCard({ strategy, familyKey }: StrategyCardProps) {
  const config = familyConfig[familyKey];
  const paramEntries = Object.entries(strategy.parameters);

  return (
    <Card className="bg-card/50 border-border/50 transition-colors hover:border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold text-foreground">{strategy.name}</CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">{strategy.description}</p>
          </div>
          <Badge
            className={cn(
              'ml-3 shrink-0 border text-[10px]',
              strategy.is_active
                ? 'bg-profit/15 text-profit border-profit/30'
                : 'bg-muted text-muted-foreground border-border',
            )}
          >
            {strategy.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-md border border-border/50 overflow-hidden">
          <div className="bg-muted/30 px-3 py-1.5">
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Default Parameters
            </p>
          </div>
          <div className="divide-y divide-border/50">
            {paramEntries.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between px-3 py-1.5">
                <span className="text-xs text-muted-foreground font-mono">{key}</span>
                <span
                  className={cn(
                    'text-xs font-mono font-medium',
                    config?.color ?? 'text-foreground',
                  )}
                >
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">v{strategy.version}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StrategiesPage() {
  const [liveData, setLiveData] = useState<StrategyFamily[] | null>(null);
  const [loadingStrategies, setLoadingStrategies] = useState(true);
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});

  // Fetch live strategy data from engine
  useEffect(() => {
    fetch(`${ENGINE_URL}/api/v1/strategies/`, { signal: AbortSignal.timeout(5000) })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<EngineStrategyListResponse>;
      })
      .then((data) => {
        const familyMap = new Map<string, StrategyEntry[]>();
        for (const s of data.strategies) {
          if (!familyMap.has(s.family)) familyMap.set(s.family, []);
          familyMap.get(s.family)!.push({
            id: s.name,
            name: s.name
              .split('_')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' '),
            description: s.description,
            version: '1.0.0',
            is_active: true,
            parameters: s.default_params,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        setLiveData(
          Array.from(familyMap.entries()).map(([family, strategies]) => ({
            family,
            strategies,
          })) as StrategyFamily[],
        );
      })
      .catch(() => {
        // Engine offline — fall back to hardcoded data silently
        setLiveData(null);
      })
      .finally(() => setLoadingStrategies(false));
  }, []);

  // Expand all families when data loads
  useEffect(() => {
    const families = (liveData ?? (strategyFamilies as StrategyFamily[])).map((f) => f.family);
    if (families.length > 0) {
      setExpandedFamilies(Object.fromEntries(families.map((f) => [f, true])));
    }
  }, [liveData]);

  const displayFamilies: StrategyFamily[] = liveData ?? (strategyFamilies as StrategyFamily[]);

  const toggleFamily = (family: string) => {
    setExpandedFamilies((prev) => ({ ...prev, [family]: !prev[family] }));
  };

  const totalStrategies = displayFamilies.reduce((sum, f) => sum + f.strategies.length, 0);
  const activeStrategies = displayFamilies.reduce(
    (sum, f) => sum + f.strategies.filter((s) => s.is_active).length,
    0,
  );

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Strategies</h1>
            <p className="text-xs text-muted-foreground">
              {activeStrategies} active of {totalStrategies} total strategies across{' '}
              {displayFamilies.length} families
            </p>
          </div>
        </div>
      </div>

      {/* Strategy Families */}
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
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/50"
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
                        <span className="text-[10px] text-profit">{activeCount} active</span>
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
                    {family.strategies.map((strategy) => (
                      <StrategyCard
                        key={strategy.id}
                        strategy={strategy}
                        familyKey={family.family}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
