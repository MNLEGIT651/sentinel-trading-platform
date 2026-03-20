// apps/agents/tests/wat/audit-logger.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuditLogger } from '../../src/wat/audit-logger.js';
import { existsSync, readFileSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../../src/supabase-client.js', () => ({
  getSupabaseClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

const TMP_DIR = join(import.meta.dirname, '../../.tmp/test-audit');

describe('AuditLogger', () => {
  beforeEach(() => mkdirSync(TMP_DIR, { recursive: true }));
  afterEach(() => rmSync(TMP_DIR, { recursive: true, force: true }));

  it('writes a local trace file on endRun', async () => {
    const logger = new AuditLogger(TMP_DIR);
    logger.startRun({ cycle_number: 1, agent_role: 'market_sentinel', workflow_version: 1 });
    logger.logToolCall({
      toolName: 'get_market_data',
      input: { tickers: ['AAPL'] },
      output: '{"prices":{}}',
      durationMs: 150,
      source: 'typescript',
    });
    await logger.endRun({ success: true, summary: 'All good' });

    const files = readdirSync(TMP_DIR);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/cycle-1/);

    const trace = JSON.parse(readFileSync(join(TMP_DIR, files[0]), 'utf-8'));
    expect(trace.agent_role).toBe('market_sentinel');
    expect(trace.tools_called).toHaveLength(1);
    expect(trace.success).toBe(true);
  });

  it('logs workflow updates', async () => {
    const logger = new AuditLogger(TMP_DIR);
    logger.startRun({ cycle_number: 2, agent_role: 'risk_monitor', workflow_version: 3 });
    logger.logWorkflowUpdate('Added learning about API rate limit');
    await logger.endRun({ success: true, summary: 'Done' });

    const files = readdirSync(TMP_DIR);
    const trace = JSON.parse(readFileSync(join(TMP_DIR, files[0]), 'utf-8'));
    expect(trace.workflow_updates_made).toContain('Added learning about API rate limit');
  });
});
