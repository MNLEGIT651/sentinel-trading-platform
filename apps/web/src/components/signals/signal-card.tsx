'use client';

import { ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SignalResult } from '@/lib/engine-client';

function StrengthBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-profit' : pct >= 50 ? 'bg-amber-500' : 'bg-muted-foreground';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-7 text-right">{pct}</span>
    </div>
  );
}

export interface SignalRow extends SignalResult {
  id: string;
}

interface SignalCardProps {
  signal: SignalRow;
}

export function SignalCard({ signal }: SignalCardProps) {
  return (
    <tr className="transition-colors hover:bg-accent/30">
      <td className="px-4 py-3">
        <span className="text-sm font-semibold text-foreground">{signal.ticker}</span>
      </td>
      <td className="px-4 py-3">
        <Badge
          className={cn(
            'border text-[10px] font-semibold',
            signal.direction === 'long'
              ? 'bg-profit/15 text-profit border-profit/30'
              : 'bg-loss/15 text-loss border-loss/30',
          )}
        >
          {signal.direction === 'long' ? (
            <ArrowUp className="mr-0.5 h-3 w-3" />
          ) : (
            <ArrowDown className="mr-0.5 h-3 w-3" />
          )}
          {signal.direction.toUpperCase()}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <StrengthBar value={signal.strength} />
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-muted-foreground">{signal.strategy_name}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-muted-foreground leading-relaxed line-clamp-2 max-w-xs">
          {signal.reason}
        </span>
      </td>
    </tr>
  );
}
