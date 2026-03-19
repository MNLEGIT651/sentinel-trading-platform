# Architecture Notes for AI Collaborators

## System overview

Sentinel is a monorepo trading platform with three primary runtime apps and one shared package:

- `apps/web` — dashboard UI and lightweight status APIs.
- `apps/engine` — quant engine, market data, strategies, risk, and order execution.
- `apps/agents` — orchestration layer for AI-assisted recommendations and execution approvals.
- `packages/shared` — shared TypeScript contracts used by web and agents.
- `supabase/` — persistent data model and realtime tables.

## Main cross-app dependencies

### Web -> Engine

The web app depends on engine endpoints for:

- market quotes and bars,
- strategy metadata,
- signal scans,
- risk limits,
- portfolio account and order flows.

If engine response shapes change, web clients and tests must be updated together.

### Agents -> Engine

The agents service depends on the engine for:

- market data,
- strategy scanning,
- risk checks,
- order submission,
- account/position state.

Engine failures can cascade into orchestrator failures.

### Agents/Web -> Supabase

Supabase backs:

- recommendation storage,
- alert storage,
- historical market data,
- portfolio and domain data.

Migration changes must be additive and coordinated.

## Architectural rules

- Shared types are useful, but they are not a substitute for verifying runtime API contracts.
- Prefer explicit translation layers when web or agents need UI-specific or workflow-specific shapes.
- Keep engine route behavior explicit and stable.
- Treat order execution and approval flows as integrity-critical.

## Common failure modes

- response-shape drift between engine and web,
- agent assumptions about engine availability,
- missing env vars causing startup/runtime failures,
- secret persistence in client-side code,
- database changes not reflected in callers/tests.

## Safe change patterns

- Change one boundary at a time.
- Update tests in the same commit as interface changes.
- Add docs when conventions or workflows change.
- Prefer adapters over sweeping rewrites when integrating services.
