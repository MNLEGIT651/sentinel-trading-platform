# WAT Framework Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the WAT (Workflows, Agents, Tools) framework into `apps/agents` so agent behavior is driven by editable markdown SOPs, tools are hybrid TS+Python, and every run is audited.

**Architecture:** New `src/wat/` module provides workflow loading, tool registry, audit logging, and self-improvement. Existing agent code migrates progressively — one agent at a time. Workflow markdown files become the single source of truth for agent behavior.

**Tech Stack:** TypeScript (vitest, yaml), Python (subprocess), Supabase (audit table), Anthropic SDK (existing)

**Spec:** `docs/superpowers/specs/2026-03-17-wat-framework-integration-design.md`

---

## File Map

### New files to create

| File                                              | Responsibility                                             |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `apps/agents/src/wat/types.ts`                    | WAT-specific type definitions                              |
| `apps/agents/src/wat/workflow-loader.ts`          | Parse workflow markdown → `WorkflowConfig` / `CycleConfig` |
| `apps/agents/src/wat/tool-registry.ts`            | Unified tool registry (TS + Python), per-agent filtering   |
| `apps/agents/src/wat/python-runner.ts`            | Execute Python tools via subprocess                        |
| `apps/agents/src/wat/audit-logger.ts`             | Dual logging: Supabase `workflow_runs` + `.tmp/runs/` JSON |
| `apps/agents/src/wat/self-improver.ts`            | Auto-update workflow `## Learnings` section                |
| `apps/agents/workflows/cycle.md`                  | Master cycle: agent order, halt conditions, on-demand list |
| `apps/agents/workflows/market_sentinel.md`        | Market Sentinel SOP                                        |
| `apps/agents/workflows/strategy_analyst.md`       | Strategy Analyst SOP                                       |
| `apps/agents/workflows/risk_monitor.md`           | Risk Monitor SOP                                           |
| `apps/agents/workflows/research.md`               | Research Analyst SOP                                       |
| `apps/agents/workflows/execution_monitor.md`      | Execution Monitor SOP                                      |
| `apps/agents/tests/wat/workflow-loader.test.ts`   | Tests for workflow + cycle parsing                         |
| `apps/agents/tests/wat/tool-registry.test.ts`     | Tests for tool routing + permission filtering              |
| `apps/agents/tests/wat/python-runner.test.ts`     | Tests for Python subprocess execution                      |
| `apps/agents/tests/wat/audit-logger.test.ts`      | Tests for dual audit logging                               |
| `apps/agents/tests/wat/self-improver.test.ts`     | Tests for workflow auto-update                             |
| `apps/agents/tools/echo.py`                       | Test-only echo script for python-runner integration test   |
| `apps/agents/tools/analyze_ticker.py`             | Python: deep technical analysis                            |
| `apps/agents/tools/analyze_ticker.schema.json`    | Anthropic Tool schema for analyze_ticker                   |
| `apps/agents/tools/run_strategy_scan.py`          | Python: strategy scanning                                  |
| `apps/agents/tools/run_strategy_scan.schema.json` | Anthropic Tool schema for run_strategy_scan                |
| `apps/agents/tools/assess_risk.py`                | Python: risk assessment                                    |
| `apps/agents/tools/assess_risk.schema.json`       | Anthropic Tool schema for assess_risk                      |
| `supabase/migrations/00004_workflow_runs.sql`     | `workflow_runs` table + indexes                            |

### Existing files to modify

| File                              | Change                                                                 |
| --------------------------------- | ---------------------------------------------------------------------- |
| `apps/agents/package.json`        | Add `yaml` dependency                                                  |
| `apps/agents/src/agent.ts`        | Try workflow-loader first, fall back to hardcoded prompt               |
| `apps/agents/src/orchestrator.ts` | Read `cycle.md` for sequence, use `ToolRegistry`, wire audit logger    |
| `apps/agents/src/tools.ts`        | Export `TOOL_DEFINITIONS` and `AGENT_TOOLS` (no removal yet — Phase 5) |
| `.gitignore`                      | Add `apps/agents/.tmp/`                                                |

---

## Task 1: WAT Types

**Files:**

- Create: `apps/agents/src/wat/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// apps/agents/src/wat/types.ts
import type { AgentRole } from '../types.js';

/** Parsed workflow file — one per agent */
export interface WorkflowConfig {
  role: AgentRole;
  name: string;
  description: string;
  schedule: string;
  cooldownMs: number;
  enabled: boolean;
  tools: string[];
  version: number;
  lastUpdatedBy: 'human' | 'agent';
  systemPrompt: string;
  filePath: string;
}

/** Parsed cycle.md */
export interface CycleConfig {
  version: number;
  sequence: AgentRole[];
  onDemand: AgentRole[];
  haltConditions: string;
}

/** Python tool metadata — from companion .schema.json files */
export interface PythonToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  scriptPath: string;
}

/** Single tool call trace entry */
export interface ToolCallTrace {
  toolName: string;
  input: Record<string, unknown>;
  output: string;
  durationMs: number;
  source: 'typescript' | 'python';
}

/** Audit record written to Supabase */
export interface WorkflowRunRecord {
  cycle_number: number;
  agent_role: string;
  workflow_version: number;
  started_at: string;
  finished_at: string | null;
  success: boolean;
  summary: string | null;
  tools_called: ToolCallTrace[];
  workflow_updates_made: string[];
  error: string | null;
}

/** Full local trace (superset of WorkflowRunRecord) */
export interface WorkflowRunTrace extends WorkflowRunRecord {
  llm_transcript: Array<{ role: string; content: unknown }>;
  workflow_file_snapshot: string;
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/agents && npx tsc --noEmit src/wat/types.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/agents/src/wat/types.ts
git commit -m "feat(wat): add WAT type definitions"
```

