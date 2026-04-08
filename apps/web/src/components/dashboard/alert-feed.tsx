'use client';

import { memo } from 'react';
import type { Alert, AlertSeverity } from '@sentinel/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmptyStatePreset } from '@/components/ui/empty-state';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

const severityStyles: Record<AlertSeverity, string> = {
  info: 'border-border bg-muted/30 text-muted-foreground',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  critical: 'border-loss/35 bg-loss/10 text-loss',
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

interface AlertFeedProps {
  alerts: Alert[];
}

export const AlertFeed = memo(function AlertFeed({ alerts }: AlertFeedProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-heading-card">Active Alerts</CardTitle>
        <Bell className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <EmptyStatePreset preset="no-alerts" className="border-0 bg-transparent py-8" />
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="grid grid-cols-[auto,1fr,auto] items-start gap-3 rounded-lg border border-border/70 p-3 transition-colors hover:bg-accent/30"
                >
                  <Badge
                    className={cn(
                      'shrink-0 border text-[10px] uppercase',
                      severityStyles[alert.severity],
                    )}
                  >
                    {alert.severity}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{alert.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{alert.message}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                    {formatTime(alert.triggered_at)}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
});
