// apps/agents/tests/agent-wat.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'test response' }],
        stop_reason: 'end_turn',
      }),
    },
  })),
}));

vi.mock('../src/wat/workflow-loader.js', () => ({
  loadWorkflow: vi.fn().mockReturnValue({
    role: 'market_sentinel',
    name: 'Market Sentinel',
    systemPrompt: 'You are the WAT-loaded Market Sentinel.',
    tools: ['get_market_data'],
    cooldownMs: 300000,
    enabled: true,
    version: 1,
    lastUpdatedBy: 'human',
    description: 'test',
    schedule: 'test',
    filePath: '/test',
  }),
}));

vi.mock('../src/tools.js', () => ({
  getToolsForAgent: vi.fn().mockReturnValue([]),
  TOOL_DEFINITIONS: [],
  AGENT_TOOLS: {},
}));

vi.mock('../src/tool-executor.js', () => ({
  ToolExecutor: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue('{}'),
  })),
}));

import { Agent } from '../src/agent.js';
import Anthropic from '@anthropic-ai/sdk';

describe('Agent with WAT workflow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses system prompt from workflow-loader when available', async () => {
    const agent = new Agent(
      {
        role: 'market_sentinel',
        name: 'Market Sentinel',
        description: 'test',
        schedule: 'test',
        enabled: true,
        cooldownMs: 300000,
      },
      { apiKey: 'test-key' },
    );
    await agent.run('test prompt');

    const mockCreate = (Anthropic as unknown as ReturnType<typeof vi.fn>).mock.results[0].value
      .messages.create;
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'You are the WAT-loaded Market Sentinel.',
      }),
    );
  });
});
