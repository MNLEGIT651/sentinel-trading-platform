# Sentinel Trading Platform — Completion Sprint Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all remaining Sentinel features: live connector verification, wired strategies/backtest/dashboard pages, order-fill polling, `lastCycleAt` tracking, CI/CD pipeline, and Docker containerisation.

**Architecture:** Five independent chunks executed in parallel where possible. All changes follow the established patterns: `useEffect` + direct `fetch` in client pages, FastAPI Pydantic models on the engine, Vitest for web/agents tests, pytest for the engine. Every change is TDD-first.

**Tech Stack:** Next.js 15 (TypeScript), FastAPI (Python 3.14), Express + Vitest (TypeScript agents), Supabase, GitHub Actions, Docker / docker-compose.

---

## Chunk 1: Connector Verification — Real Health Checks

**Files:**
- Modify: `apps/web/src/app/api/settings/status/route.ts`
- Modify: `apps/web/src/app/settings/page.tsx`
- Create: `apps/web/tests/pages/settings.test.tsx` *(replace existing stub tests)*

### Task 1.1 — Extend `/api/settings/status` to perform live connectivity probes

The current route checks only env-var presence. Replace each check with an actual outbound call so "Connected" means the remote API answered.

- [ ] **Read** `apps/web/src/app/api/settings/status/route.ts`

- [ ] **Replace** the file content with real probes:

```typescript
import { NextResponse } from 'next/server';

type ServiceStatus = 'connected' | 'disconnected' | 'not_configured';

interface StatusResponse {
  engine: ServiceStatus;
  polygon: ServiceStatus;
  supabase: ServiceStatus;
  anthropic: ServiceStatus;
  alpaca: ServiceStatus;
}

async function probe(fn: () => Promise<void>): Promise<'connected' | 'disconnected'> {
  try {
    await fn();
    return 'connected';
  } catch {
    return 'disconnected';
  }
}

export async function GET(): Promise<NextResponse<StatusResponse>> {
  const signal = AbortSignal.timeout(4000);

  // ── Engine ──────────────────────────────────────────────────────────
  const engineUrl = process.env.ENGINE_URL ?? 'http://localhost:8000';
  const engineKey = process.env.ENGINE_API_KEY ?? 'sentinel-dev-key';
  const engine = await probe(async () => {
    const r = await fetch(`${engineUrl}/health`, {
      headers: { Authorization: `Bearer ${engineKey}` },
      signal,
      cache: 'no-store',
    });
    if (!r.ok) throw new Error(`${r.status}`);
  });

  // ── Polygon ─────────────────────────────────────────────────────────
  const polygonKey = process.env.POLYGON_API_KEY;
  const polygon: ServiceStatus = !polygonKey
    ? 'not_configured'
    : await probe(async () => {
        const r = await fetch(
          `https://api.polygon.io/v2/aggs/ticker/AAPL/prev?adjusted=true&apiKey=${polygonKey}`,
          { signal, cache: 'no-store' },
        );
        if (!r.ok) throw new Error(`${r.status}`);
      });

  // ── Supabase ─────────────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase: ServiceStatus = !supabaseUrl || !supabaseKey
    ? 'not_configured'
    : await probe(async () => {
        // Hit the Supabase REST health endpoint
        const r = await fetch(`${supabaseUrl}/rest/v1/`, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          signal,
          cache: 'no-store',
        });
        if (!r.ok) throw new Error(`${r.status}`);
      });

  // ── Anthropic ────────────────────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const anthropic: ServiceStatus = !anthropicKey
    ? 'not_configured'
    : await probe(async () => {
        // Models list endpoint — tiny, auth-only, no credits consumed
        const r = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          signal,
          cache: 'no-store',
        });
        if (!r.ok) throw new Error(`${r.status}`);
      });

  // ── Alpaca ───────────────────────────────────────────────────────────
  const alpacaKey = process.env.ALPACA_API_KEY;
  const alpacaSecret = process.env.ALPACA_SECRET_KEY;
  const alpacaBase = process.env.ALPACA_BASE_URL ?? 'https://paper-api.alpaca.markets/v2';
  const alpaca: ServiceStatus = !alpacaKey || !alpacaSecret
    ? 'not_configured'
    : await probe(async () => {
        const r = await fetch(`${alpacaBase}/account`, {
          headers: {
            'APCA-API-KEY-ID': alpacaKey,
            'APCA-API-SECRET-KEY': alpacaSecret,
          },
          signal,
          cache: 'no-store',
        });
        if (!r.ok) throw new Error(`${r.status}`);
      });

  return NextResponse.json({ engine, polygon, supabase, anthropic, alpaca });
}
```

- [ ] **Run build** to verify TypeScript compiles:
  ```
  cd apps/web && pnpm build
  ```
  Expected: `✓ Compiled successfully`

### Task 1.2 — Add "Test Connections" button to Settings page

- [ ] **Edit** `apps/web/src/app/settings/page.tsx` — add a refresh button next to "Service Status" header and a loading state:

Locate the `CardHeader` for Service Status (~line 207) and replace:
```tsx
<CardHeader className="pb-2">
  <CardTitle className="text-sm font-medium text-muted-foreground">
    Service Status
  </CardTitle>
