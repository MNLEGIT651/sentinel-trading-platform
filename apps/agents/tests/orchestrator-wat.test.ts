// apps/agents/tests/orchestrator-wat.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'cycle test' }],
          stop_reason: 'end_turn',
        }),
      },
    };
  }),
}));

vi.mock('../src/wat/workflow-loader.js', () => ({
  loadWorkflow: vi.fn().mockReturnValue(null),
  loadCycle: vi.fn().mockReturnValue({
    version: 1,
    sequence: ['market_sentinel', 'strategy_analyst'],
    onDemand: ['research'],
    haltConditions: '',
  }),
}));

vi.mock('../src/engine-client.js', () => ({
  EngineClient: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

vi.mock('../src/tool-executor.js', () => ({
  ToolExecutor: vi.fn().mockImplementation(function () {
    return { execute: vi.fn().mockResolvedValue('{}') };
  }),
}));

vi.mock('../src/tools.js', () => ({
  getToolsForAgent: vi.fn().mockReturnValue([]),
  TOOL_DEFINITIONS: [],
  AGENT_TOOLS: {},
}));

import { Orchestrator } from '../src/orchestrator.js';

describe('Orchestrator with WAT cycle', () => {
  it('uses cycle.md sequence when available', async () => {
    const orch = new Orchestrator({ apiKey: 'test-key' });
    const results = await orch.runCycle();
    expect(results).toHaveLength(2);
    expect(results[0].role).toBe('market_sentinel');
    expect(results[1].role).toBe('strategy_analyst');
  });
});
