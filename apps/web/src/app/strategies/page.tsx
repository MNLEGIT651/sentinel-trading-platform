'use client';

import { useState, useEffect } from 'react';
import { Brain, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { StrategyCard, type StrategyEntry } from '@/components/strategies/strategy-card';
import { strategyFamilies, type StrategyFamily } from '@/components/strategies/strategy-data';
import { familyConfig } from '@/components/strategies/family-config';

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

export default function StrategiesPage() {
  const [liveData, setLiveData] = useState<StrategyFamily[] | null>(null);
  const [loadingStrategies, setLoadingStrategies] = useState(true);
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>(
    Object.fromEntries(strategyFamilies.map((f) => [f.family, true])),
  );

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
        const families = Array.from(familyMap.entries()).map(([family, strategies]) => ({
          family,
          strategies,
        })) as StrategyFamily[];
        setLiveData(families);
        setExpandedFamilies(Object.fromEntries(families.map((f) => [f.family, true])));
      })
      .catch(() => {
        // Engine offline — fall back to hardcoded data silently
        setLiveData(null);
      })
      .finally(() => setLoadingStrategies(false));
  }, []);

  const displayFamilies: StrategyFamily[] = liveData ?? strategyFamilies;

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
                        {...(config?.color !== undefined && { accentColor: config.color })}
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