</CardHeader>
```
with:
```tsx
<CardHeader className="pb-2">
  <div className="flex items-center justify-between">
    <CardTitle className="text-sm font-medium text-muted-foreground">
      Service Status
    </CardTitle>
    <button
      onClick={checkConnections}
      disabled={checkingConnections}
      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
    >
      <RefreshCw className={cn('h-3 w-3', checkingConnections && 'animate-spin')} />
      {checkingConnections ? 'Checking...' : 'Test'}
    </button>
  </div>
</CardHeader>
```

- [ ] **Add** `RefreshCw` to the import list at the top of `settings/page.tsx` (it's already in `portfolio/page.tsx` — same import syntax).

- [ ] **Add** two new state variables after the existing `const [saved, setSaved] = useState(false);`:
```tsx
const [checkingConnections, setCheckingConnections] = useState(false);
```

- [ ] **Extract** the status-fetch into a named function `checkConnections` so both the `useEffect` and the button can call it:

Replace the current `fetch('/api/settings/status')` block inside `useEffect` with a call to a new `checkConnections` function defined above the `useEffect`:

```tsx
const checkConnections = useCallback(async () => {
  setCheckingConnections(true);
  try {
    const r = await fetch('/api/settings/status');
    const data = await r.json() as ServiceStatuses;
    setServiceStatus(data);
  } catch {
    setServiceStatus({
      engine: 'disconnected',
      polygon: 'not_configured',
      supabase: 'not_configured',
      anthropic: 'not_configured',
      alpaca: 'not_configured',
    });
  } finally {
    setCheckingConnections(false);
  }
}, []);
```

- [ ] **Add** `useCallback` to the React import line (alongside the existing `useState`, `useEffect`).

- [ ] **Update** `useEffect` to call `checkConnections()` instead of the inline fetch.

- [ ] **Run build** again:
  ```
  cd apps/web && pnpm build
  ```
  Expected: `✓ Compiled successfully`

### Task 1.3 — Fix settings tests (mock the new fetch calls)

The settings page now calls `fetch('/api/settings/status')` on mount. Tests need to mock this.

- [ ] **Replace** `apps/web/tests/pages/settings.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPage from '@/app/settings/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useRouter: () => ({ push: vi.fn() }),
}));

// Provide localStorage stub
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      engine: 'connected',
      polygon: 'connected',
      supabase: 'connected',
      anthropic: 'connected',
      alpaca: 'connected',
    }),
  }));
});

describe('SettingsPage', () => {
  it('renders the settings header', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows Save Changes button', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('displays connection status section', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Service Status')).toBeInTheDocument();
    expect(screen.getByText('Quant Engine (FastAPI)')).toBeInTheDocument();
  });

  it('shows tab navigation', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('tab', { name: /API Keys/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Risk/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Trading/i })).toBeInTheDocument();
  });

  it('Save Changes stores to localStorage', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Save Changes'));
    expect(localStorageMock.getItem('sentinel:settings')).not.toBeNull();
  });

  it('Save Changes shows "Saved" feedback momentarily', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Save Changes'));
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('can switch to Risk tab', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Risk/i }));
    expect(screen.getByText('Position Limits')).toBeInTheDocument();
  });

  it('can switch to Notifications tab', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Notifications/i }));
    expect(screen.getByText('Critical Alerts')).toBeInTheDocument();
  });

  it('can switch to Trading tab', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Trading/i }));
    expect(screen.getByText('Paper Trading Mode')).toBeInTheDocument();
  });

  it('shows system information on Trading tab', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Trading/i }));
    expect(screen.getByText('Sentinel Trading v0.1.0')).toBeInTheDocument();
  });
});
```

- [ ] **Run** web tests to confirm they pass:
  ```
  cd apps/web && pnpm test
  ```
  Expected: All tests pass.

- [ ] **Commit:**
  ```
  git add apps/web/src/app/api/settings/status/route.ts \
          apps/web/src/app/settings/page.tsx \
          apps/web/tests/pages/settings.test.tsx
  git commit -m "feat(settings): real connector health probes + Test button"
  ```

---

## Chunk 2: Quick Agent Fixes — `lastCycleAt` + Order-Fill Polling

**Files:**
- Modify: `apps/agents/src/orchestrator.ts`
- Modify: `apps/agents/src/server.ts`
- Modify: `apps/agents/tests/orchestrator.test.ts`
- Modify: `apps/web/src/app/portfolio/page.tsx`
- Modify: `apps/web/tests/pages/portfolio.test.tsx`

### Task 2.1 — Track `lastCycleAt` in Orchestrator

- [ ] **Edit** `apps/agents/src/orchestrator.ts`

In the `OrchestratorState` type (imported from `./types.js`), check if `lastCycleAt` is already present. It likely isn't.

- [ ] **Edit** `apps/agents/src/types.ts` — add `lastCycleAt` to `OrchestratorState`:

Find the `OrchestratorState` interface and add:
```typescript
lastCycleAt: string | null;
```

- [ ] **Edit** `apps/agents/src/orchestrator.ts` — initialise and set it:

In the constructor `this.state = { ... }` block, add:
```typescript
lastCycleAt: null,
```

At the **end** of `runCycle()`, just before `return results;`, add:
```typescript
this.state.lastCycleAt = new Date().toISOString();
```

- [ ] **Edit** `apps/agents/src/server.ts` — replace the TODO line:

Find:
```typescript
lastCycleAt: null, // TODO: track in Orchestrator state
```
Replace with:
```typescript
lastCycleAt: state.lastCycleAt,
```

- [ ] **Edit** `apps/agents/tests/orchestrator.test.ts` — add a test for `lastCycleAt`:

After the existing cycle count test, add:
```typescript
it('records lastCycleAt after runCycle completes', async () => {
  const before = Date.now();
  await orchestrator.runCycle();
  const state = orchestrator.currentState;
  expect(state.lastCycleAt).not.toBeNull();
  expect(new Date(state.lastCycleAt!).getTime()).toBeGreaterThanOrEqual(before);
});
```

- [ ] **Run** agents tests:
  ```
  cd apps/agents && pnpm test
  ```
  Expected: All tests pass.

- [ ] **Commit:**
  ```
  git add apps/agents/src/types.ts apps/agents/src/orchestrator.ts \
          apps/agents/src/server.ts apps/agents/tests/orchestrator.test.ts
  git commit -m "feat(agents): track and expose lastCycleAt in orchestrator state"
  ```

### Task 2.2 — Order-fill polling in Portfolio page

Alpaca paper orders can take several seconds to fill. Currently a single 500ms `setTimeout` is used. Replace with a proper polling loop.

- [ ] **Edit** `apps/web/src/app/portfolio/page.tsx`

Find `handleSubmitOrder` (~line 247). Replace the `setTimeout` at the bottom:

```typescript
// Replace this:
setTimeout(() => fetchPortfolio(), 500);