---

## Task 2: Workflow Loader

**Files:**

- Create: `apps/agents/tests/wat/workflow-loader.test.ts`
- Create: `apps/agents/src/wat/workflow-loader.ts`
- Modify: `apps/agents/package.json` (add `yaml` dep)

- [ ] **Step 1: Install yaml package**

```bash
cd apps/agents && pnpm add yaml
```

- [ ] **Step 2: Write failing tests for workflow parsing**

```typescript
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run tests/wat/workflow-loader.test.ts`
Expected: FAIL — `loadWorkflow` and `loadCycle` not found

- [ ] **Step 4: Implement workflow-loader**

```typescript
// apps/agents/src/wat/workflow-loader.ts
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { AgentRole } from '../types.js';
import type { WorkflowConfig, CycleConfig } from './types.js';

const DEFAULT_WORKFLOWS_DIR = resolve(import.meta.dirname, '../../workflows');

interface WorkflowFrontmatter {
  name: string;
  role: string;
  description: string;
  schedule: string;
  cooldown_ms: number;
  enabled: boolean;
  tools: string[];
  version: number;
  last_updated_by: string;
}

function parseFrontmatter(
  raw: string,
): { frontmatter: Record<string, unknown>; body: string } | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;
  try {
    const frontmatter = parseYaml(match[1]) as Record<string, unknown>;
    return { frontmatter, body: match[2].trim() };
  } catch {
    return null;
  }
}

export function loadWorkflow(role: AgentRole, workflowsDir?: string): WorkflowConfig | null {
  const dir = workflowsDir ?? DEFAULT_WORKFLOWS_DIR;
  const filePath = join(dir, `${role}.md`);

  if (!existsSync(filePath)) return null;

  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const parsed = parseFrontmatter(raw);
  if (!parsed) return null;

  const fm = parsed.frontmatter as Partial<WorkflowFrontmatter>;
  if (!fm.name || !fm.role || !fm.tools) return null;

  return {
    role: fm.role as AgentRole,
    name: fm.name,
    description: fm.description ?? '',
    schedule: fm.schedule ?? '',
    cooldownMs: fm.cooldown_ms ?? 0,
    enabled: fm.enabled ?? true,
    tools: fm.tools ?? [],
    version: fm.version ?? 1,
    lastUpdatedBy: (fm.last_updated_by as 'human' | 'agent') ?? 'human',
    systemPrompt: parsed.body,
    filePath: resolve(filePath),
  };
}

export function loadCycle(workflowsDir?: string): CycleConfig {
  const dir = workflowsDir ?? DEFAULT_WORKFLOWS_DIR;
  const filePath = join(dir, 'cycle.md');

  if (!existsSync(filePath)) {
    throw new Error(`cycle.md not found at ${filePath}`);
  }

  const raw = readFileSync(filePath, 'utf-8');
  const parsed = parseFrontmatter(raw);
  if (!parsed) throw new Error('cycle.md has invalid frontmatter');

  const body = parsed.body;
  const fm = parsed.frontmatter;

  // Parse ## Sequence
  const seqMatch = body.match(/## Sequence\r?\n([\s\S]*?)(?=\r?\n## |\r?\n*$)/);
  const sequence: AgentRole[] = [];
  if (seqMatch) {
    for (const line of seqMatch[1].split('\n')) {
      const m = line.match(/^\d+\.\s+(\w+)/);
      if (m) sequence.push(m[1] as AgentRole);
    }
  }

  // Parse ## On-Demand Agents
  const odMatch = body.match(/## On-Demand Agents\r?\n([\s\S]*?)(?=\r?\n## |\r?\n*$)/);
  const onDemand: AgentRole[] = [];
  if (odMatch) {
    for (const line of odMatch[1].split('\n')) {
      const m = line.match(/^-\s+(\w+)/);
      if (m) onDemand.push(m[1] as AgentRole);
    }
  }

  // Parse ## Halt Conditions
  const hcMatch = body.match(/## Halt Conditions\r?\n([\s\S]*?)(?=\r?\n## |\r?\n*$)/);
  const haltConditions = hcMatch ? hcMatch[1].trim() : '';

  return {
    version: (fm.version as number) ?? 1,
    sequence,
    onDemand,
    haltConditions,
  };
}

export function loadAllWorkflows(workflowsDir?: string): Map<AgentRole, WorkflowConfig> {
  const dir = workflowsDir ?? DEFAULT_WORKFLOWS_DIR;
  const roles: AgentRole[] = [
    'market_sentinel',
    'strategy_analyst',
    'risk_monitor',
    'research',
    'execution_monitor',
  ];
  const map = new Map<AgentRole, WorkflowConfig>();
  for (const role of roles) {
    const wf = loadWorkflow(role, dir);
    if (wf) map.set(role, wf);
  }
  return map;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run tests/wat/workflow-loader.test.ts`
Expected: All PASS

- [ ] **Step 6: Run full test suite to confirm no regressions**

Run: `cd apps/agents && pnpm test`
Expected: All existing tests still pass

- [ ] **Step 7: Commit**

```bash
git add apps/agents/src/wat/workflow-loader.ts apps/agents/tests/wat/workflow-loader.test.ts apps/agents/package.json apps/agents/pnpm-lock.yaml
git commit -m "feat(wat): add workflow-loader with frontmatter parsing"
```

---

## Task 3: Workflow Markdown Files

**Files:**

- Create: `apps/agents/workflows/cycle.md`
- Create: `apps/agents/workflows/market_sentinel.md`
- Create: `apps/agents/workflows/strategy_analyst.md`
- Create: `apps/agents/workflows/risk_monitor.md`
- Create: `apps/agents/workflows/research.md`
- Create: `apps/agents/workflows/execution_monitor.md`

