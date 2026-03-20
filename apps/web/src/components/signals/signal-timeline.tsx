'use client';

import { ArrowUpDown, Radar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SignalCard, type SignalRow } from './signal-card';

export type SortField = 'strength' | 'ticker' | 'direction';
export type SortDir = 'asc' | 'desc';

interface SignalTimelineProps {
  signals: SignalRow[];
  onToggleSort: (field: SortField) => void;
}

export function SignalTimeline({ signals, onToggleSort }: SignalTimelineProps) {
  if (signals.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Radar className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground text-center">
            No signals yet. Configure tickers above and run a scan.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1 text-center max-w-xs">
            Live scans are optimized for up to 5 tickers. Larger universes should be ingested to
            cache first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="pb-0 pt-3 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">Signal Results</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pt-2">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {(['ticker', 'direction', 'strength'] as const).map((field) => (
                  <th key={field} className="px-4 py-2 text-left">
                    <button
                      onClick={() => onToggleSort(field)}
                      className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {field}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-2 text-left">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Strategy
                  </span>
                </th>
                <th className="px-4 py-2 text-left">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Reason
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {signals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
