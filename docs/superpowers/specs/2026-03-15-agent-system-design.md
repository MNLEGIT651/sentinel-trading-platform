# Sentinel Agent System — Full Implementation Spec (v2)
Date: 2026-03-15
Status: Ready for implementation

## Goal
Wire the 5-agent AI orchestrator to live services so it can scan strategies, generate trade recommendations, and execute approved paper trades on Alpaca. Human approves trades before submission.

## Architecture

```
Next.js :3000  ←→  Agents Server :3001  ←→  FastAPI Engine :8000  ←→  Alpaca Paper API
                           ↓                           ↓
                      Supabase DB (agent_recommendations, agent_alerts, agent_logs)
```

## Agents Server (apps/agents — Express on port 3001)

### Endpoints

| Method | Path | Success | Error cases |
|--------|------|---------|-------------|
| GET | /health | 200 `{status, uptime, cycleCount, halted}` | — |
| GET | /status | 200 `{agents: Record<role, state>, cycleCount, halted, isRunning, nextCycleAt, lastCycleAt}` | — |
| POST | /cycle | 200 `{started: true}` | 409 `{error:'cycle_in_progress'}` if already running; 409 `{error:'halted'}` if halted |
| POST | /halt | 200 `{halted: true}` | — |
| POST | /resume | 200 `{halted: false}` | — |
| GET | /recommendations | 200 `{recommendations: Recommendation[]}` filtered to `status='pending'` by default; `?status=all` for all | — |
| POST | /recommendations/:id/approve | 200 `{orderId, status}` | 404 not found; 409 `{error:'not_pending'}` if status≠pending; 422 `{error:'risk_blocked', detail}` if engine blocks |
| POST | /recommendations/:id/reject | 200 `{status:'rejected'}` | 404; 409 if status≠pending |
| GET | /alerts | 200 `{alerts: Alert[]}` last 50, newest first | — |

### GET /status Response Shape
```ts
{
  agents: {
    market_sentinel: { status: 'idle'|'running'|'error', lastRun: string|null },
    strategy_analyst: { ... },
    risk_monitor: { ... },
    research: { ... },
    execution_monitor: { ... },
  },
  cycleCount: number,
  halted: boolean,
  isRunning: boolean,
  nextCycleAt: string|null,  // ISO timestamp of next scheduled cycle, null if outside market hours or halted
  lastCycleAt: string|null,
}
```

### CORS
```ts
cors({ origin: process.env.WEB_URL ?? 'http://localhost:3000' })
```
Never wildcard. `WEB_URL` env var overrides in production.

### Graceful Shutdown
On SIGTERM/SIGINT: stop scheduler, wait for in-progress cycle to complete (max 60s), then exit.

## Scheduler

`node-cron` expression: `*/15 9-16 * * 1-5` (every 15 min, 9am–4pm, Mon–Fri).

Market hours check uses `Intl.DateTimeFormat` with `America/New_York` to get wall-clock ET time, handles DST automatically:

```ts
function isMarketOpen(): boolean {
  const now = new Date();
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', hour12: false,
    weekday: 'short',
  }).formatToParts(now);
  const weekday = etParts.find(p => p.type === 'weekday')?.value;
  const hour = parseInt(etParts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = parseInt(etParts.find(p => p.type === 'minute')?.value ?? '0');
  const timeVal = hour * 60 + minute;
  const isWeekday = !['Sat', 'Sun'].includes(weekday ?? '');
  return isWeekday && timeVal >= 9 * 60 + 30 && timeVal < 16 * 60;
}
```

Skip cycle if: `!isMarketOpen() || state.halted || state.isRunning`.

## Tool Wiring

### `submit_order` — WRITES RECOMMENDATION, DOES NOT EXECUTE
The agent calls this when it wants to propose a trade. It does NOT submit to Alpaca.
It writes a row to `agent_recommendations` with `status='pending'` and returns:
```json
{ "recommendation_id": "<uuid>", "status": "pending", "message": "Trade recommendation submitted for human review." }
```
The agent's perspective: it has proposed a trade. A human must approve it.

### `assess_portfolio_risk` — SEQUENTIAL FETCH
1. `GET /portfolio/account` → get `equity`, `cash`, `buying_power`
2. `GET /portfolio/positions` → get positions as `Record<ticker, quantity_value>`
3. `POST /risk/assess` with real values from steps 1 and 2
4. Return the risk assessment with real drawdown, concentrations, alerts

### `check_risk_limits` — REAL DECISION LOGIC
1. Call `POST /risk/assess` with real portfolio + proposed trade parameters
2. Response contains `halted: boolean` and `alerts: [{severity, action}]`
3. Return `passed: false` if `response.halted === true` OR any alert has `action === 'halt'`
4. Return `passed: true` with sizing recommendations otherwise

### `run_strategy_scan` — TWO-STEP FLOW
1. `POST /data/ingest` with tickers + timeframe (optional, best-effort)
2. `POST /strategies/scan` with tickers, days=90, min_strength=0.3
3. Return signals array with ticker, direction, strength, strategy_name, reason
4. If Polygon rate limited, return partial results with errors array

### `analyze_ticker` — REAL SCAN
Call `POST /strategies/scan` with `tickers=[ticker]`, `days=90`, `min_strength=0.0`.
Return all signals for that ticker plus computed summary (trend bias, strongest signal).

