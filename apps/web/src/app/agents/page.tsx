'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bot,
  Play,
  Pause,
  RefreshCw,
  Circle,
  ShieldAlert,
  Eye,
  Brain,
  BarChart3,
  Crosshair,
  AlertTriangle,
  Clock,
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  agentsClient,
  type OrchestratorStatus,
  type TradeRecommendation,
  type AgentAlert,
} from '@/lib/agents-client';

// ── Agent definitions ─────────────────────────────────────────────

interface AgentDef {
  role: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  badgeClass: string;
}

const agentDefs: AgentDef[] = [
  {
    role: 'market_sentinel',
    name: 'Market Sentinel',
    description:
      'Monitors real-time market data, detects unusual activity, and generates alerts for significant price movements.',
    icon: Eye,
    color: 'text-sky-400',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
  {
    role: 'strategy_analyst',
    name: 'Strategy Analyst',
    description:
      'Runs strategy scans across the watchlist, analyzes technical patterns, and generates trading signals.',
    icon: Brain,
    color: 'text-violet-400',
    badgeClass: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  },
  {
    role: 'risk_monitor',
    name: 'Risk Monitor',
    description:
      'Assesses portfolio risk, checks position limits, calculates drawdown, and can trigger circuit breakers.',
    icon: ShieldAlert,
    color: 'text-amber-400',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  {
    role: 'research',
    name: 'Research Analyst',
    description:
      'Performs deep-dive analysis on individual tickers with technical indicators and trend assessment.',
    icon: BarChart3,
    color: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  {
    role: 'execution_monitor',
    name: 'Execution Monitor',
    description:
      'Generates trade recommendations based on approved signals. Recommendations require human approval before execution.',
    icon: Crosshair,
    color: 'text-rose-400',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
];

const STATUS_COLORS: Record<string, string> = {
  idle: 'text-muted-foreground',
  running: 'text-sky-400',
  error: 'text-destructive',
  cooldown: 'text-amber-400',
};

// ── Main page ─────────────────────────────────────────────────────

export default function AgentsPage() {
  const [status, setStatus] = useState<OrchestratorStatus | null>(null);
  const [recommendations, setRecommendations] = useState<TradeRecommendation[]>([]);
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [cycleTriggering, setCycleTriggering] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [s, r, a] = await Promise.all([
        agentsClient.getStatus(),
        agentsClient.getRecommendations('pending'),
        agentsClient.getAlerts(),
      ]);
      setStatus(s);
      setRecommendations(r.recommendations);
      setAlerts(a.alerts);
      setIsOffline(false);
    } catch {
      setIsOffline(true);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, 5_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchAll]);

  const handleRunCycle = async () => {
    setCycleTriggering(true);
    try {
      await agentsClient.runCycle();
      await fetchAll();
    } catch (err) {
      console.error('Failed to start cycle:', err);
    } finally {
      setCycleTriggering(false);
    }
  };

  const handleHalt = async () => {
    await agentsClient.halt();
    await fetchAll();
  };

  const handleResume = async () => {
    await agentsClient.resume();
    await fetchAll();
  };

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await agentsClient.approveRecommendation(id);
      await fetchAll();
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setRejectingId(id);
    try {
      await agentsClient.rejectRecommendation(id);
      await fetchAll();
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setRejectingId(null);
    }
  };

  const isRunning = status?.isRunning ?? false;
  const isHalted = status?.halted ?? false;
  const cycleCount = status?.cycleCount ?? 0;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">AI Agents</h1>
            <p className="text-xs text-muted-foreground">
              {cycleCount} cycles completed &middot; 5 agents configured
              {status?.nextCycleAt && !isHalted && (
                <span className="ml-2">
                  &middot; next cycle{' '}
                  {new Date(status.nextCycleAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOffline && (
            <Badge className="border bg-muted text-muted-foreground border-border/50 mr-1 text-[10px]">
              Offline
            </Badge>
          )}
          {status?.nextCycleAt && !isHalted && !isOffline && (
            <Badge className="border bg-primary/10 text-primary border-primary/20 mr-1 text-[10px]">
              Scheduled
            </Badge>
          )}
          {isHalted && (
            <Badge className="border bg-loss/15 text-loss border-loss/30 mr-2">
              <AlertTriangle className="mr-1 h-3 w-3" />
              HALTED
            </Badge>
          )}
          <Button
            onClick={isHalted ? handleResume : handleRunCycle}
            disabled={isRunning || cycleTriggering}
            variant="default"
            size="sm"
          >
            {isRunning || cycleTriggering ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-1.5">Running...</span>
              </>
            ) : isHalted ? (
              <>
                <Play className="h-4 w-4" />
                <span className="ml-1.5">Resume</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span className="ml-1.5">Run Cycle</span>
              </>
            )}
          </Button>
          <Button onClick={handleHalt} disabled={isHalted || isRunning} variant="outline" size="sm">
            <Pause className="h-4 w-4" />
            <span className="ml-1.5">Halt</span>
          </Button>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {agentDefs.map((agent) => {
          const agentStatus = status?.agents[agent.role];
          const Icon = agent.icon;
          const statusStr = agentStatus?.status ?? 'idle';
          const isAgentRunning = statusStr === 'running';

          return (
            <Card
              key={agent.role}
              className="bg-card/50 border-border/50 transition-colors hover:border-border"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn('rounded-md bg-muted/50 p-1.5', agent.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold text-foreground">
                        {agent.name}
                      </CardTitle>
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
                  <Badge className={cn('border text-[10px] shrink-0', agent.badgeClass)}>
                    {agent.role.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">{agent.description}</p>
                <div className="flex items-center justify-between border-t border-border/50 pt-2">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {isOffline ? '—' : statusStr}
                    </span>
                  </div>
                  {agentStatus?.lastRun && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(agentStatus.lastRun).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Trade Recommendations */}
      {recommendations.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-foreground">
                Pending Trade Recommendations
              </CardTitle>
              <Badge className="border bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
                {recommendations.length} awaiting approval
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  {rec.side === 'buy' ? (
                    <TrendingUp className="h-4 w-4 text-profit shrink-0" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-loss shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{rec.ticker}</span>
                      <Badge
                        className={cn(
                          'border text-[9px]',
                          rec.side === 'buy'
                            ? 'bg-profit/10 text-profit border-profit/20'
                            : 'bg-loss/10 text-loss border-loss/20',
                        )}
                      >
                        {rec.side.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {rec.quantity} shares @ {rec.order_type}
                      </span>
                    </div>
                    {rec.reason && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{rec.reason}</p>
                    )}
                    {rec.strategy_name && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {rec.strategy_name}
                        {rec.signal_strength != null &&
                          ` · strength ${(rec.signal_strength * 100).toFixed(0)}%`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="default"
                    disabled={approvingId === rec.id}
                    onClick={() => handleApprove(rec.id)}
                    className="h-7 text-xs bg-profit hover:bg-profit/80"
                  >
                    {approvingId === rec.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Approve
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={rejectingId === rec.id}
                    onClick={() => handleReject(rec.id)}
                    className="h-7 text-xs"
                  >
                    {rejectingId === rec.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        Reject
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Alerts */}
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
    </div>
  );
}