// With this — poll for up to 20 seconds until order is no longer open:
const orderId = (result as { order_id?: string }).order_id;
if (orderId) {
  const POLL_INTERVAL = 2000;
  const MAX_POLLS = 10;
  let polls = 0;
  const poll = async () => {
    try {
      const ordersRes = await fetch(
        `${ENGINE_URL}/api/v1/portfolio/orders?status=open`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!ordersRes.ok) return;
      const orders = await ordersRes.json() as Array<{ order_id: string; status: string }>;
      const isStillOpen = orders.some((o) => o.order_id === orderId);
      if (!isStillOpen || polls >= MAX_POLLS) {
        await fetchPortfolio();
        return;
      }
    } catch { /* ignore */ }
    polls++;
    setTimeout(poll, POLL_INTERVAL);
  };
  setTimeout(poll, POLL_INTERVAL);
} else {
  setTimeout(() => fetchPortfolio(), 500);
}
```

- [ ] **Run** web tests:
  ```
  cd apps/web && pnpm test
  ```
  Expected: All tests pass (no portfolio test directly tests the polling, but existing tests must not break).

- [ ] **Commit:**
  ```
  git add apps/web/src/app/portfolio/page.tsx
  git commit -m "feat(portfolio): poll for order fill instead of single 500ms refresh"
  ```

---

## Chunk 3: Page Wires — Strategies + Dashboard Alerts/Signals

**Files:**
- Modify: `apps/web/src/app/strategies/page.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/tests/pages/strategies.test.tsx` *(create if missing)*
- Modify: `apps/engine/src/api/routes/strategies.py` *(no change needed)*

### Task 3.1 — Wire Strategies page to live `GET /api/v1/strategies/`

The engine returns `StrategyListResponse`:
```json
{
  "strategies": [
    { "name": "sma_crossover", "family": "trend_following",
      "description": "...", "default_params": { ... } }
  ],
  "families": ["trend_following", "momentum", ...],
  "total": 8
}
```

The page expects data grouped by family. We map the flat list server-side.

- [ ] **Edit** `apps/web/src/app/strategies/page.tsx`

Add to the top (after `'use client';`):
```typescript
import { useState, useEffect } from 'react';
```
*(Replace the existing `import { useState } from 'react';`)*

Add a type for the engine response:
```typescript
interface EngineStrategyInfo {
  name: string;
  family: string;
  description: string;
  default_params: Record<string, unknown>;
}

interface EngineStrategyListResponse {
  strategies: EngineStrategyInfo[];
  families: string[];
  total: number;
}
```

Add to the top of `StrategiesPage()`, before the `expandedFamilies` state:
```typescript
const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL ?? 'http://localhost:8000';
const [liveData, setLiveData] = useState<typeof strategyFamilies | null>(null);
const [loadingStrategies, setLoadingStrategies] = useState(true);

