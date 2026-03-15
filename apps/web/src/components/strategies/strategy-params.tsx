'use client';

import { cn } from '@/lib/utils';

interface StrategyParamsProps {
  parameters: Record<string, unknown>;
  accentColor?: string;
}

export function StrategyParams({ parameters, accentColor }: StrategyParamsProps) {
  const paramEntries = Object.entries(parameters);

  return (
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
            <span className={cn('text-xs font-mono font-medium', accentColor ?? 'text-foreground')}>
              {String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
