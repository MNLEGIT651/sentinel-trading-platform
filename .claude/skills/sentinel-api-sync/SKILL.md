---
name: sentinel-api-sync
description: This skill should be used when adding, changing, or removing any API endpoint in the Sentinel trading platform — including "add an endpoint", "new API route", "change the response shape", "update the API contract", "add a route to the engine", "new engine method", or any time apps/engine/src/api/routes/ is modified. Apply automatically whenever a FastAPI route or Pydantic schema is created or changed.
user-invocable: false
---

# Sentinel API Contract Sync

The engine, web, and agents share an implicit API contract across **6 layers**. Missing any layer causes runtime failures that TypeScript cannot catch at compile time — the call succeeds but the shape is wrong.

## The 6 Layers

Every endpoint change touches these in order:

| #   | Layer                                  | Location                                                   |
| --- | -------------------------------------- | ---------------------------------------------------------- |
| 1   | FastAPI route + handler                | `apps/engine/src/api/routes/*.py`                          |
| 2   | Pydantic request/response models       | Same file, or `src/api/schemas.py`                         |
| 3   | Shared TypeScript interface            | `packages/shared/src/types/index.ts`                       |
| 4   | Shared export                          | `packages/shared/src/index.ts` — `export * from './types'` |
| 5   | Web API client                         | `apps/web/src/lib/engine-client.ts`                        |
| 6   | Agents engine client                   | `apps/agents/src/engine-client.ts`                         |
| 6b  | Agents tool executor _(if applicable)_ | `apps/agents/src/tool-executor.ts`                         |

## When to Update Layer 6b (Tool Executor)

Only update `tool-executor.ts` if the endpoint is something agents should call autonomously. Currently registered tools: `get_market_data`, `get_market_sentiment`, `run_strategy_scan`, `get_strategy_info`, `assess_portfolio_risk`, `calculate_position_size`, `check_risk_limits`, `submit_order`, `get_open_orders`, `analyze_ticker`, `create_alert`.

Add a new case to the `dispatch()` switch when: the endpoint exposes data agents need for decision-making (market conditions, risk state, portfolio) or actions agents can take (orders, alerts).

Do NOT add tool executor entries for: admin endpoints, batch ingestion, schema introspection, or anything only the web dashboard uses.

## Field Name Convention

All field names stay **snake_case** throughout the entire stack — Python `instrument_id` becomes TypeScript `instrument_id`. There is no camelCase transform anywhere in the fetch layer. Keep them identical.

## Type Drift Warning

The web client (`apps/web/src/lib/engine-client.ts`) currently defines some interfaces locally (`BrokerAccount`, `BrokerPosition`, `OrderResult`) instead of importing from `@sentinel/shared`. When adding **new** types, always add them to `packages/shared/src/types/index.ts` and import from there — do not add more local definitions. This prevents the drift from growing.

## Verification Steps

After updating all layers, run these to catch missed updates:

```bash
# TypeScript errors will surface missing or wrong types
pnpm --filter web build
pnpm --filter agents lint

# Functional verification
.venv/Scripts/python -m pytest apps/engine/tests/unit -x
```

## Reference

See `references/api-layers.md` for a concrete worked example showing all 6 layers for an existing endpoint, field name mapping, and the web/agents client patterns side by side.
