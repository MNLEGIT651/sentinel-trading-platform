import { Eye, Brain, ShieldAlert, BarChart3, Crosshair } from 'lucide-react';
import type { ElementType } from 'react';

export interface AgentDef {
  role: string;
  name: string;
  description: string;
  icon: ElementType;
  color: string;
  badgeClass: string;
}

export const agentDefs: AgentDef[] = [
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