### `get_market_sentiment` — SPY-BASED DERIVATION
Call `GET /data/quotes?tickers=SPY,QQQ,IWM` to get current prices + day change pct.
Compute sentiment:
- `bullish` if SPY change > +0.3%
- `bearish` if SPY change < -0.3%
- `neutral` otherwise
Return drivers array with actual price change data, not hardcoded strings.

### `get_market_data` — INGEST + QUOTES
1. `POST /data/ingest` with tickers (fire-and-forget on error)
2. `GET /data/quotes?tickers=<csv>` for current prices
3. Return prices dict with actual values

### `get_strategy_info` — UNCHANGED (already real)

### `calculate_position_size` — FETCH EQUITY FIRST
Get real equity from `GET /portfolio/account` before calling `POST /risk/position-size`.

### `get_open_orders` — REAL
Call `GET /portfolio/orders?status=open` on engine.

### `create_alert` — WRITE TO SUPABASE
Insert row into `agent_alerts`. Returns the created alert with id.

## Recommendation Approval State Machine

```
pending → approved (human clicks Approve → engine POST /portfolio/orders succeeds)
pending → rejected (human clicks Reject)
approved → filled (Alpaca broker: status from engine is 'filled' or 'submitted')
approved → risk_blocked (engine returns 422 — risk check blocked)
```

Approve endpoint must use atomic Supabase update:
```sql
UPDATE agent_recommendations
SET status = 'approved', reviewed_at = now()
WHERE id = $1 AND status = 'pending'
RETURNING id
```
If 0 rows updated → 409 `{error: 'not_pending'}` (prevents double-submission).

On engine 422 → set status back to `'pending'` with `metadata.block_reason`, return 422 to web.
On engine success → set `status = 'filled'`, store `order_id` from engine response.

## Supabase Schema (migration 00003)

Note: Existing `alerts` table requires `user_id` FK (auth user). Agent alerts come from the agent system which has no auth user. Use separate `agent_alerts` table. The existing `agent_logs` table is used for cycle run logging.

```sql
-- Trade recommendations from agents (pending human approval)
CREATE TABLE agent_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  agent_role text NOT NULL,
  ticker text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity numeric(18,6) NOT NULL,  -- numeric not integer: Alpaca supports fractional shares
  order_type text NOT NULL DEFAULT 'market' CHECK (order_type IN ('market', 'limit')),
  limit_price numeric(18,6),
  reason text,
  strategy_name text,
  signal_strength numeric(5,4),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'filled', 'risk_blocked')),
  order_id text,          -- Alpaca order ID, set after approval
  reviewed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'
);

-- Alerts created by agents (no user_id — agents run without auth context)
CREATE TABLE agent_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  ticker text,
  acknowledged boolean NOT NULL DEFAULT false
);

-- Indexes
CREATE INDEX agent_recommendations_status_idx ON agent_recommendations(status, created_at DESC);
CREATE INDEX agent_alerts_created_idx ON agent_alerts(created_at DESC);
```

## Environment Variables

All required env vars for `apps/agents`:
```env
# Existing (already in root .env, loaded via dotenv)
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # service role key — agents write directly, bypass RLS
ENGINE_URL=http://localhost:8000
ENGINE_API_KEY=sentinel-dev-key

# New
AGENTS_PORT=3001
WEB_URL=http://localhost:3000
```

## New Dependencies (apps/agents/package.json)
- `express` + `@types/express`
- `cors` + `@types/cors`
- `node-cron` + `@types/node-cron`
- `@supabase/supabase-js`
- `dotenv`

## File Changes

### New
- `apps/agents/src/server.ts` — Express app with all endpoints
- `apps/agents/src/scheduler.ts` — Market hours check + cron job
- `apps/agents/src/supabase-client.ts` — Supabase JS client (service role)
- `apps/agents/src/recommendations-store.ts` — CRUD: create, list, atomicApprove, reject
- `apps/web/src/lib/agents-client.ts` — HTTP client for agents server
- `supabase/migrations/00003_agent_tables.sql`

### Modified
- `apps/agents/src/tool-executor.ts` — Wire all 11 tools (no mocks except get_market_sentiment which uses live SPY data)
- `apps/agents/src/engine-client.ts` — Add getAccount(), getPositions(), submitOrder(), scanStrategies(), getQuotes()
- `apps/agents/src/index.ts` — Boot Express server + scheduler
- `apps/agents/package.json` — Add new deps
- `apps/web/src/app/agents/page.tsx` — Connect to real agents server, show recommendations + real logs
- `.env.example` — Add AGENTS_PORT, WEB_URL

## Testing Plan

### Unit tests (apps/agents/tests/)
- `scheduler.test.ts`: isMarketOpen() returns true Mon-Fri 9:30-15:59 ET; false on weekends; false at 9:29 and 16:00; false during halt; 409 response when cycle already running
- `recommendations-store.test.ts`: create, list pending, atomic approve (verify 0-rows case returns null), reject
- `server.test.ts`: all 9 endpoints with mocked orchestrator — including 409 cycle_in_progress, 409 not_pending, 422 risk_blocked, 404 not found

### Web tests (apps/web/tests/)
- `agents.test.tsx`: Approve button calls POST /recommendations/:id/approve; Reject calls reject endpoint; 422 shows error state; pending recommendations render correctly; real agent log entries render
