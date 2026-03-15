'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AgentAlert } from '@/lib/agents-client';

interface AgentAlertFeedProps {
  alerts: AgentAlert[];
  isOffline: boolean;
}

export function AgentAlertFeed({ alerts, isOffline }: AgentAlertFeedProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Recent Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {isOffline
              ? 'Agents server offline — start with: pnpm dev (in apps/agents)'
              : 'No alerts. Run a cycle to see agent activity.'}
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {alerts.map((alert) => {
              const severityColor =
                alert.severity === 'critical'
                  ? 'text-loss'
                  : alert.severity === 'warning'
                    ? 'text-amber-400'
                    : 'text-muted-foreground';
              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-2 py-1.5 border-b border-border/30 last:border-0"
                >
                  <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0 pt-0.5">
                    {new Date(alert.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <Badge
                    className={cn(
                      'border text-[9px] shrink-0',
                      alert.severity === 'critical'
                        ? 'bg-loss/15 text-loss border-loss/30'
                        : alert.severity === 'warning'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-muted text-muted-foreground border-border',
                    )}
                  >
                    {alert.severity}
                  </Badge>
                  <div>
                    <span className={cn('text-[11px] font-medium', severityColor)}>
                      {alert.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground ml-1">
                      — {alert.message}
                    </span>
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