- [ ] **Step 1: Create cycle.md**

Content sourced from the hardcoded sequence in `orchestrator.ts:117-145`:

```markdown
---
name: Trading Cycle
version: 1
---

# Trading Cycle

## Sequence

1. market_sentinel — assess market conditions
2. strategy_analyst — generate signals (after market data available)
3. risk_monitor — check portfolio risk (after positions known)
4. execution_monitor — execute approved trades (after risk approval)

## Halt Conditions

- If risk_monitor sets halted=true, skip execution_monitor
- If market_sentinel detects crisis regime, run risk_monitor immediately

## On-Demand Agents

- research — triggered by specific ticker requests, not part of regular cycle
```

- [ ] **Step 2: Create market_sentinel.md**

Frontmatter from `orchestrator.ts:18-25`, system prompt from `agent.ts:14-27`, WAT sections added:

```markdown
---
name: Market Sentinel
role: market_sentinel
description: Monitors market conditions and detects significant events
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

You are the Market Sentinel agent for the Sentinel Trading Platform.
Your role is to monitor market conditions, detect significant events, and alert the team.

Responsibilities:

- Monitor price action across the watchlist
- Detect unusual volume or volatility
- Identify market regime changes (trending/ranging/crisis)
- Generate alerts for significant market events
- Track sector rotation and inter-market relationships

Always use your tools to gather data before making assessments.
Be concise and data-driven in your analysis.
Focus on actionable insights, not speculation.

## Objective

Monitor market conditions across the watchlist and detect significant events.

## Required Inputs

- Watchlist tickers (default: AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META, SPY)

## Steps

1. Fetch current prices for all watchlist tickers using `get_market_data`
2. Analyze overall market sentiment using `get_market_sentiment`
3. Identify tickers with >2% move or unusual volume (>2x average)
4. Create alerts for significant movements using `create_alert`

## Expected Output

- Price summary for all watchlist tickers
- Market regime assessment (trending/ranging/crisis)
- Alerts for any significant events

## Edge Cases

- If market data API is down, report the failure and skip cycle
- If all tickers show >3% decline, flag as potential crisis regime

## Learnings

<!-- Auto-updated by self-improvement loop -->
```

- [ ] **Step 3: Create strategy_analyst.md**

Frontmatter from `orchestrator.ts:26-33`, system prompt from `agent.ts:29-40`:

```markdown
---
name: Strategy Analyst
role: strategy_analyst
description: Runs trading strategies and recommends trades
schedule: every 15 minutes during market hours
cooldown_ms: 900000
enabled: true
tools:
  - run_strategy_scan
  - get_strategy_info
  - get_market_data
  - analyze_ticker
  - create_alert
version: 1
last_updated_by: human
---

You are the Strategy Analyst agent for the Sentinel Trading Platform.
Your role is to run trading strategies, analyze signals, and recommend trades.

Responsibilities:

- Run strategy scans across the instrument universe
- Evaluate signal quality and conviction
- Identify the strongest trade setups
- Provide detailed reasoning for each recommendation
- Consider correlation between signals (avoid overlapping risk)

Prioritize signal quality over quantity. Only recommend trades with clear edge.
Consider risk-reward ratio for every recommendation.

## Objective

Run trading strategies against the watchlist and identify the strongest signals.

## Required Inputs

- Current market data from market_sentinel phase
- Strategy configurations

## Steps

1. Run all available strategies using `run_strategy_scan`
2. Get strategy details with `get_strategy_info` for context
3. For top signals, verify with `get_market_data` for current prices
4. Deep-dive top candidates with `analyze_ticker`
5. Alert on any high-conviction setups using `create_alert`

## Expected Output

- Ranked list of trade signals by conviction
- Detailed reasoning for top recommendations
- Risk-reward assessment for each signal

## Edge Cases

- If no signals are generated, report "no setups" rather than forcing trades
- If strategy scan errors, report which strategies failed and continue with remaining

## Learnings

<!-- Auto-updated by self-improvement loop -->
```

- [ ] **Step 4: Create risk_monitor.md**

Frontmatter from `orchestrator.ts:34-41`, system prompt from `agent.ts:42-54`:

```markdown
---
name: Risk Monitor
role: risk_monitor
description: Monitors portfolio risk and enforces limits
schedule: every 1 minute during market hours
cooldown_ms: 60000
enabled: true
tools:
  - assess_portfolio_risk
  - check_risk_limits
  - calculate_position_size
  - create_alert
version: 1
last_updated_by: human
---

You are the Risk Monitor agent for the Sentinel Trading Platform.
Your role is to continuously monitor portfolio risk and enforce risk limits.

Responsibilities:

- Check portfolio drawdown against circuit breaker levels (10% soft, 15% hard)
- Monitor position concentration (max 5% per position)
- Track sector exposure (max 20% per sector)
- Enforce daily loss limits (2% of equity)
- Calculate appropriate position sizes for new trades
- HALT all trading if circuit breaker is triggered

You are the guardian of capital. When in doubt, err on the side of caution.
Never approve a trade that violates risk limits.

## Objective

Assess current portfolio risk and validate any proposed trades against risk limits.

## Required Inputs

- Current portfolio state (positions, equity, cash)
- Any proposed trades from strategy_analyst phase

## Steps

1. Run comprehensive risk assessment using `assess_portfolio_risk`
2. For each proposed trade, run `check_risk_limits`
3. Calculate appropriate position sizes with `calculate_position_size`
4. Create alerts for any risk breaches using `create_alert`

## Expected Output

- Portfolio risk summary (drawdown, concentration, exposure)
- Pass/fail verdict for each proposed trade
- Position size recommendations

## Edge Cases

- If drawdown exceeds 10%, create critical alert and recommend halt
- If drawdown exceeds 15%, HALT trading immediately
- If position data is unavailable, err on the side of caution and block trades

## Learnings

<!-- Auto-updated by self-improvement loop -->
```

