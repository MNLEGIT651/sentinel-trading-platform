// apps/agents/tests/wat/workflow-loader.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadWorkflow, loadCycle } from '../../src/wat/workflow-loader.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TMP_DIR = join(import.meta.dirname, '../../.tmp/test-workflows');

function writeWorkflow(name: string, content: string) {
  writeFileSync(join(TMP_DIR, name), content, 'utf-8');
}

describe('loadWorkflow', () => {
  beforeEach(() => mkdirSync(TMP_DIR, { recursive: true }));
  afterEach(() => rmSync(TMP_DIR, { recursive: true, force: true }));

  it('parses frontmatter and markdown body into WorkflowConfig', () => {
    writeWorkflow(
      'market_sentinel.md',
      `---
name: Market Sentinel
role: market_sentinel
description: Monitors market conditions
schedule: every 5 minutes during market hours
cooldown_ms: 300000
enabled: true
tools:
  - get_market_data
  - get_market_sentiment
  - create_alert
version: 1
last_updated_by: human
---

# Market Sentinel Workflow

## Objective
Monitor market conditions across the watchlist.

## Steps
1. Fetch prices using \`get_market_data\`
`,
    );
    const config = loadWorkflow('market_sentinel', TMP_DIR);
    expect(config).not.toBeNull();
    expect(config!.role).toBe('market_sentinel');
    expect(config!.name).toBe('Market Sentinel');
    expect(config!.cooldownMs).toBe(300000);
    expect(config!.tools).toEqual(['get_market_data', 'get_market_sentiment', 'create_alert']);
    expect(config!.version).toBe(1);
    expect(config!.lastUpdatedBy).toBe('human');
    expect(config!.systemPrompt).toContain('# Market Sentinel Workflow');
    expect(config!.systemPrompt).toContain('Fetch prices');
  });

  it('returns null for missing workflow file', () => {
    const config = loadWorkflow('market_sentinel', TMP_DIR);
    expect(config).toBeNull();
  });

  it('returns null for malformed frontmatter', () => {
    writeWorkflow(
      'market_sentinel.md',
      `---
this is not: [valid: yaml: {
---
body text`,
    );
    const config = loadWorkflow('market_sentinel', TMP_DIR);
    expect(config).toBeNull();
  });
});

describe('loadCycle', () => {
  beforeEach(() => mkdirSync(TMP_DIR, { recursive: true }));
  afterEach(() => rmSync(TMP_DIR, { recursive: true, force: true }));

  it('parses sequence, on-demand agents, and halt conditions', () => {
    writeWorkflow(
      'cycle.md',
      `---
name: Trading Cycle
version: 1
---

# Trading Cycle

## Sequence
1. market_sentinel — assess market conditions
2. strategy_analyst — generate signals
3. risk_monitor — check portfolio risk
4. execution_monitor — execute approved trades

## Halt Conditions
- If risk_monitor sets halted=true, skip execution_monitor

## On-Demand Agents
- research — triggered by specific ticker requests
`,
    );
    const cycle = loadCycle(TMP_DIR);
    expect(cycle.version).toBe(1);
    expect(cycle.sequence).toEqual([
      'market_sentinel',
      'strategy_analyst',
      'risk_monitor',
      'execution_monitor',
    ]);
    expect(cycle.onDemand).toEqual(['research']);
    expect(cycle.haltConditions).toContain('halted=true');
  });

  it('throws if cycle.md is missing', () => {
    expect(() => loadCycle(TMP_DIR)).toThrow();
  });
});

describe('real workflow files', () => {
  const realDir = join(import.meta.dirname, '../../workflows');

  it('loads all 5 agent workflows', () => {
    const roles = [
      'market_sentinel',
      'strategy_analyst',
      'risk_monitor',
      'research',
      'execution_monitor',
    ] as const;
    for (const role of roles) {
      const wf = loadWorkflow(role, realDir);
      expect(wf, `${role} should parse`).not.toBeNull();
      expect(wf!.role).toBe(role);
      expect(wf!.tools.length).toBeGreaterThan(0);
    }
  });

  it('loads cycle.md with 4 in-cycle and 3 on-demand', () => {
    const cycle = loadCycle(realDir);
    expect(cycle.sequence).toHaveLength(4);
    expect(cycle.onDemand).toEqual(['research', 'pr_manager', 'workflow_manager']);
  });
});
