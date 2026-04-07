'use client';

import * as React from 'react';
import { useAppStore } from '@/stores/app-store';
import { AlertTriangle, Info, AlertCircle, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const SEVERITY_CONFIG = {
  critical: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  info: { icon: Info, color: 'text-primary', bg: 'bg-primary/10' },
} as const;

export function AlertPanel({ children }: { children: React.ReactNode }) {
  const alerts = useAppStore((s) => s.alerts);
  const acknowledgeAlert = useAppStore((s) => s.acknowledgeAlert);
  const unacknowledged = alerts.filter((a) => !a.acknowledged);

  return (
    <Popover>
      <PopoverTrigger render={children as React.ReactElement}>{null}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Alerts</h3>
          {unacknowledged.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unacknowledged.length} new
            </Badge>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {alerts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No alerts. You&apos;re all good.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {alerts.slice(0, 10).map((alert) => {
                const severity = alert.severity as keyof typeof SEVERITY_CONFIG;
                const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info;
                const SeverityIcon = config.icon;
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      'flex gap-3 px-4 py-3 transition-colors',
                      !alert.acknowledged && 'bg-muted/30',
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                        config.bg,
                      )}
                    >
                      <SeverityIcon className={cn('h-3.5 w-3.5', config.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{alert.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {alert.message}
                      </p>
                    </div>
                    {!alert.acknowledged && (
                      <button
                        type="button"
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Dismiss"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