- [ ] **Step 5: Create research.md**

Frontmatter from `orchestrator.ts:42-49`, system prompt from `agent.ts:56-67`:

```markdown
---
name: Research Analyst
role: research
description: Performs deep analysis on specific tickers
schedule: on demand
cooldown_ms: 1800000
enabled: true
tools:
  - analyze_ticker
  - get_market_data
  - get_market_sentiment
  - create_alert
version: 1
last_updated_by: human
---

You are the Research agent for the Sentinel Trading Platform.
Your role is to perform deep analysis on specific tickers and market themes.

Responsibilities:

- Analyze individual stocks with technical and contextual analysis
- Identify support/resistance levels
- Assess trend strength and momentum
- Evaluate volume patterns
- Provide comprehensive research reports

Be thorough but concise. Focus on actionable research that helps trading decisions.
Support your conclusions with data from your tools.

## Objective

Perform deep analysis on a specific ticker when requested.

## Required Inputs

- Ticker symbol to analyze

## Steps

1. Fetch current market data using `get_market_data`
2. Run deep analysis using `analyze_ticker` with depth=deep
3. Check broader market context with `get_market_sentiment`
4. Create alert for any actionable findings using `create_alert`

## Expected Output

- Comprehensive research report with technical analysis
- Support/resistance levels
- Trend assessment with confidence level
- Actionable recommendations

## Edge Cases

- If ticker data is unavailable, report and suggest alternative tickers in same sector
- If analysis depth=deep takes too long, fall back to standard depth

## Learnings

<!-- Auto-updated by self-improvement loop -->
```

- [ ] **Step 6: Create execution_monitor.md**

Frontmatter from `orchestrator.ts:50-57`, system prompt from `agent.ts:69-80`:

```markdown
---
name: Execution Monitor
role: execution_monitor
description: Manages trade execution and monitors order status
schedule: on demand
cooldown_ms: 10000
enabled: true
tools:
  - submit_order
  - get_open_orders
  - check_risk_limits
  - calculate_position_size
  - create_alert
version: 1
last_updated_by: human
---

You are the Execution Monitor agent for the Sentinel Trading Platform.
Your role is to manage trade execution, monitor order status, and report on fills.

Responsibilities:

- Execute approved trades via the broker interface
- Monitor order fill quality (slippage analysis)
- Track order status and handle partial fills
- Report execution quality metrics
- Ensure all trades pass risk checks before execution

Always run risk checks before submitting orders.
Report any execution anomalies immediately via alerts.

## Objective

Execute approved trades and monitor order status.

## Required Inputs

- Approved trades from risk_monitor phase
- Current open orders

## Steps

1. Check current open orders using `get_open_orders`
2. For approved trades, verify risk one final time with `check_risk_limits`
3. Calculate final position size with `calculate_position_size`
4. Submit orders using `submit_order`
5. Create alerts for execution events using `create_alert`

## Expected Output

- Order submission confirmations
- Execution quality report
- Any alerts for anomalies

## Edge Cases

- If risk check fails at execution time, abort and alert
- If order submission fails, retry once then alert
- Never submit orders when trading is halted

## Learnings

<!-- Auto-updated by self-improvement loop -->
```

- [ ] **Step 7: Add integration test for real workflow files**

Append to `apps/agents/tests/wat/workflow-loader.test.ts`:

```typescript
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

  it('loads cycle.md with 4 in-cycle and 1 on-demand', () => {
    const cycle = loadCycle(realDir);
    expect(cycle.sequence).toHaveLength(4);
    expect(cycle.onDemand).toEqual(['research']);
  });
});
```

- [ ] **Step 8: Run tests**

Run: `cd apps/agents && npx vitest run tests/wat/workflow-loader.test.ts`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add apps/agents/workflows/ apps/agents/tests/wat/workflow-loader.test.ts
git commit -m "feat(wat): add workflow markdown files for all 5 agents + cycle"
```

---

## Task 4: Python Runner

**Files:**

- Create: `apps/agents/tests/wat/python-runner.test.ts`
- Create: `apps/agents/src/wat/python-runner.ts`
- Create: `apps/agents/tools/echo.py` (test helper)

- [ ] **Step 1: Create echo.py test helper**

```python
# apps/agents/tools/echo.py
"""Test tool: reads JSON from stdin, echoes it back with a wrapper."""
import sys
import json

data = json.loads(sys.stdin.read())
print(json.dumps({"echoed": data, "source": "python"}))
```

- [ ] **Step 2: Write failing tests**

```typescript
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run tests/wat/python-runner.test.ts`
Expected: FAIL — `runPythonTool` not found

- [ ] **Step 4: Implement python-runner**

Uses `child_process.spawn` (not `exec`) to avoid shell injection:

```typescript
// apps/agents/src/wat/python-runner.ts
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const DEFAULT_TOOLS_DIR = resolve(import.meta.dirname, '../../tools');
const DEFAULT_TIMEOUT_MS = 30_000;