useEffect(() => {
  fetch(`${ENGINE_URL}/api/v1/strategies/`, { signal: AbortSignal.timeout(5000) })
    .then((r) => r.ok ? r.json() as Promise<EngineStrategyListResponse> : Promise.reject())
    .then((data) => {
      // Group flat strategy list by family, mapping to the page's existing shape
      const familyMap = new Map<string, typeof strategyFamilies[0]['strategies']>();
      for (const s of data.strategies) {
        if (!familyMap.has(s.family)) familyMap.set(s.family, []);
        familyMap.get(s.family)!.push({
          id: s.name,
          name: s.name
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' '),
          description: s.description,
          version: '1.0.0',
          is_active: true,
          parameters: s.default_params,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      setLiveData(
        Array.from(familyMap.entries()).map(([family, strategies]) => ({
          family,
          strategies,
        })),
      );
    })
    .catch(() => {
      // Engine offline — fall back to hardcoded data silently
      setLiveData(null);
    })
    .finally(() => setLoadingStrategies(false));
}, [ENGINE_URL]);
```

Replace the line:
```typescript
const totalStrategies = strategyFamilies.reduce(
```
…with:
```typescript
const displayFamilies = liveData ?? strategyFamilies;
const totalStrategies = displayFamilies.reduce(
```
and every subsequent reference to `strategyFamilies` in the JSX → `displayFamilies`.

Also update `expandedFamilies` initial value:
```typescript
const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});

// After liveData loads, expand all families:
useEffect(() => {
  const families = (liveData ?? strategyFamilies).map((f) => f.family);
  setExpandedFamilies(Object.fromEntries(families.map((f) => [f, true])));
}, [liveData]);
```

Add a loading skeleton before the family list:
```tsx
{loadingStrategies ? (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  </div>
) : (
  <div className="space-y-3">
    {displayFamilies.map(/* existing map */)}
  </div>
)}
```

Add `Loader2` to the lucide-react import.

- [ ] **Run** web tests:
  ```
  cd apps/web && pnpm test
  ```
  Expected: Pass (strategies page is not tested yet so no failures).

- [ ] **Create** `apps/web/tests/pages/strategies.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import StrategiesPage from '@/app/strategies/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/strategies',
  useRouter: () => ({ push: vi.fn() }),
}));

const mockEngineResponse = {
  strategies: [
    {
      name: 'sma_crossover',
      family: 'trend_following',
      description: 'SMA crossover strategy.',
      default_params: { fast_period: 20, slow_period: 50 },
    },
    {
      name: 'rsi_momentum',
      family: 'momentum',
      description: 'RSI momentum strategy.',
      default_params: { rsi_period: 14 },
    },
  ],
  families: ['trend_following', 'momentum'],
  total: 2,
};

describe('StrategiesPage — live data', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockEngineResponse,
    }));
  });

  it('renders page header', () => {
    render(<StrategiesPage />);
    expect(screen.getByText('Strategies')).toBeInTheDocument();
  });

  it('shows live strategy names after fetch', async () => {
    render(<StrategiesPage />);
    await waitFor(() =>
      expect(screen.getByText(/Sma Crossover/i)).toBeInTheDocument(),
    );
  });

  it('shows family groups from live data', async () => {
    render(<StrategiesPage />);
    await waitFor(() =>
      expect(screen.getByText('Trend Following')).toBeInTheDocument(),
    );
  });
});

