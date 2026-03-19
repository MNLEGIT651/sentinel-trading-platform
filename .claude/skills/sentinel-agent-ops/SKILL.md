---
name: sentinel-agent-ops
description: This skill should be used when working with the Sentinel agent orchestration system — including "agent orchestration", "agent not running", "add a tool to an agent", "agent pipeline", "debug agents", "agents app", "agent cycle", "halt trading", "market sentinel", "strategy analyst", "risk monitor", "execution monitor", "research analyst", "agent cooldown", "add a new agent", or any time apps/agents/ is being modified or debugged.
---

# Sentinel Agent Operations

The agents app (`apps/agents/`) runs a 5-agent trading pipeline on a scheduled cycle during market hours. All agents share a common execution path: `Orchestrator` → `Agent` → `ToolExecutor` → `EngineClient` → FastAPI engine at port 8000.

**The engine must be running before starting agents.** Agents call the engine on every tool invocation.

## Starting the Agents App

```bash
cd apps/agents
pnpm dev          # development with auto-reload (tsx watch)
pnpm start        # production
```

The orchestrator starts automated cycles immediately on startup at a 15-minute interval. Console output shows each cycle number and per-agent status.

## The 5 Agents

| Agent             | Role Key            | Cooldown | Default Prompt Focus                             |
| ----------------- | ------------------- | -------- | ------------------------------------------------ |
| Market Sentinel   | `market_sentinel`   | 5 min    | Price movements, volume anomalies, market regime |
| Strategy Analyst  | `strategy_analyst`  | 15 min   | Signal generation across watchlist tickers       |
| Risk Monitor      | `risk_monitor`      | 1 min    | Drawdown, concentration, position sizing         |
| Research Analyst  | `research`          | 30 min   | Deep dive on specific tickers (on-demand)        |
| Execution Monitor | `execution_monitor` | 10 sec   | Order status, fill quality, trade preparation    |

Agents run **sequentially** within a cycle — Market → Strategy → Risk → Execution. Research runs on-demand via `orchestrator.research(ticker)`.

## Halting and Resuming

The orchestrator exposes `halt()` and `resume()` via the HTTP server (`apps/agents/src/server.ts`). Halting stops both the scheduled cycles and skips execution within any running cycle.

```bash
# Check agent status
curl http://localhost:3001/agents

# Halt trading
curl -X POST http://localhost:3001/halt -H "Content-Type: application/json" \
  -d '{"reason": "Manual halt for maintenance"}'

# Resume
curl -X POST http://localhost:3001/resume
```

The orchestrator state includes: agent statuses (`idle` | `running` | `error`), last run timestamps, cycle count, and `halted` flag.

## Adding a New Tool

Tools give agents the ability to call the engine. Adding one requires 4 steps:

**1. Add the method to `apps/agents/src/engine-client.ts`:**

```typescript
async myNewMethod(params: { ticker: string }): Promise<MyResponse> {
  return this.request<MyResponse>('/api/v1/my-endpoint', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
```

**2. Add a case to `apps/agents/src/tool-executor.ts` `dispatch()` switch:**

```typescript
case 'my_new_tool':
  return this.myNewTool(input);
```

Then add the private method that calls `this.engine.myNewMethod(...)`.

**3. Register the tool definition in `apps/agents/src/agent.ts`** — the tools array passed to the Anthropic API. Add an entry with `name`, `description`, and `input_schema` following the existing pattern.

**4. Test** — start agents, trigger a cycle manually, verify the tool appears in Claude's tool_use blocks in the logs.

## Adding a New Agent

**1. Add config to `DEFAULT_CONFIGS` in `apps/agents/src/orchestrator.ts`:**

```typescript
{
  role: 'my_new_agent',   // must be unique
  name: 'My New Agent',
  description: 'What this agent does',
  schedule: 'on demand',
  enabled: true,
  cooldownMs: 10 * 60 * 1000,  // 10 minutes
}
```

**2. Add the role to the `AgentRole` union type in `apps/agents/src/types.ts`.**

**3. Wire it into `runCycle()` in `orchestrator.ts`** if it should run automatically, or call `orchestrator.runAgent('my_new_agent', prompt)` on demand.

**4. Update the system prompt** in `apps/agents/src/agent.ts` for the new role to define its personality and focus.

## Adjusting Cooldowns

Cooldown values are defined in `DEFAULT_CONFIGS` in `orchestrator.ts`. The `cooldownMs` field is in milliseconds. The cooldown is enforced per-agent — an agent that completed within its cooldown window is skipped on the next cycle.

The cycle interval itself (default 15 minutes) is set in `orchestrator.start(intervalMs)` called from `apps/agents/src/index.ts`.

## Common Issues

**Engine unreachable** — Agents call `http://localhost:8000` (or `ENGINE_URL`). Start the engine first: `.venv/Scripts/python -m uvicorn src.api.main:app --reload --port 8000` from `apps/engine/`.

**Agent stuck in `running`** — Means an agent crashed mid-execution without updating state. Restart the agents app (`Ctrl+C`, `pnpm dev`). The orchestrator state is in-memory only.

**Anthropic rate limits** — Look for `429` errors in agent output. The Risk Monitor runs every 1 minute which can exhaust API quota quickly under load. Increase its `cooldownMs` if needed.

**Orders not submitting** — `submit_order` in the tool executor creates a _recommendation_ (stored in Supabase), not a live order. Human approval via the Agents dashboard is required before execution.

**Market hours check** — The scheduler in `apps/agents/src/scheduler.ts` enforces market-hours-only execution. Outside 9:30 AM – 4:00 PM ET on weekdays, cycles are skipped automatically.

## Additional Resources

- **`references/agent-architecture.md`** — Full architecture diagram, agent execution flow, state management, Anthropic API usage pattern
