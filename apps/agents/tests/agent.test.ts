import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent } from '../src/agent.js';
import { ToolExecutor } from '../src/tool-executor.js';

// ---------------------------------------------------------------------------
// Module mock — hoisted so vi.mock factory can reference mockCreate
// ---------------------------------------------------------------------------

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TextBlock = { type: 'text'; text: string };
type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: object };
type ContentBlock = TextBlock | ToolUseBlock;

function makeTextBlock(text: string): TextBlock {
  return { type: 'text', text };
}

function makeToolUseBlock(id: string, name: string, input: object): ToolUseBlock {
  return { type: 'tool_use', id, name, input };
}

type StopReason = 'end_turn' | 'tool_use' | 'max_tokens';

function makeMessage(
  content: ContentBlock[],
  stop_reason: StopReason = 'end_turn',
): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: content as Anthropic.ContentBlock[],
    model: 'claude-sonnet-4-20250514',
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 20 },
  };
}

const baseConfig = (role: Parameters<typeof Agent>[0]['role']) =>
  ({
    role,
    name: 'Test',
    description: 'Test agent',
    schedule: 'every 15 minutes',
    enabled: true,
    cooldownMs: 0,
  }) as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Agent constructor', () => {
  it('stores the config', () => {
    const agent = new Agent(baseConfig('market_sentinel'), {
      apiKey: 'k',
      executor: new ToolExecutor(),
    });
    expect(agent.config.role).toBe('market_sentinel');
    expect(agent.config.name).toBe('Test');
  });
});

describe('Agent.run — happy path', () => {
  let mockExecutor: ToolExecutor;

  beforeEach(() => {
    mockCreate.mockReset();
    mockExecutor = new ToolExecutor();
    vi.spyOn(mockExecutor, 'execute').mockResolvedValue('{}');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns success result with text response', async () => {
    mockCreate.mockResolvedValue(makeMessage([makeTextBlock('Market is stable.')]));

    const agent = new Agent(baseConfig('market_sentinel'), {
      apiKey: 'key',
      executor: mockExecutor,
    });
    const result = await agent.run('Check market conditions');

    expect(result.success).toBe(true);
    expect(result.role).toBe('market_sentinel');
    expect(result.data).toBe('Market is stable.');
    expect(result.error).toBeUndefined();
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('iterates through tool calls then returns final text', async () => {
    mockCreate
      .mockResolvedValueOnce(
        makeMessage(
          [makeToolUseBlock('tool-1', 'get_market_data', { tickers: ['SPY'] })],
          'tool_use',
        ),
      )
      .mockResolvedValueOnce(makeMessage([makeTextBlock('SPY is up 1%.')], 'end_turn'));

    const agent = new Agent(baseConfig('market_sentinel'), {
      apiKey: 'key',
      executor: mockExecutor,
    });
    const result = await agent.run('Analyse market');

    expect(result.success).toBe(true);
    expect(result.data).toBe('SPY is up 1%.');
    expect(mockExecutor.execute).toHaveBeenCalledWith('get_market_data', { tickers: ['SPY'] });
    // Claude called twice: once for tool use, once for final answer
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('respects maxTurns limit', async () => {
    // Always returns tool_use — should stop after maxTurns
    mockCreate.mockResolvedValue(
      makeMessage([makeToolUseBlock('tool-x', 'get_market_data', {})], 'tool_use'),
    );

    const agent = new Agent(baseConfig('market_sentinel'), {
      apiKey: 'key',
      executor: mockExecutor,
    });
    const result = await agent.run('Loop forever', 3);

    expect(result.success).toBe(true);
    // maxTurns = 3 means at most 3 API calls
    expect(mockCreate.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('captures last text block when multiple text blocks exist', async () => {
    mockCreate.mockResolvedValue(
      makeMessage([makeTextBlock('First thought.'), makeTextBlock('Final answer.')]),
    );

    const agent = new Agent(baseConfig('strategy_analyst'), {
      apiKey: 'key',
      executor: mockExecutor,
    });
    const result = await agent.run('Analyse strategies');

    // The last text block is returned as the result
    expect(result.data).toBe('Final answer.');
    // The entire response content (including both blocks) is passed to the API
    // The first call receives the user message
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'Analyse strategies' }),
        ]),
      }),
    );
  });

  it('includes timestamp in ISO format', async () => {
    mockCreate.mockResolvedValue(makeMessage([makeTextBlock('ok')]));

    const agent = new Agent(baseConfig('risk_monitor'), { apiKey: 'key', executor: mockExecutor });
    const result = await agent.run('Check risk');

    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});

describe('Agent.run — error handling', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('returns failure result when Anthropic API throws', async () => {
    mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

    const agent = new Agent(baseConfig('research'), {
      apiKey: 'key',
      executor: new ToolExecutor(),
    });
    const result = await agent.run('Run research');

    expect(result.success).toBe(false);
    expect(result.error).toContain('API rate limit exceeded');
    expect(result.data).toBeNull();
  });

  it('handles non-Error thrown objects', async () => {
    mockCreate.mockRejectedValue('string error');

    const agent = new Agent(baseConfig('execution_monitor'), {
      apiKey: 'key',
      executor: new ToolExecutor(),
    });
    const result = await agent.run('Monitor execution');

    expect(result.success).toBe(false);
    expect(result.error).toContain('string error');
  });

  it('breaks loop when no tool_use blocks but stop_reason is not end_turn', async () => {
    // Message with only text content but no tool_use blocks
    mockCreate.mockResolvedValue(makeMessage([makeTextBlock('Done with no tools.')], 'max_tokens'));

    const agent = new Agent(baseConfig('market_sentinel'), {
      apiKey: 'key',
      executor: new ToolExecutor(),
    });
    const result = await agent.run('Check market');

    // Should complete successfully since no tool_use blocks means we break
    expect(result.success).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

describe('Agent roles', () => {
  const roles = [
    'market_sentinel',
    'strategy_analyst',
    'risk_monitor',
    'research',
    'execution_monitor',
  ] as const;

  it.each(roles)('creates agent with role %s', (role) => {
    const agent = new Agent(baseConfig(role), { apiKey: 'key', executor: new ToolExecutor() });
    expect(agent.config.role).toBe(role);
  });
});
