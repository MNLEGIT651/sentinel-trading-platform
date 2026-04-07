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
import { getSupabaseClient } from './supabase-client.js';
import { trace, SpanStatusCode, type Span } from '@opentelemetry/api';
import { startCycleWorkflow, recordAgentStepInCycleJob } from './workflows/agent-cycle.js';

const tracer = trace.getTracer('sentinel-agents', '1.0.0');

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
  private cycleInProgress = false;

  constructor(options?: {
    apiKey?: string;
    engineUrl?: string;
    configs?: AgentConfig[];
    /** Inject a pre-built ToolExecutor — used in tests to supply a mock executor. */
    executor?: ToolExecutor;
  }) {
    this.executor = options?.executor ?? new ToolExecutor(new EngineClient(options?.engineUrl));

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
    } catch (err) {
      logger.warn('orchestrator.workflow.fallback', {
        error: err instanceof Error ? err.message : String(err),
      });
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
   * Sync halt state from the system_controls table so DB is the source of truth.
   */
  private async syncHaltStateFromDB(): Promise<void> {
    try {
      const db = getSupabaseClient();
      const { data, error } = await db
        .from('system_controls')
        .select('trading_halted')
        .limit(1)
        .single();
      if (!error && data) {
        this.state.halted = data.trading_halted;
      }
    } catch (err) {
      logger.warn('orchestrator.syncHaltState.failed', { error: String(err) });
    }
  }

  /**
   * Run a single trading cycle: market → strategy → risk → execute.
   */
  async runCycle(): Promise<AgentResult[]> {
    if (this.cycleInProgress) {
      logger.warn('orchestrator.cycle.skipped', { reason: 'in_progress' });
      return [];
    }

    await this.syncHaltStateFromDB();

    if (this.state.halted) {
      logger.warn('orchestrator.cycle.skipped', { reason: 'halted' });
      return [];
    }

    this.cycleInProgress = true;
    try {
      this.state.cycleCount++;
      const results: AgentResult[] = [];
      logger.info('orchestrator.cycle.start', { cycleCount: this.state.cycleCount });

      // Create a workflow job to track this cycle (fire-and-forget on failure)
      let cycleJobId: string | null = null;
      try {
        cycleJobId = await startCycleWorkflow({
          cycleCount: this.state.cycleCount,
          sequence: [...this.cycleSequence],
        });
      } catch (err) {
        logger.warn('orchestrator.cycle.workflow_job.failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      return await tracer.startActiveSpan(
        'orchestrator.runCycle',
        { attributes: { 'cycle.count': this.state.cycleCount } },
        async (span: Span) => {
          try {
            for (const role of this.cycleSequence) {
              if (this.state.halted) {
                logger.warn('orchestrator.agent.skipped', { role, reason: 'halted' });
                continue;
              }
              const result = await this.runAgent(
                role,
                DEFAULT_AGENT_PROMPTS[role] ?? `Execute ${role} workflow.`,
              );
              results.push(result);

              // Record each agent result in the cycle workflow job
              if (cycleJobId) {
                void recordAgentStepInCycleJob(cycleJobId, role, {
                  success: result.success,
                  durationMs: result.durationMs,
                  error: result.error,
                }).catch((err: unknown) => {
                  logger.warn('orchestrator.record_step.failed', {
                    cycleJobId,
                    role,
                    error: err instanceof Error ? err.message : String(err),
                  });
                });
              }
            }

            const successCount = results.filter((r) => r.success).length;
            logger.info('orchestrator.cycle.complete', {
              cycleCount: this.state.cycleCount,
              successCount,
              totalCount: results.length,
              cycleJobId,
            });
            this.state.lastCycleAt = new Date().toISOString();

            span.setAttributes({
              'cycle.success_count': successCount,
              'cycle.total_count': results.length,
            });
            span.setStatus({ code: SpanStatusCode.OK });
            return results;
          } catch (err) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: err instanceof Error ? err.message : String(err),
            });
            span.recordException(err instanceof Error ? err : new Error(String(err)));
            throw err;
          } finally {
            span.end();
          }
        },
      );
    } finally {
      this.cycleInProgress = false;
    }
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

    return tracer.startActiveSpan(
      `agent.run.${role}`,
      { attributes: { 'agent.role': role, 'agent.name': agent.config.name } },
      async (span: Span) => {
        logger.info('agent.start', { role, name: agent.config.name });
        this.state.agents[role] = 'running';

        const result = await agent.run(prompt);

        this.state.agents[role] = result.success ? 'idle' : 'error';
        this.state.lastRun[role] = result.timestamp;

        if (result.success) {
          logger.info('agent.complete', {
            role,
            name: agent.config.name,
            durationMs: result.durationMs,
          });
          span.setAttributes({ 'agent.duration_ms': result.durationMs });
          span.setStatus({ code: SpanStatusCode.OK });
        } else {
          logger.error('agent.failed', { role, name: agent.config.name, error: result.error });
          span.setStatus({ code: SpanStatusCode.ERROR, message: result.error ?? 'unknown' });
        }

        span.end();
        return result;
      },
    );
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
    this.runCycle().catch((err) =>
      logger.error('Cycle error', { error: err instanceof Error ? err.message : String(err) }),
    );
    this.cycleInterval = setInterval(() => {
      this.runCycle().catch((err) =>
        logger.error('Cycle error', { error: err instanceof Error ? err.message : String(err) }),
      );
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
   * Emergency halt — stops all trading activity and persists to DB.
   */
  async halt(reason: string): Promise<void> {
    this.state.halted = true;
    this.stop();
    logger.error('orchestrator.halt', { reason });
    try {
      const db = getSupabaseClient();
      await db
        .from('system_controls')
        .update({ trading_halted: true, updated_at: new Date().toISOString() })
        .neq('id', '');
    } catch (err) {
      logger.warn('orchestrator.halt.dbWrite.failed', { error: String(err) });
    }
  }

  /**
   * Resume trading after halt and persist to DB.
   */
  async resume(): Promise<void> {
    this.state.halted = false;
    logger.info('orchestrator.resume');
    try {
      const db = getSupabaseClient();
      await db
        .from('system_controls')
        .update({ trading_halted: false, updated_at: new Date().toISOString() })
        .neq('id', '');
    } catch (err) {
      logger.warn('orchestrator.resume.dbWrite.failed', { error: String(err) });
    }
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
