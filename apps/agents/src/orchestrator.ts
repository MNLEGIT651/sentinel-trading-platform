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
import {
  DEFAULT_AGENT_PROMPTS,
  DEFAULT_CYCLE_INTERVAL_MS,
  EXECUTION_MONITOR_COOLDOWN_MS,
  MARKET_SENTINEL_COOLDOWN_MS,
  RESEARCH_COOLDOWN_MS,
  RISK_MONITOR_COOLDOWN_MS,
  STRATEGY_ANALYST_COOLDOWN_MS,
} from './config.js';
import { logger } from './logger.js';

const DEFAULT_CONFIGS: AgentConfig[] = [
  {
    role: 'market_sentinel',
    name: 'Market Sentinel',
    description: 'Monitors market conditions and detects significant events',
    schedule: 'every 5 minutes during market hours',
    enabled: true,
    cooldownMs: MARKET_SENTINEL_COOLDOWN_MS,
  },
  {
    role: 'strategy_analyst',
    name: 'Strategy Analyst',
    description: 'Runs trading strategies and recommends trades',
    schedule: 'every 15 minutes during market hours',
    enabled: true,
    cooldownMs: STRATEGY_ANALYST_COOLDOWN_MS,
  },
  {
    role: 'risk_monitor',
    name: 'Risk Monitor',
    description: 'Monitors portfolio risk and enforces limits',
    schedule: 'every 1 minute during market hours',
    enabled: true,
    cooldownMs: RISK_MONITOR_COOLDOWN_MS,
  },
  {
    role: 'research',
    name: 'Research Analyst',
    description: 'Performs deep analysis on specific tickers',
    schedule: 'on demand',
    enabled: true,
    cooldownMs: RESEARCH_COOLDOWN_MS,
  },
  {
    role: 'execution_monitor',
    name: 'Execution Monitor',
    description: 'Manages trade execution and monitors order status',
    schedule: 'on demand',
    enabled: true,
    cooldownMs: EXECUTION_MONITOR_COOLDOWN_MS,
  },
];

export class Orchestrator {
  private agents: Map<AgentRole, Agent> = new Map();
  private state: OrchestratorState;
  private executor: ToolExecutor;
  private cycleInterval: ReturnType<typeof setInterval> | null = null;
  private cycleSequence: AgentRole[];

  constructor(options?: {
    apiKey?: string;
    engineUrl?: string;
    configs?: AgentConfig[];
    /** Inject a pre-built ToolExecutor — used in tests to supply a mock executor. */
    executor?: ToolExecutor;
  }) {
    this.executor =
      options?.executor ?? new ToolExecutor(new EngineClient(options?.engineUrl));

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
      logger.warn('orchestrator.cycle.skipped', { reason: 'halted' });
      return [];
    }

    this.state.cycleCount++;
    const results: AgentResult[] = [];
    logger.info('orchestrator.cycle.start', { cycleCount: this.state.cycleCount });

    for (const role of this.cycleSequence) {
      if (this.state.halted && role === 'execution_monitor') {
        logger.warn('orchestrator.agent.skipped', { role, reason: 'halted' });
        continue;
      }
      const result = await this.runAgent(
        role,
        DEFAULT_AGENT_PROMPTS[role] ?? `Execute ${role} workflow.`,
      );
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    logger.info('orchestrator.cycle.complete', {
      cycleCount: this.state.cycleCount,
      successCount,
      totalCount: results.length,
    });
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

    logger.info('agent.start', { role, name: agent.config.name });
    this.state.agents[role] = 'running';

    const result = await agent.run(prompt);

    this.state.agents[role] = result.success ? 'idle' : 'error';
    this.state.lastRun[role] = result.timestamp;

    if (result.success) {
      logger.info('agent.complete', { role, name: agent.config.name, durationMs: result.durationMs });
    } else {
      logger.error('agent.failed', { role, name: agent.config.name, error: result.error });
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
  start(intervalMs = DEFAULT_CYCLE_INTERVAL_MS): void {
    if (this.cycleInterval) {
      logger.warn('orchestrator.start.noop', { reason: 'already running' });
      return;
    }

    logger.info('orchestrator.start', { intervalMs });
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
      logger.info('orchestrator.stop');
    }
  }

  /**
   * Emergency halt — stops all trading activity.
   */
  halt(reason: string): void {
    this.state.halted = true;
    this.stop();
    logger.error('orchestrator.halt', { reason });
  }

  /**
   * Resume trading after halt.
   */
  resume(): void {
    this.state.halted = false;
    logger.info('orchestrator.resume');
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