describe('StrategiesPage — engine offline fallback', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });

  it('falls back to hardcoded data when engine is offline', async () => {
    render(<StrategiesPage />);
    // hardcoded data has SMA Crossover in trend_following
    await waitFor(() =>
      expect(screen.getByText('SMA Crossover')).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Run** web tests:
  ```
  cd apps/web && pnpm test
  ```
  Expected: All tests pass including new strategies tests.

- [ ] **Commit:**
  ```
  git add apps/web/src/app/strategies/page.tsx \
          apps/web/tests/pages/strategies.test.tsx
  git commit -m "feat(strategies): wire to live engine GET /strategies/ with offline fallback"
  ```

### Task 3.2 — Dashboard: real agent alerts + recent signals

- [ ] **Edit** `apps/web/src/app/page.tsx`

Add `AGENTS_URL` constant after `ENGINE_URL`:
```typescript
const AGENTS_URL = process.env.NEXT_PUBLIC_AGENTS_URL ?? 'http://localhost:3001';
```

Add `alerts` state and an import for `AgentAlert`:
```typescript
import type { AgentAlert } from '@/lib/agents-client';

const [alerts, setAlerts] = useState<Alert[]>(sampleAlerts);
const [recentSignals, setRecentSignals] = useState<Array<{
  ticker: string; side: string; reason: string; strength: number | null; ts: string;
}>>([]);
```

Add a new `fetchAlerts` callback and call it in the same `useEffect` as `fetchPrices`/`fetchAccount`:
```typescript
const fetchAlerts = useCallback(async () => {
  try {
    const [alertsRes, recsRes] = await Promise.allSettled([
      fetch(`${AGENTS_URL}/alerts`, { signal: AbortSignal.timeout(3000) }),
      fetch(`${AGENTS_URL}/recommendations?status=filled`, { signal: AbortSignal.timeout(3000) }),
    ]);

    if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
      const data = await alertsRes.value.json() as { alerts: AgentAlert[] };
      if (data.alerts.length > 0) {
        setAlerts(data.alerts.map((a) => ({
          id: a.id,
          account_id: null,
          instrument_id: a.ticker ?? null,
          severity: a.severity,
          status: 'active' as const,
          title: a.title,
          message: a.message,
          metadata: null,
          triggered_at: a.created_at,
          acknowledged_at: null,
          resolved_at: null,
          created_at: a.created_at,
        })));
      }
    }

    if (recsRes.status === 'fulfilled' && recsRes.value.ok) {
      const data = await recsRes.value.json() as {
        recommendations: Array<{
          ticker: string; side: string; reason?: string;
          signal_strength?: number | null; created_at: string;
        }>
      };
      setRecentSignals(
        data.recommendations.slice(0, 5).map((r) => ({
          ticker: r.ticker,
          side: r.side,
          reason: r.reason ?? '',
          strength: r.signal_strength ?? null,
          ts: r.created_at,
        })),
      );
    }
  } catch {
    // Agents offline — keep sampleAlerts
  }
}, []);
```

Update the `useEffect` mounting block to also call `fetchAlerts()`.

Replace the static "Active Signals" card content with a live render:
```tsx
<CardContent>
  {recentSignals.length === 0 ? (
    <p className="text-sm text-muted-foreground py-8 text-center">
      No recent signals. Strategies generate signals during market hours.
    </p>
  ) : (
    <div className="space-y-2">
      {recentSignals.map((s, i) => (
        <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded',
              s.side === 'buy' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss',
            )}>
              {s.side.toUpperCase()}
            </span>
            <span className="text-sm font-semibold text-foreground">{s.ticker}</span>
          </div>
          <div className="text-right">
            {s.strength != null && (
              <span className="text-xs font-mono text-muted-foreground">
                {(s.strength * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )}
</CardContent>
```

Replace `<AlertFeed alerts={sampleAlerts} />` with `<AlertFeed alerts={alerts} />`.

- [ ] **Run** web tests:
  ```
  cd apps/web && pnpm test
  ```
  Expected: All tests pass.

- [ ] **Commit:**
  ```
  git add apps/web/src/app/page.tsx
  git commit -m "feat(dashboard): wire live agent alerts and recent signals feed"
  ```

---

## Chunk 4: Backtest Page — Wire to Engine API

**Files:**
- Modify: `apps/engine/src/api/routes/backtest.py`
- Modify: `apps/web/src/app/backtest/page.tsx`
- Modify: `apps/web/tests/pages/backtest.test.tsx`
- Modify: `apps/engine/tests/unit/test_backtest.py` *(add API trade output test)*

### Task 4.1 — Add `trades` to the engine backtest response

The `BacktestEngine.run()` returns `result.trades` (list of `TradeRecord` dataclasses) but the API doesn't expose them. Add them.

- [ ] **Edit** `apps/engine/src/api/routes/backtest.py`

Add a `TradeOut` model after `BacktestSummary`:
```python
class TradeOut(BaseModel):
    """Individual trade record."""
    side: str
    entry_bar: int
    exit_bar: int
    entry_price: float
    exit_price: float
    pnl: float
    return_pct: float
```

Update `BacktestResponse` to include trades:
```python
class BacktestResponse(BaseModel):
    """Full backtest result."""
    summary: BacktestSummary
    equity_curve: list[float]
    drawdown_curve: list[float]
    trade_count: int
    trades: list[TradeOut]
```

Update `run_backtest` to populate `trades`:
```python
return BacktestResponse(
    summary=BacktestSummary(**summary),
    equity_curve=result.equity_curve.equity.tolist(),
    drawdown_curve=result.equity_curve.drawdown.tolist(),
    trade_count=result.total_trades,
    trades=[
        TradeOut(
            side=t.side,
            entry_bar=int(t.entry_bar),
            exit_bar=int(t.exit_bar),
            entry_price=float(t.entry_price),
            exit_price=float(t.exit_price),
            pnl=float(t.pnl),
            return_pct=float((t.exit_price - t.entry_price) / t.entry_price * 100),
        )
        for t in result.trades
    ],
)
```

- [ ] **Run** engine tests to confirm nothing broke:
  ```
  cd apps/engine && .venv/Scripts/python -m pytest tests/unit/test_backtest.py -v
  ```
  Expected: All existing tests pass.

- [ ] **Add** a test for the new `trades` field in `apps/engine/tests/unit/test_backtest.py`:

In `TestBacktestAPI`, add:
```python
def test_backtest_response_includes_trades(self, client: TestClient) -> None:
    """Backtest response should include a trades list."""
    payload = {
        "strategy_name": "sma_crossover",
        "bars": 100,
        "trend": "up",
        "seed": 1,
    }
    response = client.post("/api/v1/backtest/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "trades" in data
    assert isinstance(data["trades"], list)
    if data["trades"]:
        trade = data["trades"][0]
        assert "side" in trade
        assert "entry_price" in trade
        assert "pnl" in trade
```

- [ ] **Run** engine tests again:
  ```
  cd apps/engine && .venv/Scripts/python -m pytest tests/unit/test_backtest.py -v
  ```
  Expected: All tests pass including new test.

- [ ] **Commit (engine):**
  ```
  git add apps/engine/src/api/routes/backtest.py \
          apps/engine/tests/unit/test_backtest.py
  git commit -m "feat(engine): expose trade records in backtest API response"
  ```

### Task 4.2 — Wire backtest page to engine API

The engine summary returns **strings** (formatted like `"12.50%"`, `"1.234"`). Parse them to numbers for display logic (color-coding). Display them directly as text for labels.

- [ ] **Edit** `apps/web/src/app/backtest/page.tsx`

**Step A — Add types for engine response:**

After `BacktestResult` interface, add:
```typescript
// Engine API response types (summary fields are pre-formatted strings)
interface EngineBacktestSummary {
  strategy: string;
  ticker: string;
  total_return: string;      // e.g. "12.50%"
  annualized_return: string;
  max_drawdown: string;      // e.g. "-8.32%"
  sharpe_ratio: string;
  sortino_ratio: string;
  win_rate: string;          // e.g. "55.0%"
  profit_factor: string;
  total_trades: number;
  avg_holding_bars: string;
}

interface EngineBacktestResponse {
  summary: EngineBacktestSummary;
  equity_curve: number[];
  drawdown_curve: number[];
  trade_count: number;
  trades: BacktestResult['trades'];
}

/** Parse "12.50%" → 0.125, or "1.234" → 1.234 */
function parsePct(s: string): number {
  if (s.endsWith('%')) return parseFloat(s) / 100;
  return parseFloat(s);
}
```

**Step B — Replace `handleRun` with engine-first execution:**

```typescript
const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL ?? 'http://localhost:8000';

const handleRun = useCallback(async () => {
  setIsRunning(true);
  setError(null);

  try {
    const seed = Math.floor(Math.random() * 100_000);
    const res = await fetch(`${ENGINE_URL}/api/v1/backtest/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy_name: strategy,
        bars,
        initial_capital: capital,
        trend,
        seed,
        ticker: 'SYNTHETIC',
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { detail?: string };
      throw new Error(err.detail ?? `Engine error ${res.status}`);
    }

    const data: EngineBacktestResponse = await res.json();
    const s = data.summary;

    // Map engine string fields to the numeric BacktestSummary shape
    setResult({
      summary: {
        strategy: s.strategy,
        ticker: s.ticker,
        initial_capital: capital,
        final_equity: capital * (1 + parsePct(s.total_return)),
        total_return: parsePct(s.total_return),
        total_trades: s.total_trades,
        win_rate: parsePct(s.win_rate),
        sharpe_ratio: parseFloat(s.sharpe_ratio),
        sortino_ratio: parseFloat(s.sortino_ratio),
        max_drawdown: parsePct(s.max_drawdown),
        profit_factor: parseFloat(s.profit_factor),
        avg_trade_pnl: 0,
        avg_holding_bars: parseFloat(s.avg_holding_bars),
      },
      equity_curve: data.equity_curve,
      drawdown_curve: data.drawdown_curve,
      trades: data.trades,
    });
    setDataSource('engine');
  } catch (err) {
    // Engine unreachable — fall back to client-side synthetic
    const seed = Math.floor(Math.random() * 100_000);
    const synthetic = runSyntheticBacktest(strategy, bars, trend, capital, seed);
    setResult({ ...synthetic, drawdown_curve: [], dataSource: 'synthetic' });
    setDataSource('synthetic');
    if (err instanceof Error && !err.message.includes('fetch')) {
      setError(err.message);
    }
  } finally {
    setIsRunning(false);
  }
}, [strategy, bars, trend, capital, ENGINE_URL]);
```

**Step C — Add new state variables** at the top of `BacktestPage()`:
```typescript
const [error, setError] = useState<string | null>(null);
const [dataSource, setDataSource] = useState<'engine' | 'synthetic' | null>(null);
```

Update `BacktestResult` interface to include `drawdown_curve`:
```typescript
interface BacktestResult {
  summary: BacktestSummary;
  equity_curve: number[];
  drawdown_curve?: number[];   // add this
  trades: { ... };
}
```

**Step D — Add drawdown curve tab** in the results `Tabs`:

Add a new `TabsTrigger`:
```tsx
<TabsTrigger value="drawdown">Drawdown</TabsTrigger>
```

Add a new `TabsContent` after the equity curve tab:
```tsx
<TabsContent value="drawdown">
  <Card className="bg-card border-border">
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Drawdown Curve
        </CardTitle>
        <span className={cn('text-xs font-mono', s.max_drawdown > -0.1 ? 'text-profit' : 'text-loss')}>
          Max: {(s.max_drawdown * 100).toFixed(2)}%
        </span>
      </div>
    </CardHeader>
    <CardContent>
      {result.drawdown_curve && result.drawdown_curve.length > 0 ? (
        <DrawdownChart curve={result.drawdown_curve} />
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          Drawdown data available when engine is online.
        </p>
      )}
    </CardContent>
  </Card>