export async function runPythonTool(
  toolName: string,
  input: Record<string, unknown>,
  toolsDir?: string,
  timeoutMs?: number,
): Promise<string> {
  const dir = toolsDir ?? DEFAULT_TOOLS_DIR;
  const scriptPath = join(dir, `${toolName}.py`);
  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pythonPath = process.env.PYTHON_PATH ?? 'python';

  if (!existsSync(scriptPath)) {
    return JSON.stringify({ error: `Python tool not found: ${scriptPath}` });
  }

  return new Promise<string>((resolvePromise) => {
    const proc = spawn(pythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
      env: {
        ...process.env,
        ENGINE_URL: process.env.ENGINE_URL ?? 'http://localhost:8000',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolvePromise(
          JSON.stringify({
            error: `Python tool '${toolName}' exited with code ${code}`,
            stderr: stderr.slice(0, 500),
          }),
        );
        return;
      }
      try {
        JSON.parse(stdout);
        resolvePromise(stdout.trim());
      } catch {
        resolvePromise(
          JSON.stringify({
            error: `Python tool '${toolName}' returned invalid JSON`,
            raw_output: stdout.slice(0, 500),
          }),
        );
      }
    });

    proc.on('error', (err) => {
      resolvePromise(
        JSON.stringify({
          error: `Failed to spawn Python: ${err.message}`,
        }),
      );
    });

    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run tests/wat/python-runner.test.ts`
Expected: All PASS (requires `python` on PATH)

- [ ] **Step 6: Commit**

```bash
git add apps/agents/src/wat/python-runner.ts apps/agents/tests/wat/python-runner.test.ts apps/agents/tools/echo.py
git commit -m "feat(wat): add python-runner for subprocess tool execution"
```

---

## Task 5: Tool Registry

**Files:**

- Create: `apps/agents/tests/wat/tool-registry.test.ts`
- Create: `apps/agents/src/wat/tool-registry.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run tests/wat/tool-registry.test.ts`
Expected: FAIL — `ToolRegistry` not found

- [ ] **Step 3: Implement tool-registry**

```typescript
// apps/agents/src/wat/tool-registry.ts
import type Anthropic from '@anthropic-ai/sdk';
import { TOOL_DEFINITIONS } from '../tools.js';
import { ToolExecutor } from '../tool-executor.js';
import { runPythonTool } from './python-runner.js';
import type { PythonToolSchema } from './types.js';

export class ToolRegistry {
  private tsExecutor: ToolExecutor;
  private pythonTools: Map<string, PythonToolSchema>;
  private allDefinitions: Anthropic.Tool[];

  constructor(tsExecutor: ToolExecutor, toolsDir?: string, pythonSchemas?: PythonToolSchema[]) {
    this.tsExecutor = tsExecutor;
    this.pythonTools = new Map();

    if (pythonSchemas) {
      for (const schema of pythonSchemas) {
        this.pythonTools.set(schema.name, schema);
      }
    }

    const pyDefs: Anthropic.Tool[] = Array.from(this.pythonTools.values()).map((s) => ({
      name: s.name,
      description: s.description,
      input_schema: s.input_schema as Anthropic.Tool.InputSchema,
    }));

    this.allDefinitions = [...TOOL_DEFINITIONS, ...pyDefs];
  }

  async execute(toolName: string, input: Record<string, unknown>): Promise<string> {
    const pyTool = this.pythonTools.get(toolName);
    if (pyTool) {
      return runPythonTool(pyTool.scriptPath.replace(/\.py$/, ''), input);
    }

    const tsDef = TOOL_DEFINITIONS.find((t) => t.name === toolName);
    if (tsDef) {
      return this.tsExecutor.execute(toolName, input);
    }

    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }

  getToolsForAgent(allowedTools: string[]): Anthropic.Tool[] {
    return this.allDefinitions.filter((t) => allowedTools.includes(t.name));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run tests/wat/tool-registry.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/wat/tool-registry.ts apps/agents/tests/wat/tool-registry.test.ts
git commit -m "feat(wat): add tool-registry with hybrid TS/Python routing"
```

---

## Task 6: Audit Logger

**Files:**

- Create: `apps/agents/tests/wat/audit-logger.test.ts`
- Create: `apps/agents/src/wat/audit-logger.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run tests/wat/audit-logger.test.ts`
Expected: FAIL — `AuditLogger` not found

- [ ] **Step 3: Implement audit-logger**

```typescript
// apps/agents/src/wat/audit-logger.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getSupabaseClient } from '../supabase-client.js';
import type { ToolCallTrace, WorkflowRunTrace } from './types.js';

const DEFAULT_RUNS_DIR = resolve(import.meta.dirname, '../../.tmp/runs');

interface StartRunParams {
  cycle_number: number;
  agent_role: string;
  workflow_version: number;
}

interface EndRunParams {
  success: boolean;
  summary: string | null;
  error?: string;
  llm_transcript?: Array<{ role: string; content: unknown }>;
  workflow_file_snapshot?: string;
}

export class AuditLogger {
  private runsDir: string;
  private currentRun: Partial<WorkflowRunTrace> | null = null;
  private toolCalls: ToolCallTrace[] = [];
  private workflowUpdates: string[] = [];

  constructor(runsDir?: string) {
    this.runsDir = runsDir ?? DEFAULT_RUNS_DIR;
  }

  startRun(params: StartRunParams): void {
    this.currentRun = {
      cycle_number: params.cycle_number,
      agent_role: params.agent_role,
      workflow_version: params.workflow_version,
      started_at: new Date().toISOString(),
    };
    this.toolCalls = [];
    this.workflowUpdates = [];
  }

  logToolCall(trace: ToolCallTrace): void {
    this.toolCalls.push(trace);
  }

  logWorkflowUpdate(description: string): void {
    this.workflowUpdates.push(description);
  }

  async endRun(params: EndRunParams): Promise<void> {
    if (!this.currentRun) return;

    const record: WorkflowRunTrace = {
      cycle_number: this.currentRun.cycle_number!,
      agent_role: this.currentRun.agent_role!,
      workflow_version: this.currentRun.workflow_version!,
      started_at: this.currentRun.started_at!,
      finished_at: new Date().toISOString(),
      success: params.success,
      summary: params.summary,
      tools_called: this.toolCalls,
      workflow_updates_made: this.workflowUpdates,
      error: params.error ?? null,
      llm_transcript: params.llm_transcript ?? [],
      workflow_file_snapshot: params.workflow_file_snapshot ?? '',
    };

    this.writeLocalTrace(record);

    this.writeSupabaseRecord(record).catch((err) => {
      console.error(
        '[AuditLogger] Supabase write failed:',
        err instanceof Error ? err.message : err,
      );
    });

    this.currentRun = null;
  }

  private writeLocalTrace(record: WorkflowRunTrace): void {
    mkdirSync(this.runsDir, { recursive: true });
    const filename = `${record.started_at.replace(/[:.]/g, '-')}-cycle-${record.cycle_number}-${record.agent_role}.json`;
    writeFileSync(join(this.runsDir, filename), JSON.stringify(record, null, 2), 'utf-8');
  }

  private async writeSupabaseRecord(record: WorkflowRunTrace): Promise<void> {
    const db = getSupabaseClient();
    const { error } = await db.from('workflow_runs').insert({
      cycle_number: record.cycle_number,
      agent_role: record.agent_role,
      workflow_version: record.workflow_version,
      started_at: record.started_at,
      finished_at: record.finished_at,
      success: record.success,
      summary: record.summary,
      tools_called: record.tools_called,
      workflow_updates_made: record.workflow_updates_made,
      error: record.error,
    });
    if (error) throw error;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run tests/wat/audit-logger.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/wat/audit-logger.ts apps/agents/tests/wat/audit-logger.test.ts
git commit -m "feat(wat): add dual audit logger (Supabase + local traces)"
```

---

## Task 7: Self-Improver

**Files:**

- Create: `apps/agents/tests/wat/self-improver.test.ts`
- Create: `apps/agents/src/wat/self-improver.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run tests/wat/self-improver.test.ts`
Expected: FAIL — `SelfImprover` not found

- [ ] **Step 3: Implement self-improver**

Uses `execFileSync` (not `exec`) to prevent shell injection for git operations:

```typescript
// apps/agents/src/wat/self-improver.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { AgentRole } from '../types.js';

const DEFAULT_WORKFLOWS_DIR = resolve(import.meta.dirname, '../../workflows');
const LOCK_DIR = resolve(import.meta.dirname, '../../.tmp');
const LOCK_FILE = join(LOCK_DIR, 'self-improve.lock');

export class SelfImprover {
  private workflowsDir: string;

  constructor(workflowsDir?: string) {
    this.workflowsDir = workflowsDir ?? DEFAULT_WORKFLOWS_DIR;
  }

  async addLearning(role: AgentRole, learning: string): Promise<boolean> {
    const filePath = join(this.workflowsDir, `${role}.md`);
    if (!existsSync(filePath)) return false;

    await this.acquireLock();
    try {
      let content = readFileSync(filePath, 'utf-8');

      const timestamp = new Date().toISOString().split('T')[0];
      const entry = `- [${timestamp}] ${learning}`;

      const learningsMarker = '<!-- Auto-updated by self-improvement loop -->';
      if (content.includes(learningsMarker)) {
        content = content.replace(learningsMarker, `${learningsMarker}\n${entry}`);
      } else if (content.includes('## Learnings')) {
        content = content.replace('## Learnings', `## Learnings\n${entry}`);
      } else {
        content += `\n## Learnings\n${entry}\n`;
      }

      content = content.replace(/version:\s*(\d+)/, (_, v) => `version: ${parseInt(v, 10) + 1}`);
      content = content.replace(/last_updated_by:\s*\w+/, 'last_updated_by: agent');

      writeFileSync(filePath, content, 'utf-8');

      this.tryGitCommit(filePath, role, learning);

      return true;
    } finally {
      this.releaseLock();
    }
  }

  private tryGitCommit(filePath: string, role: string, learning: string): void {
    const gitEnabled = process.env.WAT_SELF_IMPROVE_GIT !== 'false';
    if (!gitEnabled) return;

    try {
      const summary = learning.slice(0, 72);
      execFileSync('git', ['add', filePath], { stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', `chore(wat): ${role} learned ${summary}`], {
        stdio: 'pipe',
      });
    } catch (err) {
      console.error(
        '[SelfImprover] Git commit failed (file write preserved):',
        err instanceof Error ? err.message : err,
      );
    }
  }

  private async acquireLock(): Promise<void> {
    mkdirSync(LOCK_DIR, { recursive: true });
    const maxWait = 10_000;
    const start = Date.now();
    while (existsSync(LOCK_FILE)) {
      if (Date.now() - start > maxWait) {
        this.releaseLock();
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    writeFileSync(LOCK_FILE, String(process.pid), 'utf-8');
  }

  private releaseLock(): void {
    try {
      if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
    } catch {
      // ignore
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run tests/wat/self-improver.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/wat/self-improver.ts apps/agents/tests/wat/self-improver.test.ts
git commit -m "feat(wat): add self-improver with workflow auto-update"
```

---

## Task 8: Integrate WAT into Agent

**Files:**

- Modify: `apps/agents/src/agent.ts`
- Create: `apps/agents/tests/agent-wat.test.ts`

- [ ] **Step 1: Write a test for workflow-loader integration**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run tests/agent-wat.test.ts`
Expected: FAIL — agent still uses hardcoded prompt

- [ ] **Step 3: Modify agent.ts to use workflow-loader with fallback**

Add import at top of `apps/agents/src/agent.ts` (after line 3):

```typescript
import { loadWorkflow } from './wat/workflow-loader.js';
```

In the `run()` method (around line 109), change:

```typescript
const systemPrompt = SYSTEM_PROMPTS[this.config.role];
```

To:

```typescript
const workflow = loadWorkflow(this.config.role);
const systemPrompt = workflow?.systemPrompt ?? SYSTEM_PROMPTS[this.config.role];
```

- [ ] **Step 4: Run the WAT integration test**

Run: `cd apps/agents && npx vitest run tests/agent-wat.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `cd apps/agents && pnpm test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add apps/agents/src/agent.ts apps/agents/tests/agent-wat.test.ts
git commit -m "feat(wat): agent reads system prompt from workflow-loader with fallback"
```

---

## Task 9: Integrate WAT into Orchestrator

**Files:**

- Modify: `apps/agents/src/orchestrator.ts`
- Create: `apps/agents/tests/orchestrator-wat.test.ts`

- [ ] **Step 1: Write a test for cycle.md-driven orchestration**

```typescript
// apps/agents/tests/orchestrator-wat.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'cycle test' }],
        stop_reason: 'end_turn',
      }),
    },
  })),
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
  EngineClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../src/tool-executor.js', () => ({
  ToolExecutor: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue('{}'),
  })),
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run tests/orchestrator-wat.test.ts`
Expected: FAIL — orchestrator uses hardcoded 4-phase sequence

- [ ] **Step 3: Modify orchestrator.ts to read cycle.md**

Add import at top of `orchestrator.ts`:

```typescript
import { loadCycle } from './wat/workflow-loader.js';
```

In the constructor, after initializing agents, load the cycle:

```typescript
// Try to load cycle from workflow, fall back to hardcoded sequence
private cycleSequence: AgentRole[];
private defaultPrompts: Record<string, string>;

// In constructor, after agents init:
try {
  const cycle = loadCycle();
  this.cycleSequence = cycle.sequence;
} catch {
  this.cycleSequence = ['market_sentinel', 'strategy_analyst', 'risk_monitor', 'execution_monitor'];
}
```

Replace the hardcoded 4-phase `runCycle()` body with a loop:

```typescript
// Store the existing prompts as defaults
this.defaultPrompts = {
  market_sentinel: 'Scan the current market conditions...',
  strategy_analyst: 'Run all available trading strategies...',
  risk_monitor: 'Assess the current portfolio risk...',
  execution_monitor: 'Check for any open orders...',
};

// In runCycle():
for (const role of this.cycleSequence) {
  if (this.state.halted && role === 'execution_monitor') {
    console.log('[Orchestrator] Trading halted — skipping execution');
    continue;
  }
  const result = await this.runAgent(
    role,
    this.defaultPrompts[role] ?? `Execute ${role} workflow.`,
  );
  results.push(result);
}
```

- [ ] **Step 4: Run the WAT orchestrator test**

Run: `cd apps/agents && npx vitest run tests/orchestrator-wat.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `cd apps/agents && pnpm test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add apps/agents/src/orchestrator.ts apps/agents/tests/orchestrator-wat.test.ts
git commit -m "feat(wat): orchestrator reads agent sequence from cycle.md"
```

---

## Task 10: Database Migration

**Files:**

- Create: `supabase/migrations/00004_workflow_runs.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ============================================================
-- Migration 00004: Workflow runs audit table
-- Tracks every agent run with workflow version, tools called,
-- and any self-improvement updates made.
-- ============================================================

CREATE TABLE workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_number integer NOT NULL,
  agent_role text NOT NULL,
  workflow_version integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  success boolean NOT NULL DEFAULT false,
  summary text,
  tools_called jsonb DEFAULT '[]',
  workflow_updates_made jsonb DEFAULT '[]',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_runs_cycle ON workflow_runs(cycle_number);
CREATE INDEX idx_workflow_runs_role ON workflow_runs(agent_role, created_at DESC);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/00004_workflow_runs.sql
git commit -m "feat(wat): add workflow_runs audit table migration"
```

---

## Task 11: Gitignore and Cleanup

**Files:**

- Modify: `.gitignore`

- [ ] **Step 1: Add .tmp/ to gitignore**

Add to root `.gitignore`:

```
# WAT agent trace logs
apps/agents/.tmp/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore WAT agent trace logs"
```

---

## Task 12: Python Tools (Phase 3)

**Files:**

- Create: `apps/agents/tools/analyze_ticker.py` + `.schema.json`
- Create: `apps/agents/tools/run_strategy_scan.py` + `.schema.json`
- Create: `apps/agents/tools/assess_risk.py` + `.schema.json`

- [ ] **Step 1: Create analyze_ticker.schema.json**

```json
{
  "name": "analyze_ticker_py",
  "description": "Deep technical analysis on a specific ticker using Python. Returns trend analysis, support/resistance, and volume profile.",
  "input_schema": {
    "type": "object",
    "properties": {
      "ticker": { "type": "string", "description": "Ticker symbol to analyze" },
      "depth": {
        "type": "string",
        "enum": ["quick", "standard", "deep"],
        "description": "Analysis depth"
      }
    },
    "required": ["ticker"]
  }
}
```

- [ ] **Step 2: Create analyze_ticker.py**

```python
#!/usr/bin/env python3
"""Deep technical analysis tool — calls the engine API."""
import sys, json, urllib.request, os

ENGINE_URL = os.environ.get("ENGINE_URL", "http://localhost:8000")

def main():
    data = json.loads(sys.stdin.read())
    ticker = data.get("ticker", "").upper()
    depth = data.get("depth", "standard")

    payload = json.dumps({"tickers": [ticker], "days": 90, "min_strength": 0.0}).encode()
    req = urllib.request.Request(f"{ENGINE_URL}/api/strategies/scan", data=payload, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            result = json.loads(resp.read())
    except Exception as e:
        print(json.dumps({"error": str(e), "ticker": ticker}))
        return

    signals = result.get("signals", [])
    longs = [s for s in signals if s.get("direction") == "long"]
    shorts = [s for s in signals if s.get("direction") == "short"]
    avg = sum(s.get("strength", 0) for s in signals) / max(len(signals), 1)
    bias = "bullish" if len(longs) > len(shorts) else "bearish" if len(shorts) > len(longs) else "neutral"

    print(json.dumps({"ticker": ticker, "depth": depth, "signals": signals, "summary": {"total_signals": len(signals), "long_signals": len(longs), "short_signals": len(shorts), "avg_strength": round(avg, 4), "trend_bias": bias}, "source": "python"}))

if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Create run_strategy_scan.schema.json + run_strategy_scan.py**

Schema:

```json
{
  "name": "run_strategy_scan_py",
  "description": "Run trading strategy scan using Python with engine API access. Returns signals with strength and direction.",
  "input_schema": {
    "type": "object",
    "properties": {
      "tickers": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Tickers to scan"
      },
      "strategies": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Strategy names"
      }
    },
    "required": []
  }
}
```

Script:

```python
#!/usr/bin/env python3
"""Strategy scan tool — calls the engine API."""
import sys, json, urllib.request, os

