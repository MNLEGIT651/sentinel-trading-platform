'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Agent role config ────────────────────────────────────────────────

interface AgentDef {
  role: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  badgeClass: string;
  tools: string[];
}

const agentDefs: AgentDef[] = [
  {
    role: 'market_sentinel',
    name: 'Market Sentinel',
    description: 'Monitors real-time market data, detects unusual activity, and generates alerts for significant price movements and volume anomalies.',
    icon: Eye,
    color: 'text-sky-400',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    tools: ['get_market_data', 'get_market_sentiment', 'create_alert'],
  },
  {
    role: 'strategy_analyst',
    name: 'Strategy Analyst',
    description: 'Runs strategy scans across the watchlist, analyzes technical patterns, and generates trading signals with confidence scores.',
    icon: Brain,
    color: 'text-violet-400',
    badgeClass: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    tools: ['run_strategy_scan', 'get_strategy_info', 'analyze_ticker'],
  },
  {
    role: 'risk_monitor',
    name: 'Risk Monitor',
    description: 'Continuously assesses portfolio risk exposure, checks position limits, calculates drawdown metrics, and can trigger circuit breakers.',
    icon: ShieldAlert,
    color: 'text-amber-400',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    tools: ['assess_portfolio_risk', 'check_risk_limits', 'calculate_position_size'],
  },
  {
    role: 'research',
    name: 'Research Analyst',
    description: 'Performs deep-dive analysis on individual tickers, evaluating fundamentals, technicals, and sentiment for comprehensive insights.',
    icon: BarChart3,
    color: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    tools: ['analyze_ticker', 'get_market_data', 'get_market_sentiment'],
  },
  {
    role: 'execution_monitor',
    name: 'Execution Monitor',
    description: 'Manages order submission, monitors fill quality, tracks open positions, and ensures execution aligns with strategy signals.',
    icon: Crosshair,
    color: 'text-rose-400',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    tools: ['submit_order', 'get_open_orders', 'create_alert'],
  },
];

type AgentStatus = 'idle' | 'running' | 'completed' | 'error';

interface AgentState {
  status: AgentStatus;
  lastRun: string | null;
  cyclesCompleted: number;
  lastResult: string | null;
}

interface CycleLogEntry {
  timestamp: string;
  agent: string;
  status: 'completed' | 'error';
  message: string;
}

const statusConfig: Record<AgentStatus, { color: string; pulse: boolean; label: string }> = {
  idle: { color: 'text-muted-foreground', pulse: false, label: 'Idle' },
  running: { color: 'text-sky-400', pulse: true, label: 'Running' },
  completed: { color: 'text-profit', pulse: false, label: 'Completed' },
  error: { color: 'text-loss', pulse: false, label: 'Error' },
};