</TabsContent>
```

**Step E — Add `DrawdownChart` component** (after `EquityCurveChart`):
```tsx
function DrawdownChart({ curve, className }: { curve: number[]; className?: string }) {
  if (curve.length === 0) return null;
  const min = Math.min(...curve);
  const h = 200;
  const w = curve.length;
  // drawdown values are 0 to negative; flip for display
  const points = curve.map((v, i) =>
    `${(i / (w - 1)) * 100},${((v - 0) / (min - 0)) * (h - 20)}`
  ).join(' ');

  return (
    <div className={cn('w-full', className)}>
      <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="w-full h-40">
        <defs>
          <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,0 ${points} 100,0`} fill="url(#ddGrad)" />
        <polyline
          points={points}
          fill="none"
          stroke="#ef4444"
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
```

**Step F — Add data source badge + error display** in the config panel area (after the Run button):
```tsx
{dataSource && (
  <span className={cn(
    'text-[10px] font-medium px-2 py-0.5 rounded-full border',
    dataSource === 'engine'
      ? 'bg-profit/15 text-profit border-profit/30'
      : 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  )}>
    {dataSource === 'engine' ? 'Live Engine' : 'Synthetic Fallback'}
  </span>
)}
{error && (
  <span className="text-xs text-loss font-mono">{error}</span>
)}
```

**Step G — Update the header description:**
```tsx
<p className="text-xs text-muted-foreground">
  Run strategy backtests on the Quant Engine with real strategy logic
</p>
```

- [ ] **Run** TypeScript check:
  ```
  cd apps/web && pnpm exec tsc --noEmit 2>&1 | grep -v tests/
  ```
  Expected: No errors.

- [ ] **Update** `apps/web/tests/pages/backtest.test.tsx` — mock `fetch` for engine mode and keep existing tests:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BacktestPage from '@/app/backtest/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/backtest',
  useRouter: () => ({ push: vi.fn() }),
}));

