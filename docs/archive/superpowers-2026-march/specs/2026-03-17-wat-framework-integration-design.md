# WAT Framework Integration Design

**Date:** 2026-03-17
**Status:** Approved
**Approach:** WAT Module + Progressive Migration (Approach 3)

## Summary

Integrate the WAT (Workflows, Agents, Tools) framework into the Sentinel trading platform's `apps/agents` module. This separates probabilistic AI reasoning from deterministic execution by adding three layers: markdown-based workflow SOPs, a unified tool registry (hybrid TypeScript + Python), and structured audit logging.

## Goals

1. **Operational agility** — Tune agent behavior by editing markdown, not TypeScript
2. **Self-improvement loop** — Agents auto-update workflow docs when they learn
3. **Debuggability** — Clear audit trail of which SOP each agent followed per cycle
4. **Tool portability** — Standalone Python scripts for heavy quant tools, callable outside the agent loop

## Design Decisions

| Decision         | Choice                                                   | Rationale                                                                                                            |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Tool language    | Hybrid: Python for quant, TypeScript for lightweight ops | Leverages existing `apps/engine` Python ecosystem for data-heavy tools while keeping fast TS tools for alerts/orders |
| Self-improvement | Full auto — agents update workflow files and commit      | Maximizes learning velocity; `last_updated_by` field + git history provide audit trail                               |
| Audit trail      | Supabase summaries + local `.tmp/` detailed traces       | Dashboard visibility for operations, full traces for debugging                                                       |
| Cycle sequencing | Editable `workflows/cycle.md`                            | Operators can change agent order without code changes                                                                |

## Directory Structure

```
apps/agents/
├── workflows/                    # Layer 1: Markdown SOPs
│   ├── cycle.md                  # Master cycle — agent order + dependencies
│   ├── market_sentinel.md
│   ├── strategy_analyst.md
│   ├── risk_monitor.md
│   ├── research.md
│   └── execution_monitor.md
│
├── tools/                        # Layer 3: Python execution scripts
│   ├── analyze_ticker.py
│   ├── run_strategy_scan.py
│   └── assess_risk.py
│
├── .tmp/                         # Disposable trace logs (gitignored)
│   └── runs/
│
├── src/
│   ├── wat/                      # WAT module
│   │   ├── workflow-loader.ts    # Parses workflow markdown → structured config
│   │   ├── tool-registry.ts     # Unified registry: TS tools + Python scripts
│   │   ├── python-runner.ts      # Executes Python tools via subprocess
│   │   ├── audit-logger.ts       # Dual logging: Supabase + .tmp/
│   │   ├── self-improver.ts      # Writes workflow updates + git commits
│   │   └── types.ts              # WAT-specific types
│   │
│   ├── agent.ts                  # Migrated to read from workflow-loader
│   ├── orchestrator.ts           # Migrated to read cycle.md
│   ├── tool-executor.ts          # Wrapped by tool-registry
│   └── ...
```

## Workflow Markdown Format

Each workflow file uses YAML frontmatter for machine-readable config and a markdown body for the SOP that becomes the agent's system prompt.

### Frontmatter Schema

```yaml
---
name: string # Human-readable agent name
role: string # Agent role identifier (matches AgentRole type)
description: string # One-line description
schedule: string # When it runs (e.g., "every 5 minutes during market hours")
cooldown_ms: number # Minimum ms between runs
enabled: boolean # Whether this agent is active
tools: string[] # List of tool names this agent can use
version: number # Auto-incremented on changes
last_updated_by: string # "human" or "agent"
---
```

### Body Sections

- `## Objective` — What the agent accomplishes
- `## Required Inputs` — Data/context the agent needs
- `## Steps` — Ordered procedure with tool references
- `## Expected Output` — What a successful run produces
- `## Edge Cases` — Known failure modes and how to handle them
- `## Learnings` — Auto-appended by self-improvement loop

### cycle.md Format and Parsing

The cycle file uses the same frontmatter + markdown body pattern. The parser extracts agent roles from the numbered list items in `## Sequence` (each line must start with `N. role_name`), bullet items from `## On-Demand Agents`, and freeform text from `## Halt Conditions`.

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

**Parsing rules:**

- `## Sequence` lines are parsed as `/^\d+\.\s+(\w+)/` — the first word after the number is the `AgentRole`
- `## On-Demand Agents` lines are parsed as `/^-\s+(\w+)/` — the first word is the `AgentRole`
- `## Halt Conditions` is stored as raw text for the orchestrator to include in its logic
- The parser produces a `CycleConfig` (see Types section below)

**Agent count distinction:** 5 agents total (5 workflow files), 4 in-cycle, 1 on-demand (`research`)

## WAT Types

