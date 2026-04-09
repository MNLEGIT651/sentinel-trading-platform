'use client';

import { Activity, Loader2, AlertOctagon, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAutoExecutionActivityQuery } from '@/hooks/queries/use-auto-execution-activity-query';
import type { AutoExecutionEvent } from '@/hooks/queries/use-auto-execution-activity-query';
import { cn } from '@/lib/utils';
import { formatTimestamp } from './mode-config';

export function AutoExecutionActivityFeed() {
  const { data: events, isLoading, isError } = useAutoExecutionActivityQuery();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Auto-Execution Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Failed to load activity</p>
        ) : !events || events.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No auto-execution events yet
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.map((event: AutoExecutionEvent) => {
              const isApproved = event.event_type === 'auto_approved';
              const reason =
                (event.payload?.reason as string) ?? (event.payload?.message as string) ?? '';
              const policyVersion = (event.payload?.policy_version as string) ?? '';

              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                      isApproved ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400',
                    )}
                  >
                    {isApproved ? (
                      <Zap className="h-3 w-3" />
                    ) : (
                      <AlertOctagon className="h-3 w-3" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{event.ticker}</span>
                      <Badge
                        className={cn(
                          'border text-[10px]',
                          isApproved
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20',
                        )}
                      >
                        {isApproved ? 'Auto Approved' : 'Denied'}
                      </Badge>
                      {policyVersion && (
                        <span className="text-[10px] text-muted-foreground">v{policyVersion}</span>
                      )}
                    </div>
                    {reason && (
                      <p className="text-[10px] text-muted-foreground truncate">{reason}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60">
                      {formatTimestamp(event.event_ts)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
