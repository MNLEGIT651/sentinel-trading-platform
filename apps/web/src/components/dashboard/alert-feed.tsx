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
  info: 'bg-blue-500/20 text-blue-400',
  warning: 'bg-yellow-500/20 text-yellow-400',
  critical: 'bg-red-500/20 text-red-400',
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
        <CardTitle className="text-sm font-medium text-muted-foreground">Recent Alerts</CardTitle>
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
                  className="flex items-start gap-3 rounded-lg border border-border/60 p-3 hover:bg-accent/30 transition-colors"
                >
                  <Badge
                    className={cn('text-[10px] uppercase shrink-0', severityStyles[alert.severity])}
                  >
                    {alert.severity}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{alert.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0 font-mono">
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