```typescript
// src/wat/types.ts

/** Parsed workflow file — one per agent */
interface WorkflowConfig {
  role: AgentRole;
  name: string;
  description: string;
  schedule: string;
  cooldownMs: number; // Mapped from frontmatter cooldown_ms
  enabled: boolean;
  tools: string[]; // Tool names this agent can use
  version: number;
  lastUpdatedBy: 'human' | 'agent';
  systemPrompt: string; // Full markdown body (used as Claude system prompt)
  filePath: string; // Absolute path to the .md file (for self-improver writes)
}

/** Parsed cycle.md */
interface CycleConfig {
  version: number;
  sequence: AgentRole[]; // Ordered list from ## Sequence
  onDemand: AgentRole[]; // List from ## On-Demand Agents
  haltConditions: string; // Raw text from ## Halt Conditions
}

/** Python tool metadata — from companion .schema.json files */
interface PythonToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>; // JSON Schema for Anthropic API
  scriptPath: string; // Relative path to .py file
}

/** Single tool call trace entry */
interface ToolCallTrace {
  toolName: string;
  input: Record<string, unknown>;
  output: string;
  durationMs: number;
  source: 'typescript' | 'python';
}

/** Audit record written to Supabase */
interface WorkflowRunRecord {
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
interface WorkflowRunTrace extends WorkflowRunRecord {
  llm_transcript: Array<{ role: string; content: unknown }>;
  workflow_file_snapshot: string; // The system prompt used for this run
}
```

## WAT Module Architecture

### workflow-loader.ts

- Parses YAML frontmatter with `yaml` npm package (already a transitive dep)
- Splits content at the second `---` delimiter: frontmatter above, markdown body below
- Maps frontmatter `cooldown_ms` → `cooldownMs` (camelCase) to match existing `AgentConfig`
- Extracts markdown body as `systemPrompt`, replacing hardcoded `SYSTEM_PROMPTS` in `agent.ts`
- Parses `cycle.md` using regex rules documented above to produce `CycleConfig`
- Exports:
  - `loadWorkflow(role: AgentRole): WorkflowConfig | null` — returns `null` if file missing or parse fails (caller falls back to hardcoded prompt during migration)
  - `loadCycle(): CycleConfig` — throws if `cycle.md` is missing (cycle file is required)
  - `loadAllWorkflows(): Map<AgentRole, WorkflowConfig>` — bulk load for orchestrator init
- File watcher optional for dev mode hot-reload

### tool-registry.ts

- Wraps existing `ToolExecutor` for TypeScript tools
- Discovers Python tools via companion schema files: each Python tool has `tools/<name>.py` (script) + `tools/<name>.schema.json` (Anthropic `Tool` definition with `name`, `description`, `input_schema`). The schema file is required — Python scripts without one are ignored.
- Routes calls: if `tools/<name>.schema.json` exists → `python-runner.ts`; otherwise → `ToolExecutor`
- Merges tool definitions from two sources: (1) existing `TOOL_DEFINITIONS` from `tools.ts` for TS tools, (2) parsed `.schema.json` files for Python tools
- Filters tools per-agent using the `tools` list from workflow frontmatter (replaces hardcoded `AGENT_TOOLS` map)
- Exports `ToolRegistry` class with:
  - `execute(toolName, input): Promise<string>` — routes to correct executor
  - `getToolsForAgent(role): Anthropic.Tool[]` — returns full tool schemas filtered by workflow permissions

### python-runner.ts

- Python interpreter path is configurable via `PYTHON_PATH` env var (defaults to `python`). The project uses `.venv/Scripts/python` on Windows — set `PYTHON_PATH` accordingly in `.env`
- Spawns `${PYTHON_PATH} tools/<name>.py` with JSON input on stdin
- Reads JSON output from stdout, stderr captured for errors
- Configurable timeout (default 30s). Note: if an agent makes multiple Python tool calls per turn, total cycle time can increase. The orchestrator's existing `maxTurns = 10` limit in `agent.run()` bounds total calls per agent.
- Passes `ENGINE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` via env vars
- Returns stringified JSON result matching `ToolExecutor.execute()` signature

### audit-logger.ts

- **Supabase destination**: Inserts into `workflow_runs` table (structured summary)
- **Local destination**: Writes to `.tmp/runs/<ISO-timestamp>-cycle-<N>.json` (full trace)
- Full trace includes: workflow version used, every tool call (name, input, output, duration), full LLM message transcript, any workflow updates made
- Exports `AuditLogger` class with `startRun()`, `logToolCall()`, `logWorkflowUpdate()`, `endRun()` methods

### self-improver.ts

- After each agent run, scans agent response for improvement signals:
  - Error patterns: rate limits, timeouts, unexpected data shapes
  - Explicit suggestions: agent recommends workflow changes
  - Performance: tools that took unusually long
- Appends findings to the workflow's `## Learnings` section
- Increments `version`, sets `last_updated_by: agent`
- Logs update in audit trail
- Does NOT modify `## Steps` or other structural sections (only `## Learnings` and `## Edge Cases`)

**Git commit safety model:**

- Uses a file-level mutex (lockfile in `.tmp/self-improve.lock`) to prevent concurrent git operations. Only one self-improver write runs at a time; others queue.
- Commits to the current branch with message: `chore(wat): <role> learned <summary>`
- **Environment detection:** Before attempting git operations, checks `process.env.WAT_SELF_IMPROVE_GIT` (defaults to `true`). In Docker/CI where git may be unavailable, set to `false` — learnings are still written to the workflow file and logged to the audit trail but not committed. Operators can commit accumulated learnings manually.
- If `git commit` fails for any reason (dirty index, permissions), the file write still succeeds — the learning is preserved, just uncommitted. Error is logged to audit trail, not thrown.

