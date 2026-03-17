/**
 * Agent Orchestrator — coordinates the 5-agent trading system.
 *
 * Runs agents in a defined sequence with dependency management:
 * 1. Market Sentinel → assess market conditions
 * 2. Strategy Analyst → generate signals (depends on market data)
 * 3. Risk Monitor → check portfolio risk (depends on positions)
 * 4. Research → deep dive on top signals (depends on strategy output)
 * 5. Execution Monitor → execute approved trades (depends on risk approval)
 */

import { Agent } from './agent.js';
import { ToolExecutor } from './tool-executor.js';
import { EngineClient } from './engine-client.js';
import { loadCycle } from './wat/workflow-loader.js';
import type { AgentConfig, AgentResult, AgentRole, OrchestratorState } from './types.js';

const DEFAULT_CONFIGS: AgentConfig[] = [
  {
    role: 'market_sentinel',
    name: 'Market Sentinel',
    description: 'Monitors market conditions and detects significant events',
    schedule: 'every 5 minutes during market hours',
    enabled: true,
    cooldownMs: 5 * 60 * 1000,
  },
  {
    role: 'strategy_analyst',
    name: 'Strategy Analyst',
    description: 'Runs trading strategies and recommends trades',
    schedule: 'every 15 minutes during market hours',
    enabled: true,
    cooldownMs: 15 * 60 * 1000,
  },
  {
    role: 'risk_monitor',
    name: 'Risk Monitor',
    description: 'Monitors portfolio risk and enforces limits',
    schedule: 'every 1 minute during market hours',
    enabled: true,
    cooldownMs: 60 * 1000,
  },
  {
    role: 'research',
    name: 'Research Analyst',
    description: 'Performs deep analysis on specific tickers',
    schedule: 'on demand',
    enabled: true,
    cooldownMs: 30 * 60 * 1000,
  },
  {
    role: 'execution_monitor',
    name: 'Execution Monitor',
    description: 'Manages trade execution and monitors order status',
    schedule: 'on demand',
    enabled: true,
    cooldownMs: 10 * 1000,
  },
];

const DEFAULT_PROMPTS: Record<string, string> = {
  market_sentinel:
    'Scan the current market conditions. Check prices for the watchlist tickers: AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META, SPY. Report any significant movements, unusual volume, or market regime changes. Create alerts for anything noteworthy.',
  strategy_analyst:
    'Run all available trading strategies against the watchlist tickers. Identify the top signals by conviction. For each signal, explain the setup and expected risk-reward. Only recommend trades with clear edge.',
  risk_monitor:
    'Assess the current portfolio risk. Check drawdown levels, position concentrations, and sector exposure. For any proposed trades from the strategy analyst, verify they pass all risk limits. Calculate appropriate position sizes.',
  execution_monitor:
    'Check for any open orders. If there are approved trades from this cycle that pass risk checks, prepare them for execution. Report on execution quality for any fills.',
};

export class Orchestrator {
  private agents: Map<AgentRole, Agent> = new Map();
  private state: OrchestratorState;
  private executor: ToolExecutor;
  private cycleInterval: ReturnType<typeof setInterval> | null = null;
  private cycleSequence: AgentRole[];

  constructor(options?: { apiKey?: string; engineUrl?: string; configs?: AgentConfig[] }) {
    const engine = new EngineClient(options?.engineUrl);
    this.executor = new ToolExecutor(engine);

    const configs = options?.configs ?? DEFAULT_CONFIGS;

    // Initialize all agents
    for (const config of configs) {
      const agentOptions: { apiKey?: string; executor: ToolExecutor } = {
        executor: this.executor,
      };
      if (options?.apiKey !== undefined) agentOptions.apiKey = options.apiKey;
      const agent = new Agent(config, agentOptions);
      this.agents.set(config.role, agent);
    }

    // Initialize state
    this.state = {
      agents: Object.fromEntries(configs.map((c) => [c.role, 'idle'] as const)) as Record<
        AgentRole,
        'idle'
      >,
      lastRun: Object.fromEntries(configs.map((c) => [c.role, null] as const)) as Record<
        AgentRole,
        null
      >,
      cycleCount: 0,
      halted: false,
      lastCycleAt: null,
    };

    // Load cycle sequence from workflow — fall back to hardcoded order
    try {
      const cycle = loadCycle();
      this.cycleSequence = cycle.sequence;
    } catch {
      this.cycleSequence = [
        'market_sentinel',
        'strategy_analyst',
        'risk_monitor',
        'execution_monitor',
      ];
    }
  }

