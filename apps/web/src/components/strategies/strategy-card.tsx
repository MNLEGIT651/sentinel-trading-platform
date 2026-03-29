'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);

  const toggle = () => setExpanded((v) => !v);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <Card className="@container/strategy bg-card/50 border-border/50 transition-colors hover:border-border">
      <CardHeader className="pb-3">
        <button
          type="button"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={toggle}
          onKeyDown={handleKeyDown}
          className="flex w-full items-start justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
        >
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold text-foreground">{strategy.name}</CardTitle>
            <p className="hidden text-xs text-muted-foreground leading-relaxed @[12rem]/strategy:block">
              {strategy.description}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <SignalBadge isActive={strategy.is_active} />
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <StrategyParams
            parameters={strategy.parameters}
            {...(accentColor !== undefined && { accentColor })}
          />
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">v{strategy.version}</span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
