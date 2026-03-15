'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SignalBadge } from './signal-badge';
import { StrategyParams } from './strategy-params';

export interface StrategyEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  is_active: boolean;
  parameters: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface StrategyCardProps {
  strategy: StrategyEntry;
  accentColor?: string;
}

export function StrategyCard({ strategy, accentColor }: StrategyCardProps) {
  return (
    <Card className="bg-card/50 border-border/50 transition-colors hover:border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold text-foreground">{strategy.name}</CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">{strategy.description}</p>
          </div>
          <SignalBadge isActive={strategy.is_active} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <StrategyParams parameters={strategy.parameters} accentColor={accentColor} />
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">v{strategy.version}</span>
        </div>
      </CardContent>
    </Card>
  );
}