  get currentState(): OrchestratorState {
    return { ...this.state };
  }

  /**
   * Run a single trading cycle: market → strategy → risk → execute.
   */
  async runCycle(): Promise<AgentResult[]> {
    if (this.state.halted) {
      console.log('[Orchestrator] Trading halted — skipping cycle');
      return [];
    }

    this.state.cycleCount++;
    const results: AgentResult[] = [];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Orchestrator] Starting cycle #${this.state.cycleCount}`);
    console.log(`${'='.repeat(60)}\n`);

    for (const role of this.cycleSequence) {
      if (this.state.halted && role === 'execution_monitor') {
        console.log('[Orchestrator] Trading halted — skipping execution');
        continue;
      }
      const result = await this.runAgent(
        role,
        DEFAULT_PROMPTS[role] ?? `Execute ${role} workflow.`,
      );
      results.push(result);
    }

    console.log(`\n[Orchestrator] Cycle #${this.state.cycleCount} complete`);
    console.log(
      `  Results: ${results.filter((r) => r.success).length}/${results.length} successful`,
    );
    this.state.lastCycleAt = new Date().toISOString();
    return results;
  }

  /**
   * Run a specific agent with a prompt.
   */
  async runAgent(role: AgentRole, prompt: string): Promise<AgentResult> {
    const agent = this.agents.get(role);
    if (!agent) {
      return {
        role,
        success: false,
        timestamp: new Date().toISOString(),
        durationMs: 0,
        data: null,
        error: `Agent '${role}' not found`,
      };
    }

    console.log(`[${agent.config.name}] Starting...`);
    this.state.agents[role] = 'running';

    const result = await agent.run(prompt);

    this.state.agents[role] = result.success ? 'idle' : 'error';
    this.state.lastRun[role] = result.timestamp;

    if (result.success) {
      console.log(`[${agent.config.name}] Completed in ${result.durationMs}ms`);
    } else {
      console.log(`[${agent.config.name}] Failed: ${result.error}`);
    }

    return result;
  }

  /**
   * Run research on a specific ticker.
   */
  async research(ticker: string): Promise<AgentResult> {
    return this.runAgent(
      'research',
      `Perform a deep analysis on ${ticker}. Check the current price, volume, technical indicators (RSI, MACD, Bollinger Bands). Identify key support and resistance levels. Assess the trend direction and strength. Provide a comprehensive research report with actionable conclusions.`,
    );
  }

  /**
   * Start automated trading cycles.
   */
  start(intervalMs = 15 * 60 * 1000): void {
    if (this.cycleInterval) {
      console.log('[Orchestrator] Already running');
      return;
    }

    console.log(`[Orchestrator] Starting automated cycles every ${intervalMs / 1000}s`);
    this.runCycle().catch(console.error);
    this.cycleInterval = setInterval(() => {
      this.runCycle().catch(console.error);
    }, intervalMs);
  }

  /**
   * Stop automated cycles.
   */
  stop(): void {
    if (this.cycleInterval) {
      clearInterval(this.cycleInterval);
      this.cycleInterval = null;
      console.log('[Orchestrator] Stopped automated cycles');
    }
  }

  /**
   * Emergency halt — stops all trading activity.
   */
  halt(reason: string): void {
    this.state.halted = true;
    this.stop();
    console.log(`[Orchestrator] HALTED: ${reason}`);
  }

  /**
   * Resume trading after halt.
   */
  resume(): void {
    this.state.halted = false;
    console.log('[Orchestrator] Resumed — halt cleared');
  }

  /**
   * Get agent info for dashboard display.
   */
  getAgentInfo(): Array<{
    role: string;
    name: string;
    description: string;
    status: string;
    lastRun: string | null;
    enabled: boolean;
  }> {
    return Array.from(this.agents.values()).map((agent) => ({
      role: agent.config.role,
      name: agent.config.name,
      description: agent.config.description,
      status: this.state.agents[agent.config.role],
      lastRun: this.state.lastRun[agent.config.role],
      enabled: agent.config.enabled,
    }));
  }
}
