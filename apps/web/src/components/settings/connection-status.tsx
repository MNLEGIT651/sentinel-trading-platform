'use client';

import { Server, Globe, Database, Bot, Brain, Shield, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ServiceStatus = 'connected' | 'disconnected' | 'not_configured' | 'checking';

export interface ServiceStatuses {
  engine: ServiceStatus;
  agents: ServiceStatus;
  polygon: ServiceStatus;
  supabase: ServiceStatus;
  anthropic: ServiceStatus;
  alpaca: ServiceStatus;
}

const statusConfig: Record<ServiceStatus, { color: string; badge: string; text: string }> = {
  connected: {
    color: 'text-profit',
    badge: 'bg-profit/15 text-profit border-profit/30',
    text: 'Connected',
  },
  disconnected: {
    color: 'text-loss',
    badge: 'bg-loss/15 text-loss border-loss/30',
    text: 'Disconnected',
  },
  not_configured: {
    color: 'text-amber-400',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    text: 'Not Configured',
  },
  checking: {
    color: 'text-muted-foreground',
    badge: 'bg-muted/30 text-muted-foreground border-border',
    text: 'Checking…',
  },
};

/** Full row layout for sm+ screens. */
function ConnectionStatusRow({
  label,
  icon: Icon,
  status,
}: {
  label: string;
  icon: React.ElementType;
  status: ServiceStatus;
}) {
  const c = statusConfig[status];

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2.5">
        {status === 'checking' ? (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        ) : (
          <Icon className={cn('h-4 w-4', c.color)} />
        )}
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <Badge className={cn('border text-[10px]', c.badge)}>{c.text}</Badge>
    </div>
  );
}

/** Compact cell layout for mobile (< sm) screens. */
function ConnectionStatusCell({
  label,
  icon: Icon,
  status,
}: {
  label: string;
  icon: React.ElementType;
  status: ServiceStatus;
}) {
  const c = statusConfig[status];

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/40 px-2.5 py-2">
      {status === 'checking' ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground animate-spin" />
      ) : (
        <Icon className={cn('h-3.5 w-3.5 shrink-0', c.color)} />
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-foreground" title={label}>
          {label}
        </p>
        <p className={cn('text-[10px]', c.color)}>{c.text}</p>
      </div>
    </div>
  );
}

interface ConnectionStatusPanelProps {
  serviceStatus: ServiceStatuses;
  checkingConnections: boolean;
  onCheckConnections: () => void;
}

export function ConnectionStatusPanel({
  serviceStatus,
  checkingConnections,
  onCheckConnections,
}: ConnectionStatusPanelProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Service Status
          </CardTitle>
          <button
            onClick={onCheckConnections}
            disabled={checkingConnections}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', checkingConnections && 'animate-spin')} />
            {checkingConnections ? 'Checking...' : 'Test'}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Compact 2-column grid on mobile */}
        <div className="grid grid-cols-2 gap-2 sm:hidden">
          <ConnectionStatusCell icon={Server} label="Engine" status={serviceStatus.engine} />
          <ConnectionStatusCell icon={Bot} label="Agents" status={serviceStatus.agents} />
          <ConnectionStatusCell icon={Globe} label="Polygon.io" status={serviceStatus.polygon} />
          <ConnectionStatusCell icon={Database} label="Supabase" status={serviceStatus.supabase} />
          <ConnectionStatusCell icon={Brain} label="Claude AI" status={serviceStatus.anthropic} />
          <ConnectionStatusCell icon={Shield} label="Alpaca" status={serviceStatus.alpaca} />
        </div>
        {/* Full row list on sm+ screens */}
        <div className="hidden sm:block">
          <ConnectionStatusRow
            icon={Server}
            label="Quant Engine (FastAPI)"
            status={serviceStatus.engine}
          />
          <ConnectionStatusRow
            icon={Bot}
            label="Agents Orchestrator"
            status={serviceStatus.agents}
          />
          <ConnectionStatusRow
            icon={Globe}
            label="Polygon.io Market Data"
            status={serviceStatus.polygon}
          />
          <ConnectionStatusRow
            icon={Database}
            label="Supabase Database"
            status={serviceStatus.supabase}
          />
          <ConnectionStatusRow
            icon={Brain}
            label="Claude AI (Anthropic)"
            status={serviceStatus.anthropic}
          />
          <ConnectionStatusRow icon={Shield} label="Alpaca Broker" status={serviceStatus.alpaca} />
        </div>
      </CardContent>
    </Card>
  );
}
