'use client';

import { useState, useCallback } from 'react';
import { Bot, Loader2, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  useStrategiesAutonomyQuery,
  useUpdateStrategyAutonomyMutation,
} from '@/hooks/queries/use-strategies-autonomy-query';
import type { StrategyAutonomyEntry } from '@/hooks/queries/use-strategies-autonomy-query';
import type { AutonomyMode } from '@sentinel/shared';
import { cn } from '@/lib/utils';
import { AUTONOMY_MODES, MODE_CONFIG } from './mode-config';

export function StrategyAutonomyGrid() {
  const { data: strategies, isLoading, isError } = useStrategiesAutonomyQuery();
  const updateMutation = useUpdateStrategyAutonomyMutation();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleModeChange = useCallback(
    (strategy: StrategyAutonomyEntry, newMode: AutonomyMode) => {
      if (newMode === strategy.autonomy_mode) {
        setEditingId(null);
        return;
      }
      updateMutation.mutate(
        { strategyId: strategy.strategy_id, autonomyMode: newMode },
        { onSettled: () => setEditingId(null) },
      );
    },
    [updateMutation],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          Strategy Autonomy
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Failed to load strategies</p>
        ) : !strategies || strategies.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No strategies configured</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Strategy</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">
                    Autonomy Mode
                  </th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {strategies.map((strategy) => {
                  const conf = MODE_CONFIG[strategy.autonomy_mode] ?? MODE_CONFIG.alert_only;
                  const isEditing = editingId === strategy.strategy_id;

                  return (
                    <tr key={strategy.strategy_id} className="group">
                      <td className="py-2.5 pr-4">
                        <span className="font-medium text-foreground">
                          {strategy.strategy_name
                            .split('_')
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(' ')}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        {isEditing ? (
                          <div className="relative inline-block">
                            <select
                              defaultValue={strategy.autonomy_mode}
                              onChange={(e) =>
                                handleModeChange(strategy, e.target.value as AutonomyMode)
                              }
                              onBlur={() => setEditingId(null)}
                              autoFocus
                              disabled={updateMutation.isPending}
                              className="appearance-none rounded-md border border-border bg-card py-1 pl-2 pr-7 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              {AUTONOMY_MODES.map((mode) => (
                                <option key={mode} value={mode}>
                                  {MODE_CONFIG[mode].label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                          </div>
                        ) : (
                          <Badge className={cn('border text-[10px]', conf.bgClass)}>
                            {conf.label}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5">
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => setEditingId(strategy.strategy_id)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Edit
                          </button>
                        )}
                        {updateMutation.isPending &&
                          updateMutation.variables?.strategyId === strategy.strategy_id && (
                            <Loader2 className="ml-2 inline h-3 w-3 animate-spin text-muted-foreground" />
                          )}
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
  );
}
