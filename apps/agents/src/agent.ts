/**
 * Base Agent class — wraps the Claude API with tool calling.
 *
 * Each agent is initialized with a system prompt defining its role,
 * a set of allowed tools, and an agentic loop that handles
 * multi-turn tool-use conversations.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AgentConfig, AgentResult, AgentRole } from './types.js';
import { getToolsForAgent } from './tools.js';
import { ToolExecutor } from './tool-executor.js';
import { loadWorkflow } from './wat/workflow-loader.js';
import { logger } from './logger.js';

const SYSTEM_PROMPTS: Record<AgentRole, string> = {
  market_sentinel: `You are the Market Sentinel agent for the Sentinel Trading Platform.
Your role is to monitor market conditions, detect significant events, and alert the team.

Responsibilities:
- Monitor price action across the watchlist
- Detect unusual volume or volatility
- Identify market regime changes (trending/ranging/crisis)
- Generate alerts for significant market events
- Track sector rotation and inter-market relationships

Always use your tools to gather data before making assessments.
Be concise and data-driven in your analysis.
Focus on actionable insights, not speculation.`,

  strategy_analyst: `You are the Strategy Analyst agent for the Sentinel Trading Platform.
Your role is to run trading strategies, analyze signals, and recommend trades.

Responsibilities:
- Run strategy scans across the instrument universe
- Evaluate signal quality and conviction
- Identify the strongest trade setups
- Provide detailed reasoning for each recommendation
- Consider correlation between signals (avoid overlapping risk)

Prioritize signal quality over quantity. Only recommend trades with clear edge.
Consider risk-reward ratio for every recommendation.`,

  risk_monitor: `You are the Risk Monitor agent for the Sentinel Trading Platform.
Your role is to continuously monitor portfolio risk and enforce risk limits.

Responsibilities:
- Check portfolio drawdown against circuit breaker levels (10% soft, 15% hard)
- Monitor position concentration (max 5% per position)
- Track sector exposure (max 20% per sector)
- Enforce daily loss limits (2% of equity)
- Calculate appropriate position sizes for new trades
- HALT all trading if circuit breaker is triggered

You are the guardian of capital. When in doubt, err on the side of caution.
Never approve a trade that violates risk limits.`,

  research: `You are the Research agent for the Sentinel Trading Platform.
Your role is to perform deep analysis on specific tickers and market themes.

Responsibilities:
- Analyze individual stocks with technical and contextual analysis
- Identify support/resistance levels
- Assess trend strength and momentum
- Evaluate volume patterns
- Provide comprehensive research reports

Be thorough but concise. Focus on actionable research that helps trading decisions.
Support your conclusions with data from your tools.`,

  execution_monitor: `You are the Execution Monitor agent for the Sentinel Trading Platform.
Your role is to manage trade execution, monitor order status, and report on fills.

Responsibilities:
- Execute approved trades via the broker interface
- Monitor order fill quality (slippage analysis)
- Track order status and handle partial fills
- Report execution quality metrics
- Ensure all trades pass risk checks before execution

Always run risk checks before submitting orders.
Report any execution anomalies immediately via alerts.`,
};

export class Agent {
  private client: Anthropic;
  private executor: ToolExecutor;
  readonly config: AgentConfig;

  constructor(
    config: AgentConfig,
    options?: {
      apiKey?: string;
      executor?: ToolExecutor;
    },
  ) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: options?.apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
    this.executor = options?.executor ?? new ToolExecutor();
  }

  /**
   * Run the agent with a user prompt.
   * Implements an agentic loop: Claude responds → tool calls → execute → loop.
   */
  async run(userPrompt: string, maxTurns = 10): Promise<AgentResult> {
    const startTime = Date.now();
    const tools = getToolsForAgent(this.config.role);
    const workflow = loadWorkflow(this.config.role);
    if (!workflow) {
      logger.warn('agent.workflow.missing', {
        role: this.config.role,
        message: `No WAT workflow file found for ${this.config.role} — using built-in system prompt.`,
      });
    }
    const systemPrompt = workflow?.systemPrompt ?? SYSTEM_PROMPTS[this.config.role];

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];

    let lastTextResponse = '';

    for (let turn = 0; turn < maxTurns; turn++) {
      let response: Anthropic.Message;
      try {
        response = await this.client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          tools,
          messages,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          role: this.config.role,
          success: false,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          data: null,
          error: `API error: ${message}`,
        };
      }

      // Collect text blocks
      for (const block of response.content) {
        if (block.type === 'text') {
          lastTextResponse = block.text;
        }
      }

      // If no tool use, we're done
      if (response.stop_reason === 'end_turn') {
        break;
      }

      // Process tool calls
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      if (toolUseBlocks.length === 0) {
        break;
      }

      // Add assistant message with tool calls
      messages.push({ role: 'assistant', content: response.content });

      // Execute tools and add results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolBlock of toolUseBlocks) {
        const result = await this.executor.execute(
          toolBlock.name,
          toolBlock.input as Record<string, unknown>,
        );
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: result,
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }

    return {
      role: this.config.role,
      success: true,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      data: lastTextResponse,
    };
  }
}