const mockEngineResult = {
  summary: {
    strategy: 'sma_crossover',
    ticker: 'SYNTHETIC',
    total_return: '12.50%',
    annualized_return: '15.00%',
    max_drawdown: '-8.32%',
    sharpe_ratio: '1.42',
    sortino_ratio: '2.10',
    win_rate: '55.0%',
    profit_factor: '1.85',
    total_trades: 12,
    avg_holding_bars: '14.2',
  },
  equity_curve: Array.from({ length: 100 }, (_, i) => 100_000 + i * 125),
  drawdown_curve: Array.from({ length: 100 }, (_, i) => -Math.abs(Math.sin(i * 0.1)) * 0.05),
  trade_count: 12,
  trades: [
    { side: 'long', entry_bar: 25, exit_bar: 40, entry_price: 105.0, exit_price: 112.0, pnl: 700, return_pct: 6.67 },
  ],
};

describe('BacktestPage — engine online', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockEngineResult,
    }));
  });

  it('renders the backtest header', () => {
    render(<BacktestPage />);
    expect(screen.getByText('Backtest')).toBeInTheDocument();
  });

  it('shows strategy selector', () => {
    render(<BacktestPage />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows trend selection buttons', () => {
    render(<BacktestPage />);
    expect(screen.getByText('Up')).toBeInTheDocument();
    expect(screen.getByText('Down')).toBeInTheDocument();
    expect(screen.getByText('Volatile')).toBeInTheDocument();
    expect(screen.getByText('Random')).toBeInTheDocument();
  });

  it('shows Run Backtest button', () => {
    render(<BacktestPage />);
    expect(screen.getByText('Run Backtest')).toBeInTheDocument();
  });

  it('shows empty state before running', () => {
    render(<BacktestPage />);
    expect(screen.getByText(/Configure a strategy and click/)).toBeInTheDocument();
  });

  it('runs backtest via engine and shows results', async () => {
    render(<BacktestPage />);
    fireEvent.click(screen.getByText('Run Backtest'));
    await waitFor(() =>
      expect(screen.getByText('Total Return')).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(screen.getByText('Sharpe Ratio')).toBeInTheDocument();
    expect(screen.getByText('Win Rate')).toBeInTheDocument();
    expect(screen.getByText('Max Drawdown')).toBeInTheDocument();
  });

  it('shows Live Engine badge after engine run', async () => {
    render(<BacktestPage />);
    fireEvent.click(screen.getByText('Run Backtest'));
    await waitFor(() => expect(screen.getByText(/Live Engine/i)).toBeInTheDocument());
  });
});

describe('BacktestPage — engine offline fallback', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));
  });

  it('falls back to synthetic and shows results', async () => {
    render(<BacktestPage />);
    fireEvent.click(screen.getByText('Run Backtest'));
    await waitFor(() =>
      expect(screen.getByText('Total Return')).toBeInTheDocument(),
      { timeout: 3000 },
    );
    await waitFor(() => expect(screen.getByText(/Synthetic Fallback/i)).toBeInTheDocument());
  });
});

