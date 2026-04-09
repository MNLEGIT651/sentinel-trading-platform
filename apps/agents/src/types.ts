/**
 * Type definitions for the Sentinel Agent Orchestrator.
 */

import type { AlertSeverity } from '@sentinel/shared';

export type { AlertSeverity };

export type AgentRole =
  | 'market_sentinel'
  | 'strategy_analyst'
  | 'risk_monitor'
  | 'research'
  | 'execution_monitor'
  | 'pr_manager'
  | 'workflow_manager';

export type AgentStatus = 'idle' | 'running' | 'error' | 'cooldown';

export type SignalDirection = 'long' | 'short' | 'flat';

export interface AgentConfig {
  role: AgentRole;
  name: string;
  description: string;
  schedule: string; // cron-like description
  enabled: boolean;
  cooldownMs: number;
}

export interface AgentResult {
  role: AgentRole;
  success: boolean;
  timestamp: string;
  durationMs: number;
  data: unknown;
  error?: string;
}

export interface MarketSentiment {
  overall: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  drivers: string[];
  sectors: Record<string, 'bullish' | 'bearish' | 'neutral'>;
}

export interface StrategySignal {
  ticker: string;
  direction: SignalDirection;
  strength: number;
  strategyName: string;
  reason: string;
  metadata: Record<string, unknown>;
}

export interface RiskAssessment {
  equity: number;
  drawdown: number;
  dailyPnl: number;
  halted: boolean;
  alerts: RiskAlert[];
  concentrations: Record<string, number>;
}

export interface RiskAlert {
  severity: AlertSeverity;
  rule: string;
  message: string;
  action: string;
}

export interface ResearchInsight {
  ticker: string;
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  sources: string[];
  timestamp: string;
}

export interface ExecutionReport {
  ordersProcessed: number;
  ordersFilled: number;
  ordersFailed: number;
  slippageBps: number;
  details: ExecutionDetail[];
}

export interface ExecutionDetail {
  ticker: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number;
  status: 'filled' | 'partial' | 'rejected' | 'pending';
}

export interface OrchestratorState {
  agents: Record<AgentRole, AgentStatus>;
  lastRun: Record<AgentRole, string | null>;
  cycleCount: number;
  halted: boolean;
  lastCycleAt: string | null;
}
