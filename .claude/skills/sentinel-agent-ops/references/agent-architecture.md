# Agent Architecture Reference

Full technical reference for the Sentinel agent orchestration system.

---

## System Architecture

```
apps/agents/src/
├── index.ts              ← entry point, starts Orchestrator + HTTP server
├── server.ts             ← Express HTTP server (status, halt, resume endpoints)
├── scheduler.ts          ← market-hours enforcement
├── orchestrator.ts       ← coordinates agent sequence and state
├── agent.ts              ← individual agent (Anthropic API calls)
├── engine-client.ts      ← HTTP client for FastAPI engine (port 8000)
├── tool-executor.ts      ← routes tool_use calls to engine methods
├── recommendations-store.ts ← Supabase writes for trade recommendations
└── types.ts              ← AgentRole, AgentConfig, AgentResult, OrchestratorState
```

---

## Agent Execution Flow

```
scheduler.ts
  └─ isMarketOpen() → true
       └─ orchestrator.runCycle()
            ├─ orchestrator.runAgent('market_sentinel', prompt)
            │    └─ agent.run(prompt)
            │         └─ Anthropic API (claude-opus-4-5 or similar)
            │              ├─ tool_use: { name: 'get_market_data', input: {...} }
            │              │    └─ toolExecutor.execute('get_market_data', input)
            │              │         └─ engineClient.getQuotes([...])
            │              │              └─ GET http://localhost:8000/api/v1/data/quotes?tickers=...
            │              └─ returns: AgentResult { success, data, durationMs }
            ├─ orchestrator.runAgent('strategy_analyst', prompt)
            ├─ orchestrator.runAgent('risk_monitor', prompt)
            └─ orchestrator.runAgent('execution_monitor', prompt)
```

---

## The 5 Agents: Full Details

### Market Sentinel

- **Role key:** `market_sentinel`
- **Cooldown:** 5 minutes
- **Schedule:** Automatic (every cycle)
- **Prompt focus:** Scans AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META, SPY for price movements, unusual volume, regime changes. Creates alerts.
- **Tools used:** `get_market_data`, `get_market_sentiment`, `create_alert`

### Strategy Analyst

- **Role key:** `strategy_analyst`
- **Cooldown:** 15 minutes
- **Schedule:** Automatic (every cycle)
- **Prompt focus:** Runs all strategies on watchlist tickers, identifies top signals by conviction, explains setups.
- **Tools used:** `run_strategy_scan`, `get_strategy_info`, `analyze_ticker`

### Risk Monitor

- **Role key:** `risk_monitor`
- **Cooldown:** 1 minute
- **Schedule:** Automatic (every cycle)
- **Prompt focus:** Assesses drawdown, concentration, sector exposure. Validates proposed trades. Calculates position sizes.
- **Tools used:** `assess_portfolio_risk`, `check_risk_limits`, `calculate_position_size`

### Research Analyst

- **Role key:** `research`
- **Cooldown:** 30 minutes
- **Schedule:** On-demand (`orchestrator.research(ticker)`)
- **Prompt focus:** Deep analysis on one ticker — RSI, MACD, Bollinger Bands, support/resistance, trend strength.
- **Tools used:** `analyze_ticker`, `get_market_data`, `run_strategy_scan`

### Execution Monitor

- **Role key:** `execution_monitor`
- **Cooldown:** 10 seconds
- **Schedule:** Automatic (every cycle, after risk check)
- **Prompt focus:** Checks open orders, prepares approved trades for execution, monitors fill quality.
- **Tools used:** `get_open_orders`, `submit_order`

---

## OrchestratorState Shape

```typescript
interface OrchestratorState {
  agents: Record<AgentRole, 'idle' | 'running' | 'error'>;
  lastRun: Record<AgentRole, string | null>; // ISO timestamp or null
  cycleCount: number;
  halted: boolean;
  lastCycleAt: string | null;
}
```

State is **in-memory only** — lost on restart. There is no persistent state store for the orchestrator.

---

## Orchestrator Public API

```typescript
class Orchestrator {
  get currentState(): OrchestratorState;

  // Run the full 4-phase cycle (market → strategy → risk → execution)
  async runCycle(): Promise<AgentResult[]>;

  // Run a specific agent with a custom prompt
  async runAgent(role: AgentRole, prompt: string): Promise<AgentResult>;

  // On-demand deep research on a ticker
  async research(ticker: string): Promise<AgentResult>;

  // Start automated cycles at intervalMs (default: 15 minutes)
  start(intervalMs?: number): void;

  // Stop automated cycles (does not halt trading)
  stop(): void;

  // Emergency halt — stops cycles AND skips execution within running cycles
  halt(reason: string): void;

  // Clear halt flag and resume
  resume(): void;

  // Get agent status for dashboard display
  getAgentInfo(): Array<{ role; name; description; status; lastRun; enabled }>;
}
```

---

## HTTP Server Endpoints

The agents app runs an Express server (`apps/agents/src/server.ts`) on `AGENTS_PORT` (default 3001):

| Method | Path                | Description                                 |
| ------ | ------------------- | ------------------------------------------- |
| `GET`  | `/health`           | Service health + orchestrator state         |
| `GET`  | `/agents`           | Agent info array (status, lastRun, etc.)    |
| `POST` | `/halt`             | Halt trading with `{ reason: string }` body |
| `POST` | `/resume`           | Clear halt and resume                       |
| `POST` | `/cycle`            | Trigger a manual cycle immediately          |
| `POST` | `/research/:ticker` | Trigger on-demand research                  |

---

## Tool Registration Pattern

Tools are defined in `apps/agents/src/agent.ts` as the `tools` array passed to the Anthropic API. Each tool follows this structure:

```typescript
{
  name: 'my_tool_name',
  description: 'What this tool does and when to use it. Be specific.',
  input_schema: {
    type: 'object' as const,
    properties: {
      ticker: {
        type: 'string',
        description: 'Stock ticker symbol (e.g., AAPL)',
      },
      quantity: {
        type: 'number',
        description: 'Number of shares',
      },
    },
    required: ['ticker'],
  },
}
```

The `tool-executor.ts` `dispatch()` switch maps `name` strings to private methods.

---

## Market Hours Logic

The `scheduler.ts` checks market hours before each cycle:

- Trading days: Monday–Friday
- Market hours: 9:30 AM – 4:00 PM Eastern Time
- Cycles are skipped (not queued) when outside market hours

The scheduler uses the system clock. In development, temporarily modify the `isMarketOpen()` check to always return `true` to test agent cycles outside market hours.

---

## Agent Anthropic API Call Pattern (`agent.ts`)

Each agent makes a streaming or non-streaming call to Claude with:

1. A system prompt defining the agent's role and access to tools
2. The cycle prompt as the user message
3. The full `tools` array

The agent handles the `tool_use` → `tool_result` loop automatically until the model returns a final `text` response. The result is wrapped in `AgentResult`:

```typescript
interface AgentResult {
  role: AgentRole;
  success: boolean;
  timestamp: string; // ISO string
  durationMs: number;
  data: string | null; // model's final text response
  error: string | null;
}
```

---

## Recommendations vs Direct Orders

`submit_order` in the tool executor does **not** submit a live order. It creates a `recommendation` record in Supabase via `recommendations-store.ts`. The workflow:

1. Execution Monitor calls `submit_order` tool
2. Tool executor writes to `recommendations` table with `status: 'pending'`
3. Human reviews and approves in the Agents dashboard
4. Approval triggers the actual order submission to the engine

This human-in-the-loop design is intentional — agents cannot autonomously execute trades.