## Database Schema

New migration for audit logging:

```sql
create table workflow_runs (
  id uuid primary key default gen_random_uuid(),
  cycle_number integer not null,
  agent_role text not null,
  workflow_version integer not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  success boolean not null default false,
  summary text,
  tools_called jsonb default '[]',
  workflow_updates_made jsonb default '[]',
  error text,
  created_at timestamptz not null default now()
);

create index idx_workflow_runs_cycle on workflow_runs(cycle_number);
create index idx_workflow_runs_role on workflow_runs(agent_role);

-- Retention: keep 30 days of runs. Clean up via scheduled job or manual query:
-- delete from workflow_runs where created_at < now() - interval '30 days';
```

**Retention policy:** `workflow_runs` rows older than 30 days should be purged. This can be a manual query initially; a Supabase cron (pg_cron) can be added later if volume warrants it. At 4 agents per cycle, 4 cycles/hour during market hours (6.5h), this is ~104 rows/day — manageable without aggressive cleanup.

## Migration Strategy

Progressive migration, one agent at a time. Each phase is independently shippable.

### Phase 0: WAT Module Foundation

- Create `src/wat/` module with all five files
- Create `workflows/cycle.md` with current hardcoded sequence
- Create empty workflow files for all 5 agents (frontmatter only, no body yet)
- Orchestrator reads `cycle.md` for sequence; agents still use hardcoded prompts
- All existing tests pass — no behavior change

### Phase 1: First Agent Migration (market_sentinel)

- Extract `market_sentinel` system prompt into `workflows/market_sentinel.md`
- `agent.ts` checks workflow-loader first, falls back to hardcoded prompt
- Validate behavior matches existing behavior
- Add tests for workflow-loader

### Phase 2: Remaining Agent Migrations

- Migrate `strategy_analyst`, `risk_monitor`, `research`, `execution_monitor` one at a time
- Each is a separate PR with its own validation

### Phase 3: Python Tools

- Add `tools/` directory with Python scripts for `analyze_ticker`, `run_strategy_scan`, `assess_risk`
- These call the engine API (same as TypeScript tools) but can also use pandas/numpy
- Wire `python-runner.ts` into `tool-registry.ts`
- Existing TypeScript tools remain for lightweight operations

### Phase 4: Audit + Self-Improvement

- Add `workflow_runs` Supabase migration
- Wire `audit-logger.ts` into agent execution loop
- Enable `self-improver.ts`
- Add `apps/agents/.tmp/` to root `.gitignore` (scoped to avoid ignoring `.tmp/` elsewhere in monorepo)

### Phase 5: Legacy Cleanup

- Remove hardcoded `SYSTEM_PROMPTS` from `agent.ts`
- Remove hardcoded `AGENT_TOOLS` from `tools.ts`
- Remove hardcoded sequence from `orchestrator.ts`
- WAT is the single source of truth

## Testing Strategy

- **workflow-loader**: Unit tests for frontmatter parsing, cycle parsing, edge cases (malformed YAML, missing fields)
- **tool-registry**: Unit tests for routing logic (Python vs TS), permission checking
- **python-runner**: Integration test with a simple echo Python script
- **audit-logger**: Unit test for Supabase insert mock + file write verification
- **self-improver**: Unit test for learning extraction and markdown update logic
- **End-to-end**: Run a single cycle with WAT-loaded workflows and verify audit output matches expected structure

## Risks and Mitigations

| Risk                                          | Mitigation                                                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow parsing breaks on malformed markdown | `loadWorkflow()` returns `null` on failure; caller falls back to hardcoded prompt during migration. Strict validation logs parse errors to audit trail. |
| Python subprocess adds latency                | Only heavy quant tools use Python; lightweight ops stay TypeScript. 30s timeout per tool; `maxTurns=10` bounds total calls per agent.                   |
| Self-improvement writes bad content           | Only appends to `## Learnings` and `## Edge Cases`; structural sections are human-only; git history allows rollback.                                    |
| Concurrent self-improver git commits          | File-level mutex (`.tmp/self-improve.lock`) serializes git operations. Git failures are logged, not thrown — file write still succeeds.                 |
| Self-improver in Docker/CI without git        | `WAT_SELF_IMPROVE_GIT=false` disables commits; learnings written to file only.                                                                          |
| Audit logging slows cycles                    | Supabase insert is async (fire-and-forget with error logging); local file write is non-blocking.                                                        |
| Supabase audit insert fails silently          | Local `.tmp/` trace serves as backup. Reconciliation (backfill from local traces) can be added as a follow-up script if needed.                         |
| `workflow_runs` table grows indefinitely      | 30-day retention policy; ~104 rows/day is manageable. pg_cron cleanup added if volume grows.                                                            |
