'use client';

import { Server, Globe, Database, Bot, Brain, Shield, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
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

/** Setup guidance shown for unconfigured or disconnected services. */
const setupGuidance: Record<string, { envVar: string; description: string }> = {
  engine: {
    envVar: 'ENGINE_URL, ENGINE_API_KEY',
    description: 'Required for market data, orders, and backtesting.',
  },
  agents: {
    envVar: 'AGENTS_URL, AGENTS_API_KEY',
    description: 'Required for AI-powered analysis and recommendations.',
  },
  polygon: {
    envVar: 'POLYGON_API_KEY',
    description: 'Required for live market data and charts. Get a free key at polygon.io.',
  },
  supabase: {
    envVar: 'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY',
    description: 'Required for data persistence, auth, and real-time updates.',
  },
  anthropic: {
    envVar: 'ANTHROPIC_API_KEY',
    description: 'Required for AI agent analysis. Get a key at console.anthropic.com.',
  },
  alpaca: {
    envVar: 'ALPACA_API_KEY, ALPACA_SECRET_KEY',
    description: 'Required for paper/live trading. Get keys at app.alpaca.markets.',
  },
};

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
  serviceKey,
}: {
  label: string;
  icon: React.ElementType;
  status: ServiceStatus;
  serviceKey: string;
}) {
  const c = statusConfig[status];
  const guidance = setupGuidance[serviceKey];
  const showHint = (status === 'not_configured' || status === 'disconnected') && guidance;

  return (
    <div className="border-b border-border/25 py-3 last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {status === 'checking' ? (
            <Spinner size="sm" className="text-muted-foreground" />
          ) : (
            <Icon className={cn('h-4 w-4', c.color)} />
          )}
          <span className="text-base leading-tight text-foreground sm:text-[1.125rem]">
            {label}
          </span>
        </div>
        <Badge className={cn('border text-[10px]', c.badge)}>{c.text}</Badge>
      </div>
      {showHint && (
        <div className="mt-1.5 ml-6.5 text-xs text-muted-foreground">
          <span>{guidance.description}</span>{' '}
          <span className="font-mono text-[10px] text-foreground/60">Set: {guidance.envVar}</span>
        </div>
      )}
    </div>
  );
}

/** Compact cell layout for mobile (< sm) screens. */
function ConnectionStatusCell({
  label,
  icon: Icon,
  status,
  serviceKey,
}: {
  label: string;
  icon: React.ElementType;
  status: ServiceStatus;
  serviceKey: string;
}) {
  const c = statusConfig[status];
  const guidance = setupGuidance[serviceKey];
  const showHint = status === 'not_configured' && guidance;

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/25 bg-muted/15 px-3 py-3">
      {status === 'checking' ? (
        <Spinner size="sm" className="shrink-0 text-muted-foreground" />
      ) : (
        <Icon className={cn('h-3.5 w-3.5 shrink-0', c.color)} />
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight text-foreground" title={label}>
          {label}
        </p>
        <p className={cn('text-xs leading-relaxed', c.color)}>{c.text}</p>
        {showHint && (
          <p
            className="text-[10px] text-muted-foreground/70 mt-0.5 truncate"
            title={guidance.envVar}
          >
            Set: {guidance.envVar}
          </p>
        )}
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
    <Card className="border-border/60 bg-card ring-foreground/5 sm:ring-foreground/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[1.375rem] font-semibold leading-tight text-foreground sm:text-xl">
            Service Status
          </CardTitle>
          <button
            onClick={onCheckConnections}
            disabled={checkingConnections}
            aria-label="Test service connections"
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
          <ConnectionStatusCell
            icon={Server}
            label="Engine"
            status={serviceStatus.engine}
            serviceKey="engine"
          />
          <ConnectionStatusCell
            icon={Bot}
            label="Agents"
            status={serviceStatus.agents}
            serviceKey="agents"
          />
          <ConnectionStatusCell
            icon={Globe}
            label="Polygon.io"
            status={serviceStatus.polygon}
            serviceKey="polygon"
          />
          <ConnectionStatusCell
            icon={Database}
            label="Supabase"
            status={serviceStatus.supabase}
            serviceKey="supabase"
          />
          <ConnectionStatusCell
            icon={Brain}
            label="Claude AI"
            status={serviceStatus.anthropic}
            serviceKey="anthropic"
          />
          <ConnectionStatusCell
            icon={Shield}
            label="Alpaca"
            status={serviceStatus.alpaca}
            serviceKey="alpaca"
          />
        </div>
        {/* Full row list on sm+ screens */}
        <div className="hidden sm:block">
          <ConnectionStatusRow
            icon={Server}
            label="Quant Engine (FastAPI)"
            status={serviceStatus.engine}
            serviceKey="engine"
          />
          <ConnectionStatusRow
            icon={Bot}
            label="Agents Orchestrator"
            status={serviceStatus.agents}
            serviceKey="agents"
          />
          <ConnectionStatusRow
            icon={Globe}
            label="Polygon.io Market Data"
            status={serviceStatus.polygon}
            serviceKey="polygon"
          />
          <ConnectionStatusRow
            icon={Database}
            label="Supabase Database"
            status={serviceStatus.supabase}
            serviceKey="supabase"
          />
          <ConnectionStatusRow
            icon={Brain}
            label="Claude AI (Anthropic)"
            status={serviceStatus.anthropic}
            serviceKey="anthropic"
          />
          <ConnectionStatusRow
            icon={Shield}
            label="Alpaca Broker"
            status={serviceStatus.alpaca}
            serviceKey="alpaca"
          />
        </div>
      </CardContent>
    </Card>
  );
}
