// apps/agents/tests/wat/tool-registry.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../../src/wat/tool-registry.js';

vi.mock('../../src/wat/python-runner.js', () => ({
  runPythonTool: vi.fn().mockResolvedValue('{"result": "from-python"}'),
}));

const mockTsExecutor = {
  execute: vi.fn().mockResolvedValue('{"result": "from-ts"}'),
};

describe('ToolRegistry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('routes to TypeScript executor for known TS tools', async () => {
    const registry = new ToolRegistry(mockTsExecutor as any);
    const result = await registry.execute('create_alert', {
      severity: 'info',
      title: 'test',
      message: 'msg',
    });
    expect(mockTsExecutor.execute).toHaveBeenCalledWith('create_alert', expect.any(Object));
    expect(result).toBe('{"result": "from-ts"}');
  });

  it('routes to Python runner when schema exists', async () => {
    const { runPythonTool } = await import('../../src/wat/python-runner.js');
    const registry = new ToolRegistry(mockTsExecutor as any, undefined, [
      {
        name: 'analyze_ticker_py',
        description: 'Python analysis',
        input_schema: { type: 'object', properties: {} },
        scriptPath: 'analyze_ticker.py',
      },
    ]);
    const result = await registry.execute('analyze_ticker_py', { ticker: 'AAPL' });
    expect(runPythonTool).toHaveBeenCalled();
    expect(result).toBe('{"result": "from-python"}');
  });

  it('returns error for unknown tool', async () => {
    const registry = new ToolRegistry(mockTsExecutor as any);
    const result = await registry.execute('nonexistent', {});
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('Unknown tool');
  });

  it('filters tools by allowed list', async () => {
    const registry = new ToolRegistry(mockTsExecutor as any);
    const tools = registry.getToolsForAgent(['get_market_data', 'create_alert']);
    expect(tools.every((t) => ['get_market_data', 'create_alert'].includes(t.name))).toBe(true);
  });
});
