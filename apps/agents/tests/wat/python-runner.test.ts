// apps/agents/tests/wat/python-runner.test.ts
import { describe, it, expect } from 'vitest';
import { runPythonTool } from '../../src/wat/python-runner.js';
import { join } from 'node:path';

const TOOLS_DIR = join(import.meta.dirname, '../../tools');

describe('runPythonTool', () => {
  it('executes a Python script and returns JSON output', async () => {
    const result = await runPythonTool('echo', { hello: 'world' }, TOOLS_DIR);
    const parsed = JSON.parse(result);
    expect(parsed.echoed).toEqual({ hello: 'world' });
    expect(parsed.source).toBe('python');
  });

  it('returns error JSON for non-existent script', async () => {
    const result = await runPythonTool('nonexistent', {}, TOOLS_DIR);
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeDefined();
  });
});
