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
    <Card className="workstation-panel">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-heading-card">Alert Rail</CardTitle>
        <Bell className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <EmptyStatePreset preset="no-alerts" className="border-0 bg-transparent py-8" />
        ) : (
          <ScrollArea className="h-[360px]" type="always">
            <div className="space-y-2 pr-2">
              {alerts.map((alert) => (
                <article
                  key={alert.id}
                  className="rounded-md border border-border/60 p-2.5 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      className={cn(
                        'text-[10px] uppercase shrink-0',
                        severityStyles[alert.severity],
                      )}
                    >
                      {alert.severity}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground/70 shrink-0 font-mono">
                      {formatTime(alert.triggered_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-foreground line-clamp-1">
                    {alert.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                    {alert.message}
                  </p>
                </article>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
});