ENGINE_URL = os.environ.get("ENGINE_URL", "http://localhost:8000")
DEFAULT_TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "SPY"]

def main():
    data = json.loads(sys.stdin.read())
    tickers = data.get("tickers") or DEFAULT_TICKERS
    strategies = data.get("strategies", [])

    payload = json.dumps({"tickers": tickers, "days": 90, "min_strength": 0.3}).encode()
    req = urllib.request.Request(f"{ENGINE_URL}/api/strategies/scan", data=payload, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            result = json.loads(resp.read())
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return

    signals = result.get("signals", [])
    if strategies:
        signals = [s for s in signals if s.get("strategy_name") in strategies]

    print(json.dumps({"signals": signals, "total_signals": len(signals), "tickers_scanned": result.get("tickers_scanned", len(tickers)), "strategies_run": result.get("strategies_run", 0), "errors": result.get("errors", []), "source": "python"}))

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Create assess_risk.schema.json + assess_risk.py**

Schema:

```json
{
  "name": "assess_risk_py",
  "description": "Portfolio risk assessment using Python. Returns drawdown, concentration, and limit status.",
  "input_schema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

Script:

```python
#!/usr/bin/env python3
"""Risk assessment tool — calls the engine API."""
import sys, json, urllib.request, os

ENGINE_URL = os.environ.get("ENGINE_URL", "http://localhost:8000")

def main():
    json.loads(sys.stdin.read())  # consume stdin

    try:
        with urllib.request.urlopen(f"{ENGINE_URL}/api/portfolio/account", timeout=10) as resp:
            account = json.loads(resp.read())
    except Exception as e:
        print(json.dumps({"error": f"Failed to get account: {e}"})); return

    try:
        with urllib.request.urlopen(f"{ENGINE_URL}/api/portfolio/positions", timeout=10) as resp:
            positions = json.loads(resp.read())
    except Exception as e:
        print(json.dumps({"error": f"Failed to get positions: {e}"})); return

    pos_map = {}
    for p in positions:
        mv = p.get("market_value") or (p.get("quantity", 0) * p.get("avg_price", 0))
        pos_map[p.get("instrument_id", "")] = mv

    payload = json.dumps({"equity": account.get("equity", 0), "cash": account.get("cash", 0), "peak_equity": account.get("initial_capital", account.get("equity", 0)), "daily_starting_equity": account.get("initial_capital", account.get("equity", 0)), "positions": pos_map, "position_sectors": {}}).encode()
    req = urllib.request.Request(f"{ENGINE_URL}/api/risk/assess", data=payload, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
    except Exception as e:
        print(json.dumps({"error": f"Risk assessment failed: {e}"})); return

    print(json.dumps({"equity": result.get("equity", 0), "drawdown": result.get("drawdown", 0), "daily_pnl": result.get("daily_pnl", 0), "halted": result.get("halted", False), "alerts": result.get("alerts", []), "concentrations": result.get("concentrations", {}), "source": "python"}))

if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Commit**

```bash
git add apps/agents/tools/
git commit -m "feat(wat): add Python tools with schema files"
```

---

## Task 13: End-to-End Validation

- [ ] **Step 1: Run all WAT unit tests**

Run: `cd apps/agents && npx vitest run tests/wat/`
Expected: All PASS

- [ ] **Step 2: Run full test suite**

Run: `cd apps/agents && pnpm test`
Expected: All PASS

- [ ] **Step 3: Type check**

Run: `cd apps/agents && npx tsc --noEmit`
Expected: No errors

---

## Summary

| Task | Phase | Delivers                         |
| ---- | ----- | -------------------------------- |
| 1    | 0     | WAT type definitions             |
| 2    | 0     | Workflow markdown parser         |
| 3    | 0     | All 6 workflow markdown files    |
| 4    | 0     | Python subprocess runner         |
| 5    | 0     | Unified tool registry            |
| 6    | 0     | Dual audit logger                |
| 7    | 0     | Self-improvement loop            |
| 8    | 1     | Agent reads from workflow-loader |
| 9    | 1     | Orchestrator reads cycle.md      |
| 10   | 4     | workflow_runs Supabase table     |
| 11   | 4     | Gitignore for .tmp/              |
| 12   | 3     | Python tools with schemas        |
| 13   | —     | End-to-end validation            |

**Phase 5 (legacy cleanup)** is intentionally deferred — only remove hardcoded `SYSTEM_PROMPTS`, `AGENT_TOOLS`, and orchestrator sequence after WAT has been validated in production.
