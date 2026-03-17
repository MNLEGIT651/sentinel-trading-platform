// apps/agents/tests/wat/self-improver.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SelfImprover } from '../../src/wat/self-improver.js';
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TMP_DIR = join(import.meta.dirname, '../../.tmp/test-self-improve');

function writeWorkflow(content: string) {
  writeFileSync(join(TMP_DIR, 'market_sentinel.md'), content, 'utf-8');
}

const SAMPLE_WORKFLOW = `---
name: Market Sentinel
role: market_sentinel
description: Monitors market conditions
schedule: every 5 minutes
cooldown_ms: 300000
enabled: true
tools:
  - get_market_data
version: 1
last_updated_by: human
---

# Market Sentinel

## Learnings
<!-- Auto-updated by self-improvement loop -->
`;

describe('SelfImprover', () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
    process.env.WAT_SELF_IMPROVE_GIT = 'false';
  });
  afterEach(() => rmSync(TMP_DIR, { recursive: true, force: true }));

  it('appends a learning to the ## Learnings section', async () => {
    writeWorkflow(SAMPLE_WORKFLOW);
    const improver = new SelfImprover(TMP_DIR);
    const updated = await improver.addLearning(
      'market_sentinel',
      'API rate limit is 60 requests per minute',
    );
    expect(updated).toBe(true);

    const content = readFileSync(join(TMP_DIR, 'market_sentinel.md'), 'utf-8');
    expect(content).toContain('API rate limit is 60 requests per minute');
    expect(content).toContain('version: 2');
    expect(content).toContain('last_updated_by: agent');
  });

  it('returns false if workflow file does not exist', async () => {
    const improver = new SelfImprover(TMP_DIR);
    const updated = await improver.addLearning('nonexistent' as any, 'test');
    expect(updated).toBe(false);
  });

  it('preserves existing learnings when adding new ones', async () => {
    const withExisting = SAMPLE_WORKFLOW.replace(
      '<!-- Auto-updated by self-improvement loop -->',
      '<!-- Auto-updated by self-improvement loop -->\n- Previous learning here',
    );
    writeWorkflow(withExisting);
    const improver = new SelfImprover(TMP_DIR);
    await improver.addLearning('market_sentinel', 'New learning');

    const content = readFileSync(join(TMP_DIR, 'market_sentinel.md'), 'utf-8');
    expect(content).toContain('Previous learning here');
    expect(content).toContain('New learning');
  });
});
