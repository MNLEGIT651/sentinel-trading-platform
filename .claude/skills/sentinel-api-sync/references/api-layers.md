# API Layers Reference

A concrete worked example showing all 6 layers for an existing endpoint, plus patterns for adding new ones.

---

## Worked Example: `GET /api/v1/strategies/`

This endpoint lists all strategies. Trace how it flows through all 6 layers:

### Layer 1 — FastAPI Route (`apps/engine/src/api/routes/strategies.py`)

```python
from fastapi import APIRouter
from .schemas import StrategiesResponse  # or defined inline

router = APIRouter(prefix="/api/v1/strategies", tags=["strategies"])

@router.get("/", response_model=StrategiesResponse)
async def list_strategies():
    strategies = [create_strategy(name) for name in STRATEGY_CLASSES]
    return {
        "strategies": [...],
        "families": list(FAMILY_MAP.keys()),
        "total": len(strategies),
    }
```

### Layer 2 — Pydantic Models (same file or `src/api/schemas.py`)

```python
from pydantic import BaseModel

class StrategyInfo(BaseModel):
    name: str
    family: str
    description: str
    default_params: dict

class StrategiesResponse(BaseModel):
    strategies: list[StrategyInfo]
    families: list[str]
    total: int
```

### Layer 3 — Shared TypeScript Interface (`packages/shared/src/types/index.ts`)

```typescript
// Mirror the Pydantic model exactly — same field names (snake_case)
export interface StrategyInfo {
  name: string;
  family: string;
  description: string;
  default_params: Record<string, unknown>;
}

export interface StrategiesResponse {
  strategies: StrategyInfo[];
  families: string[];
  total: number;
}
```

### Layer 4 — Shared Export (`packages/shared/src/index.ts`)

```typescript
export * from './types'; // already exports everything — just add to types/index.ts
```

### Layer 5 — Web Client (`apps/web/src/lib/engine-client.ts`)

```typescript
import type { StrategiesResponse } from '@sentinel/shared';

export class EngineClient {
  async getStrategies(): Promise<StrategiesResponse> {
    return this.fetch<StrategiesResponse>('/api/v1/strategies/');
  }
}
```

### Layer 6 — Agents Engine Client (`apps/agents/src/engine-client.ts`)

```typescript
import type { StrategiesResponse } from '@sentinel/shared';
// (or define inline if not in shared yet — prefer shared)

async getStrategies(): Promise<StrategiesResponse> {
  return this.request<StrategiesResponse>('/api/v1/strategies/');
}
```

The agents `EngineClient` uses a private `request<T>(path, options?)` helper that prepends the base URL and attaches `Authorization: Bearer <key>`.

---

## Field Name Mapping

All names stay **snake_case** — no transformation occurs anywhere in the fetch layer:

| Python (Pydantic)        | TypeScript (shared)                   | Notes                             |
| ------------------------ | ------------------------------------- | --------------------------------- |
| `instrument_id: str`     | `instrument_id: string`               | UUIDs as strings                  |
| `avg_entry_price: float` | `avg_entry_price: number`             | Python float → TS number          |
| `created_at: datetime`   | `created_at: string`                  | datetime serializes to ISO string |
| `metadata: dict`         | `metadata: Record<string, unknown>`   | JSONB dict                        |
| `parameters: dict`       | `parameters: Record<string, unknown>` | JSONB dict                        |
| `is_active: bool`        | `is_active: boolean`                  |                                   |
| `Optional[float]`        | `number \| null`                      | Python Optional → TS nullable     |

---

## Type Drift: The Current State

The web client (`apps/web/src/lib/engine-client.ts`) currently defines several types **locally** instead of importing from `@sentinel/shared`:

- `BrokerAccount` — defined locally in web client
- `BrokerPosition` — defined locally in web client
- `ScanResult` / signal shapes — partially duplicated

**Rule for new work:** All new types go in `packages/shared/src/types/index.ts`. Import from `@sentinel/shared` in both web and agents. Do not add new local type definitions.

---

## Adding a New POST Endpoint: Checklist

Example: adding `POST /api/v1/data/backfill` to backfill historical data.

**Engine (`apps/engine/src/api/routes/data.py`):**

```python
class BackfillRequest(BaseModel):
    ticker: str
    days: int = 365

class BackfillResponse(BaseModel):
    ticker: str
    bars_ingested: int
    errors: list[str]

@router.post("/backfill", response_model=BackfillResponse)
async def backfill_data(body: BackfillRequest):
    ...
```

**Shared types (`packages/shared/src/types/index.ts`):**

```typescript
export interface BackfillRequest {
  ticker: string;
  days?: number;
}

export interface BackfillResponse {
  ticker: string;
  bars_ingested: number;
  errors: string[];
}
```

**Web client (`apps/web/src/lib/engine-client.ts`):**

```typescript
async backfillData(params: BackfillRequest): Promise<BackfillResponse> {
  return this.fetch<BackfillResponse>('/api/v1/data/backfill', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
```

**Agents engine client (`apps/agents/src/engine-client.ts`):**

```typescript
async backfillData(params: { ticker: string; days?: number }): Promise<BackfillResponse> {
  return this.request<BackfillResponse>('/api/v1/data/backfill', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
```

**Tool executor** (only if agents should call this autonomously):

```typescript
case 'backfill_data':
  return this.engine.backfillData(input as { ticker: string; days?: number });
```

---

## Common Type Mismatches

| Symptom                           | Cause                                                            | Fix                                  |
| --------------------------------- | ---------------------------------------------------------------- | ------------------------------------ | --------------------- |
| `undefined` where object expected | Pydantic field is `Optional` but TS type is not nullable         | Add `                                | null` to TS interface |
| Numbers showing as strings        | `Decimal`/`NUMERIC` serialized as string in some FastAPI configs | Use `float(value)` in Pydantic model |
| Missing field at runtime          | Field added to Pydantic but not to TS interface                  | Update Layer 3                       |
| `fetch` returns `unknown`         | Generic not specified in `request<T>()` call                     | Add explicit type parameter          |