describe('BacktestPage — UI interaction', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockEngineResult,
    }));
  });

  it('allows switching trend options', () => {
    render(<BacktestPage />);
    const downButton = screen.getByText('Down');
    fireEvent.click(downButton);
    expect(downButton.className).toContain('text-primary');
  });
});
```

- [ ] **Run** web tests:
  ```
  cd apps/web && pnpm test
  ```
  Expected: All tests pass.

- [ ] **Run** full build:
  ```
  cd apps/web && pnpm build
  ```
  Expected: Clean build.

- [ ] **Commit:**
  ```
  git add apps/web/src/app/backtest/page.tsx \
          apps/web/tests/pages/backtest.test.tsx
  git commit -m "feat(backtest): wire to engine API with drawdown curve and synthetic fallback"
  ```

---

## Chunk 5: Infrastructure — CI/CD + Docker

### Task 5.1 — GitHub Actions CI

- [ ] **Create** `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ── Web (Next.js) ──────────────────────────────────────────────────
  web:
    name: Web Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        working-directory: .

      - name: Type check
        run: pnpm exec tsc --noEmit

      - name: Run tests
        run: pnpm test

      - name: Build
        run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
          NEXT_PUBLIC_ENGINE_URL: http://localhost:8000
          NEXT_PUBLIC_AGENTS_URL: http://localhost:3001

  # ── Agents (TypeScript Express) ────────────────────────────────────
  agents:
    name: Agents Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/agents

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        working-directory: .

      - name: Type check
        run: pnpm exec tsc --noEmit

      - name: Run tests
        run: pnpm test
        env:
          ANTHROPIC_API_KEY: sk-ant-placeholder
          SUPABASE_URL: https://placeholder.supabase.co
          SUPABASE_SERVICE_ROLE_KEY: placeholder

  # ── Engine (Python FastAPI) ────────────────────────────────────────
  engine:
    name: Engine Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/engine

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install uv
        uses: astral-sh/setup-uv@v4

      - name: Install dependencies
        run: uv sync

      - name: Run tests with coverage
        run: uv run pytest --cov=src --cov-report=term-missing -q
        env:
          POLYGON_API_KEY: placeholder
          ALPACA_API_KEY: placeholder
          ALPACA_SECRET_KEY: placeholder
          ALPACA_BASE_URL: https://paper-api.alpaca.markets/v2
          BROKER_MODE: paper
          ENGINE_API_KEY: test-key
          SUPABASE_URL: https://placeholder.supabase.co
          SUPABASE_SERVICE_ROLE_KEY: placeholder
          CORS_ORIGINS: http://localhost:3000
```

- [ ] **Verify** the workflow file is valid YAML:
  ```
  python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
  ```
  Expected: No error output.

- [ ] **Commit:**
  ```
  git add .github/workflows/ci.yml
  git commit -m "ci: add GitHub Actions CI for web, agents, and engine"
  ```

### Task 5.2 — Docker + docker-compose

- [ ] **Create** `apps/engine/Dockerfile`:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --frozen

# Copy source
COPY src/ ./src/

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uv", "run", "uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Create** `apps/agents/Dockerfile`:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/agents/package.json ./apps/agents/
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm tsx
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY packages/shared/ ./packages/shared/
COPY apps/agents/ ./apps/agents/

ENV NODE_ENV=production
EXPOSE 3001

CMD ["pnpm", "--filter", "@sentinel/agents", "start"]
```

- [ ] **Create** `apps/web/Dockerfile`:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
ARG NEXT_PUBLIC_ENGINE_URL=http://engine:8000
ARG NEXT_PUBLIC_AGENTS_URL=http://agents:3001
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN pnpm --filter @sentinel/web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "apps/web/.next/standalone/server.js"]
```

- [ ] **Create** `docker-compose.yml` at the repo root:

```yaml
version: '3.9'

services:
  engine:
    build:
      context: .
      dockerfile: apps/engine/Dockerfile
    ports:
      - '8000:8000'
    env_file: .env
    environment:
      - CORS_ORIGINS=http://localhost:3000
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8000/health']
      interval: 15s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  agents:
    build:
      context: .
      dockerfile: apps/agents/Dockerfile
    ports:
      - '3001:3001'
    env_file: .env
    environment:
      - ENGINE_URL=http://engine:8000
      - WEB_URL=http://localhost:3000
    depends_on:
      engine:
        condition: service_healthy
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        NEXT_PUBLIC_ENGINE_URL: http://localhost:8000
        NEXT_PUBLIC_AGENTS_URL: http://localhost:3001
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
    ports:
      - '3000:3000'
    env_file: .env
    depends_on:
      - agents
    restart: unless-stopped
```

- [ ] **Add** a `.dockerignore` at the repo root:

```
node_modules
.next
.git
**/__pycache__
**/.venv
**/*.pyc
.env
.env.local
```

- [ ] **Verify** docker-compose config parses:
  ```
  docker compose config --quiet
  ```
  Expected: No errors (or skip if Docker not running in CI).

- [ ] **Commit:**
  ```
  git add apps/engine/Dockerfile apps/agents/Dockerfile apps/web/Dockerfile \
          docker-compose.yml .dockerignore
  git commit -m "feat(infra): add Dockerfiles and docker-compose for all three services"
  ```

---

## Final Verification

### Task 6.0 — Full test suite

- [ ] **Run all tests from repo root:**
  ```
  pnpm test
  ```
  Expected: All 3 suites pass (web Vitest, agents Vitest, engine pytest).

- [ ] **Run full Next.js build:**
  ```
  cd apps/web && pnpm build
  ```
  Expected: Clean build, all 13 routes including `/api/settings/status`.

- [ ] **Update memory:**
  Edit `C:\Users\steve\.claude\projects\C--Users-steve-Projects-personal-Stock-Trading-App\memory\project_status.md` to reflect:
  - All HIGH/MEDIUM items completed
  - CI/CD and Docker added
  - Connector verification live

- [ ] **Final commit:**
  ```
  git add .
  git commit -m "chore: mark completion sprint done — all features wired and infrastructure in place"
  ```
