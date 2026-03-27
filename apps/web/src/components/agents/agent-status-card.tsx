'use client';

import { Circle, Zap, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  idle: 'text-muted-foreground',
  running: 'text-sky-400',
  error: 'text-destructive',
  cooldown: 'text-amber-400',
};

interface AgentStatusInfo {
  status: string;
  lastRun?: string | null;
}

interface AgentStatusCardProps {
  agentRole: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  badgeClass: string;
  agentStatus?: AgentStatusInfo;
  isOffline: boolean;
}

export function AgentStatusCard({
  agentRole,
  name,
  description,
  icon: Icon,
  color,
  badgeClass,
  agentStatus,
  isOffline,
}: AgentStatusCardProps) {
  const statusStr = agentStatus?.status ?? 'idle';
  const isAgentRunning = statusStr === 'running';

  return (
    <Card
      className={cn(
        'bg-card/50 border-border/50 transition-colors hover:border-border',
        isOffline && 'opacity-50 pointer-events-none',
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn('rounded-md bg-muted/50 p-1.5', color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">{name}</CardTitle>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Circle
                  className={cn(
                    'h-2 w-2 fill-current',
                    STATUS_COLORS[statusStr] ?? 'text-muted-foreground',
                    isAgentRunning && 'animate-pulse',
                  )}
                />
                <span
                  className={cn(
                    'text-[10px] font-medium capitalize',
                    STATUS_COLORS[statusStr] ?? 'text-muted-foreground',
                  )}
                >
                  {statusStr}
                </span>
              </div>
            </div>
          </div>
          <Badge className={cn('border text-[10px] shrink-0', badgeClass)}>
            {agentRole.replace(/_/g, ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        <div className="flex items-center justify-between border-t border-border/50 pt-2">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">{isOffline ? '—' : statusStr}</span>
          </div>
          {agentStatus?.lastRun != null &&
            (() => {
              const d = new Date(agentStatus.lastRun);
              return !isNaN(d.getTime()) ? (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ) : null;
            })()}
        </div>
      </CardContent>
    </Card>
  );
}