// ── Main page ────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>(
    Object.fromEntries(
      agentDefs.map((a) => [
        a.role,
        { status: 'idle' as AgentStatus, lastRun: null, cyclesCompleted: 0, lastResult: null },
      ]),
    ),
  );
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [isHalted, setIsHalted] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [cycleLog, setCycleLog] = useState<CycleLogEntry[]>([]);

  const simulateAgentRun = useCallback(
    async (role: string): Promise<string> => {
      // Simulate an agent running with random duration
      const duration = 500 + Math.random() * 1500;
      await new Promise((r) => setTimeout(r, duration));
      const results = [
        'Scan complete — no actionable signals detected.',
        'Detected elevated VIX; monitoring closely.',
        'All positions within risk limits.',
        'Generated 2 LONG signals: NVDA (strength 82), AAPL (strength 71).',
        'Portfolio drawdown at 3.2%, well within soft limit.',
        'Order fill quality: 99.4% — no slippage concerns.',
        'RSI divergence detected on TSLA — flagged for review.',
        'Sector concentration: Technology at 58%, approaching limit.',
      ];
      return results[Math.floor(Math.random() * results.length)];
    },
    [],
  );

  const runCycle = useCallback(async () => {
    if (isHalted) return;

    setIsOrchestrating(true);
    const executionOrder = [
      'market_sentinel',
      'strategy_analyst',
      'risk_monitor',
      'research',
      'execution_monitor',
    ];

    for (const role of executionOrder) {
      if (isHalted) break;

      setAgentStates((prev) => ({
        ...prev,
        [role]: { ...prev[role], status: 'running' },
      }));

      try {
        const result = await simulateAgentRun(role);
        const now = new Date().toLocaleTimeString();

        setAgentStates((prev) => ({
          ...prev,
          [role]: {
            status: 'completed',
            lastRun: now,
            cyclesCompleted: prev[role].cyclesCompleted + 1,
            lastResult: result,
          },
        }));

        setCycleLog((prev) => [
          { timestamp: now, agent: role, status: 'completed', message: result },
          ...prev.slice(0, 49),
        ]);
      } catch {
        setAgentStates((prev) => ({
          ...prev,
          [role]: { ...prev[role], status: 'error', lastResult: 'Agent execution failed' },
        }));
      }
    }

    setCycleCount((c) => c + 1);
    setIsOrchestrating(false);

    // Reset all to idle after a moment
    setTimeout(() => {
      setAgentStates((prev) => {
        const next = { ...prev };
        for (const role of executionOrder) {
          if (next[role].status === 'completed') {
            next[role] = { ...next[role], status: 'idle' };
          }
        }
        return next;
      });
    }, 2000);
  }, [isHalted, simulateAgentRun]);

  // Auto-run cycles
  useEffect(() => {
    if (!isOrchestrating && !isHalted && cycleCount > 0) {
      // Don't auto-run, only run on explicit trigger
    }
  }, [isOrchestrating, isHalted, cycleCount]);

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
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isHalted && (
            <Badge className="border bg-loss/15 text-loss border-loss/30 mr-2">
              <AlertTriangle className="mr-1 h-3 w-3" />
              HALTED
            </Badge>
          )}
          <Button
            onClick={() => {
              if (isHalted) {
                setIsHalted(false);
              } else {
                runCycle();
              }
            }}
            disabled={isOrchestrating}
            variant="default"
            size="sm"
          >
            {isOrchestrating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-1.5">Running Cycle...</span>
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
          <Button
            onClick={() => setIsHalted(true)}
            disabled={isHalted || isOrchestrating}
            variant="outline"
            size="sm"
          >
            <Pause className="h-4 w-4" />
            <span className="ml-1.5">Halt</span>
          </Button>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {agentDefs.map((agent) => {
          const state = agentStates[agent.role];
          const statusCfg = statusConfig[state.status];
          const Icon = agent.icon;

          return (
            <Card key={agent.role} className="bg-card/50 border-border/50 transition-colors hover:border-border">
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
                            statusCfg.color,
                            statusCfg.pulse && 'animate-pulse',
                          )}
                        />
                        <span className={cn('text-[10px] font-medium', statusCfg.color)}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge className={cn('border text-[10px] shrink-0', agent.badgeClass)}>
                    {agent.role.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {agent.description}
                </p>

                {/* Tools */}
                <div className="space-y-1">
                  <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    Tools
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {agent.tools.map((tool) => (
                      <span
                        key={tool}
                        className="inline-flex items-center rounded bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between border-t border-border/50 pt-2">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {state.cyclesCompleted} runs
                    </span>
                  </div>
                  {state.lastRun && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{state.lastRun}</span>
                    </div>
                  )}
                </div>

                {/* Last result */}
                {state.lastResult && (
                  <div className="rounded-md bg-muted/30 px-2.5 py-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {state.lastResult}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cycle Activity Log */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cycle Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cycleLog.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No activity yet. Run a cycle to see agent outputs.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {cycleLog.map((entry, i) => {
                const agentDef = agentDefs.find((a) => a.role === entry.agent);
                return (
                  <div key={i} className="flex items-start gap-2 py-1.5 border-b border-border/30 last:border-0">
                    <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0 pt-0.5">
                      {entry.timestamp}
                    </span>
                    <Badge
                      className={cn(
                        'border text-[9px] shrink-0',
                        agentDef?.badgeClass ?? 'bg-muted text-muted-foreground border-border',
                      )}
                    >
                      {agentDef?.name ?? entry.agent}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground leading-relaxed">
                      {entry.message}
                    </span>
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
