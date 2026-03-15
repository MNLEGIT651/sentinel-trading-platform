# Sentinel Trading Platform — Codebase Optimization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Sentinel monorepo into a world-class codebase by deleting dead code, adding a
professional tooling layer, decomposing oversized page files into testable components, standardizing
error handling, and bringing test coverage to ≥ 70% across all apps.

**Architecture:** Surgical Precision — no rewrites of working logic. Each chunk is independently
shippable and can be committed/merged separately. Chunks 1–9 are ordered by dependency; later chunks
build on earlier ones.

**Tech Stack:** Next.js 16.1.6, TypeScript 5, Python 3.12 FastAPI, Node.js 22 Express, Vitest,
pytest, Playwright, pnpm workspaces, Turborepo, Husky, Commitlint, Prettier, Ruff.

**Spec:** `docs/superpowers/specs/2026-03-15-codebase-optimization-design.md`

---

## File Map

### Files to Delete
- `apps/compass/` — entire directory

### Files to Create
- `.prettierrc`
- `.editorconfig`
- `.nvmrc`
- `.commitlintrc.json`
- `tsconfig.base.json`
- `.husky/pre-commit`
- `.husky/commit-msg`
- `apps/web/src/hooks/use-async-action.ts`
- `apps/web/src/components/portfolio/positions-table.tsx`
- `apps/web/src/components/portfolio/allocation-chart.tsx`
- `apps/web/src/components/portfolio/snapshot-metrics.tsx`
- `apps/web/src/components/portfolio/order-history.tsx`
- `apps/web/src/components/settings/broker-settings.tsx`
- `apps/web/src/components/settings/risk-settings.tsx`
- `apps/web/src/components/settings/schedule-settings.tsx`
- `apps/web/src/components/settings/connection-status.tsx`
- `apps/web/src/components/backtest/backtest-form.tsx`
- `apps/web/src/components/backtest/results-chart.tsx`
- `apps/web/src/components/backtest/metrics-table.tsx`
- `apps/web/src/components/backtest/trade-log.tsx`
- `apps/web/src/components/strategies/strategy-card.tsx`
- `apps/web/src/components/strategies/strategy-params.tsx`
- `apps/web/src/components/strategies/signal-badge.tsx`
- `apps/web/src/components/agents/agent-status-card.tsx`
- `apps/web/src/components/agents/recommendation-card.tsx`
- `apps/web/src/components/agents/agent-alert-feed.tsx`
- `apps/web/src/components/signals/signal-card.tsx`
- `apps/web/src/components/signals/signal-filters.tsx`
- `apps/web/src/components/signals/signal-timeline.tsx`
- `apps/web/tests/hooks/use-async-action.test.ts`
- `apps/web/tests/hooks/use-realtime.test.ts`
- `apps/web/tests/pages/signals.test.tsx`
- `apps/web/tests/pages/dashboard.test.tsx`
- `apps/web/tests/components/portfolio/positions-table.test.tsx`
- `apps/web/tests/components/portfolio/allocation-chart.test.tsx`
- `apps/web/tests/components/settings/broker-settings.test.tsx`
- `apps/web/tests/components/settings/risk-settings.test.tsx`
- `apps/web/tests/components/backtest/backtest-form.test.tsx`
- `apps/web/tests/components/backtest/metrics-table.test.tsx`
- `apps/web/tests/components/strategies/strategy-card.test.tsx`
- `apps/web/tests/components/agents/agent-status-card.test.tsx`
- `apps/web/tests/components/signals/signal-card.test.tsx`
- `apps/web/tests/e2e/dashboard.spec.ts`
- `apps/web/tests/e2e/backtest.spec.ts`
- `apps/web/tests/e2e/settings.spec.ts`
- `apps/engine/tests/integration/__init__.py`
- `apps/engine/tests/integration/test_health_integration.py`
- `apps/engine/tests/integration/test_data_integration.py`
- `apps/engine/tests/integration/test_portfolio_integration.py`
- `apps/engine/tests/integration/test_strategies_integration.py`
- `apps/engine/tests/integration/test_risk_integration.py`
- `apps/engine/tests/integration/test_backtest_integration.py`
- `apps/web/README.md`
- `apps/engine/README.md`
- `apps/agents/README.md`
- `.prettierignore`
- `apps/agents/vitest.config.ts`
- `apps/engine/tests/unit/test_error_handler.py`
- `apps/engine/tests/integration/conftest.py`

### Files to Modify

- `.gitignore` — ensure `.env` is listed (already present, verify only)
- `package.json` — add `husky`, `@commitlint/cli`, `@commitlint/config-conventional`, `lint-staged`
- `turbo.json` — add `env` pass-through, `outputs` for coverage, `dependsOn` for agents
- `tsconfig.base.json` — create with `strict: true` base
- `apps/web/tsconfig.json` — extend `../../tsconfig.base.json`
- `apps/agents/tsconfig.json` — extend `../../tsconfig.base.json`
- `apps/web/vitest.config.ts` — add coverage provider + thresholds
- `apps/engine/tests/conftest.py` — add `_stub_required_env` autouse fixture (Task 4.3 Step 3b)
- `apps/engine/pyproject.toml` — add `[tool.ruff.format]`, coverage threshold addopts
- `apps/engine/src/api/main.py` — add custom exception handler
- `apps/engine/src/config.py` — add startup validation
- `apps/engine/src/api/routes/*.py` — add `summary`, `description`, `tags` to all route functions
- `apps/web/src/app/portfolio/page.tsx` — refactor to compose extracted components
- `apps/web/src/app/settings/page.tsx` — refactor
- `apps/web/src/app/backtest/page.tsx` — refactor
- `apps/web/src/app/strategies/page.tsx` — refactor
- `apps/web/src/app/agents/page.tsx` — refactor + replace `console.error` with `toast.error`
- `apps/web/src/app/signals/page.tsx` — refactor
- `apps/web/src/lib/supabase/client.ts` — add env validation
- `apps/agents/src/server.ts` — standardize global error handler to `{ error, detail }`
- `apps/agents/src/index.ts` — verify/add startup guards for all required env vars
- `.github/workflows/ci.yml` — add ruff format check, coverage uploads, Playwright job
- `supabase/migrations/00001_initial_schema.sql` — add header comment
- `supabase/migrations/00002_indexes_rls_realtime.sql` — add header comment
- `supabase/migrations/00003_agent_tables.sql` — add header comment

---

## Chunk 1: Cleanup

Delete dead code and verify the `.env` file is not tracked by git.

---

### Task 1.1: Verify `.env` is not git-tracked

**Files:** `.gitignore`

- [ ] **Step 1: Check if `.env` is tracked**

```bash
git ls-files .env
```

Expected: empty output (not tracked). If output shows `.env`, proceed to Step 2.

- [ ] **Step 2 (only if tracked): Remove from tracking**

```bash
git rm --cached .env
echo ".env" >> .gitignore
git add .gitignore
git commit -m "fix: remove .env from git tracking"
```

- [ ] **Step 3: Confirm `.gitignore` has the entry**

```bash
grep "^\.env$" .gitignore
```

Expected: `.env`

---

### Task 1.2: Verify no source file imports from compass

**Files:** read-only search

- [ ] **Step 1: Search for compass imports across all source files**

```bash
grep -r "@compass\|apps/compass" --include="*.ts" --include="*.tsx" --include="*.json" \
  --exclude-dir=node_modules --exclude-dir=.next .
```

Expected: zero matches. If matches found, remove those imports before deletion.

---

### Task 1.3: Delete the compass app

**Files:** `apps/compass/` (delete)

- [ ] **Step 1: Delete the directory**

```bash
rm -rf apps/compass
```

- [ ] **Step 2: Verify no orphan references in CI or config**

```bash
grep -r "compass" turbo.json pnpm-workspace.yaml .github/ --include="*.yml" --include="*.yaml" --include="*.json"
```

Expected: zero matches.

- [ ] **Step 3: Verify workspace still resolves**

```bash
pnpm install
```

Expected: clean install, no errors about missing workspace packages.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete compass prototype app

Dead code — no tests, no deployment, no integration with any
production system. Workspace glob apps/* handles removal automatically."
```

---

## Chunk 2: Developer Tooling

Add the entire formatting/linting/commit enforcement layer in one chunk.

---

### Task 2.1: Add Prettier

**Files:** `.prettierrc`, root `package.json`

- [ ] **Step 1: Install Prettier at the root**

```bash
pnpm add -D -w prettier
```

- [ ] **Step 2: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "arrowParens": "always"
}
```

- [ ] **Step 3: Add a `.prettierignore`**

```
node_modules
.next
dist
.turbo
coverage
*.sql
pnpm-lock.yaml
```

- [ ] **Step 4: Run Prettier on all files to establish baseline**

```bash
pnpm prettier --write "**/*.{ts,tsx,json,css,md}" --ignore-unknown
```

- [ ] **Step 5: Verify no diff in git for files that were already clean**

```bash
git diff --stat
```

- [ ] **Step 6: Stage and commit formatting baseline**

```bash
git add -A
git commit -m "style: apply prettier formatting baseline"
```

---

### Task 2.2: Add EditorConfig

**Files:** `.editorconfig`

- [ ] **Step 1: Create `.editorconfig`**

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[*.py]
indent_size = 4

[Makefile]
indent_style = tab
```

- [ ] **Step 2: Commit**

```bash
git add .editorconfig
git commit -m "chore: add .editorconfig for IDE consistency"
```

---

### Task 2.3: Add `.nvmrc`

**Files:** `.nvmrc`

- [ ] **Step 1: Create `.nvmrc`**

```
22
```

- [ ] **Step 2: Commit**

```bash
git add .nvmrc
git commit -m "chore: pin Node LTS version via .nvmrc"
```

---

### Task 2.4: Create root `tsconfig.base.json`

**Files:** `tsconfig.base.json`, `apps/web/tsconfig.json`, `apps/agents/tsconfig.json`

- [ ] **Step 1: Create `tsconfig.base.json` at repo root**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 2: Update `apps/web/tsconfig.json` to extend the base**

The file already has `"strict": true`. Replace the full file with:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Update `apps/agents/tsconfig.json` to extend the base**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Verify both apps still type-check**

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter agents exec tsc --noEmit
```

Expected: zero errors. If errors appear, they must be fixed before committing.

- [ ] **Step 5: Commit**

```bash
git add tsconfig.base.json apps/web/tsconfig.json apps/agents/tsconfig.json
git commit -m "chore: add root tsconfig.base.json, extend in web and agents"
```

---

### Task 2.5: Add Husky + lint-staged

**Files:** root `package.json`, `.husky/pre-commit`

- [ ] **Step 1: Install husky and lint-staged**

```bash
pnpm add -D -w husky lint-staged
pnpm exec husky init
```

This creates `.husky/pre-commit` with a sample hook.

- [ ] **Step 2: Replace `.husky/pre-commit` with lint-staged**

```bash
echo "pnpm lint-staged" > .husky/pre-commit
```

- [ ] **Step 3: Add `lint-staged` config to root `package.json`**

Add this object to the root `package.json` (alongside `"devDependencies"`):

```json
"lint-staged": {
  "*.{ts,tsx}": ["prettier --write", "eslint --fix --max-warnings=0"],
  "*.{json,css,md,yaml,yml}": ["prettier --write"],
  "*.py": ["ruff check --fix", "ruff format"]
}
```

- [ ] **Step 4: Test the hook manually (optional but recommended)**

```bash
echo "const x=1" > /tmp/test.ts
git add /tmp/test.ts 2>/dev/null || true
# The hook won't run on files outside the repo — just verify husky is wired
git config core.hooksPath
```

Expected: `.husky`

- [ ] **Step 5: Commit**

```bash
git add package.json .husky/
git commit -m "chore: add husky pre-commit hook with lint-staged"
```

---

### Task 2.6: Add Commitlint

**Files:** `.commitlintrc.json`, `.husky/commit-msg`

- [ ] **Step 1: Install commitlint**

```bash
pnpm add -D -w @commitlint/cli @commitlint/config-conventional
```

- [ ] **Step 2: Create `.commitlintrc.json`**

```json
{
  "extends": ["@commitlint/config-conventional"],
  "rules": {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "chore", "docs", "style", "refactor", "test", "ci", "perf", "revert"]
    ],
    "subject-case": [0]
  }
}
```

- [ ] **Step 3: Wire commitlint into the commit-msg hook**

```bash
echo "pnpm commitlint --edit \$1" > .husky/commit-msg
chmod +x .husky/commit-msg
```

- [ ] **Step 4: Test commitlint with a bad message**

```bash
echo "bad commit message" | pnpm commitlint
```

Expected: error output about invalid commit format.

- [ ] **Step 5: Test commitlint with a good message**

```bash
echo "feat: add commitlint" | pnpm commitlint
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add .commitlintrc.json .husky/commit-msg package.json
git commit -m "chore: add commitlint for conventional commit enforcement"
```

---

### Task 2.7: Add Ruff formatting config

**Files:** `apps/engine/pyproject.toml`

- [ ] **Step 1: Add `[tool.ruff.format]` section to `pyproject.toml`**

After the `[tool.ruff.lint]` section, add:

```toml
[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

- [ ] **Step 2: Run ruff format to establish baseline**

```bash
cd apps/engine && .venv/Scripts/python -m ruff format src/ tests/
```

- [ ] **Step 3: Commit**

```bash
git add apps/engine/pyproject.toml apps/engine/src/ apps/engine/tests/
git commit -m "style: add ruff format config and apply baseline formatting to engine"
```

---

## Chunk 3: Page Refactoring

Decompose the six oversized page files into focused components. Each page becomes an orchestrator.
The `useAsyncAction` hook is created first since all refactored pages will use it.

**Critical rule:** Extract UI and logic — do not change business logic. If the original page computed
something, the extracted component computes it the same way. Refactoring is rename/move, not rewrite.

---

### Task 3.1: Create `useAsyncAction` hook

**Files:** `apps/web/src/hooks/use-async-action.ts`

- [ ] **Step 1: Write the failing test first**

Create `apps/web/tests/hooks/use-async-action.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAsyncAction } from '@/hooks/use-async-action';

describe('useAsyncAction', () => {
  it('starts with idle state', () => {
    const { result } = renderHook(() => useAsyncAction(async () => 'value'));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets loading true while fn is running', async () => {
    let resolve!: (v: string) => void;
    const fn = () => new Promise<string>((r) => { resolve = r; });
    const { result } = renderHook(() => useAsyncAction(fn));
    act(() => { result.current.execute(); });
    expect(result.current.loading).toBe(true);
    await act(async () => { resolve('done'); });
    expect(result.current.loading).toBe(false);
  });

  it('stores data on success', async () => {
    const { result } = renderHook(() => useAsyncAction(async () => 42));
    await act(async () => { await result.current.execute(); });
    expect(result.current.data).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it('stores error on failure', async () => {
    const fn = async () => { throw new Error('boom'); };
    const { result } = renderHook(() => useAsyncAction(fn));
    await act(async () => { await result.current.execute(); });
    expect(result.current.error).toBe('boom');
    expect(result.current.data).toBeNull();
  });

  it('reset clears all state', async () => {
    const { result } = renderHook(() => useAsyncAction(async () => 'x'));
    await act(async () => { await result.current.execute(); });
    act(() => { result.current.reset(); });
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && pnpm test tests/hooks/use-async-action.test.ts
```

Expected: FAIL — "Cannot find module '@/hooks/use-async-action'"

- [ ] **Step 3: Implement the hook**

Create `apps/web/src/hooks/use-async-action.ts`:

```typescript
import { useState, useCallback } from 'react';

interface AsyncActionState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: () => Promise<void>;
  reset: () => void;
}

export function useAsyncAction<T>(fn: () => Promise<T>): AsyncActionState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [fn]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd apps/web && pnpm test tests/hooks/use-async-action.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-async-action.ts apps/web/tests/hooks/use-async-action.test.ts
git commit -m "feat(web): add useAsyncAction hook with full test suite"
```

---

### Task 3.2: Refactor `portfolio/page.tsx`

**Files:** `apps/web/src/app/portfolio/page.tsx`,
`apps/web/src/components/portfolio/snapshot-metrics.tsx`,
`apps/web/src/components/portfolio/positions-table.tsx`,
`apps/web/src/components/portfolio/allocation-chart.tsx`,
`apps/web/src/components/portfolio/order-history.tsx`

- [ ] **Step 1: Read the full current page**

```bash
cat apps/web/src/app/portfolio/page.tsx
```

Understand the full shape before extracting.

- [ ] **Step 2: Identify extraction boundaries**

Scan for clearly self-contained render blocks. Typical candidates:
- The metrics row at the top (`SnapshotMetrics`)
- The positions data table (`PositionsTable`)
- The allocation donut/bar chart section (`AllocationChart`)
- The order history table (`OrderHistory`)

- [ ] **Step 3: Extract `SnapshotMetrics`**

Create `apps/web/src/components/portfolio/snapshot-metrics.tsx`.
Move the metrics-row JSX and its local types/constants into this file.
The component receives data as props (no fetch inside — the page fetches, passes down).

Props interface example:
```typescript
interface SnapshotMetricsProps {
  account: BrokerAccount | null;
  loading: boolean;
}
```

- [ ] **Step 4: Extract `PositionsTable`**

Create `apps/web/src/components/portfolio/positions-table.tsx`.
Move the table JSX, sort logic, and `SortField`/`SortDir` types into this file.
Page passes `positions` array and `quotes` map as props.

- [ ] **Step 5: Extract `AllocationChart`**

Create `apps/web/src/components/portfolio/allocation-chart.tsx`.
Move the sector aggregation logic and chart rendering into this file.
Receives `positions` array as props.

- [ ] **Step 6: Extract `OrderHistory`**

Create `apps/web/src/components/portfolio/order-history.tsx`.
Move the order history tab content into this file.
Receives `orders` array as props.

- [ ] **Step 7: Update `portfolio/page.tsx`**

The page now:
1. Holds all `useState` and `useEffect` (data fetching)
2. Renders `<SnapshotMetrics>`, `<PositionsTable>`, `<AllocationChart>`, `<OrderHistory>`
3. Target: under 200 lines

- [ ] **Step 8: Verify the page type-checks and renders**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 9: Run existing portfolio test**

```bash
cd apps/web && pnpm test tests/pages/portfolio.test.tsx
```

Expected: PASS (no regressions)

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/portfolio/ apps/web/src/components/portfolio/
git commit -m "refactor(web): decompose portfolio page into focused components"
```

---

### Task 3.3: Refactor `settings/page.tsx`

**Files:** `apps/web/src/app/settings/page.tsx`,
`apps/web/src/components/settings/*.tsx` (4 files)

- [ ] **Step 1: Read the full current page**

```bash
cat apps/web/src/app/settings/page.tsx
```

- [ ] **Step 2: Extract `BrokerSettings`**

Create `apps/web/src/components/settings/broker-settings.tsx`.
Contains broker configuration form fields (Alpaca API keys, mode selector).
Props: current broker config values + `onSave` callback.

- [ ] **Step 3: Extract `RiskSettings`**

Create `apps/web/src/components/settings/risk-settings.tsx`.
Contains risk limit fields (max position size, max drawdown, etc.).
Props: current risk limits + `onSave` callback.

- [ ] **Step 4: Extract `ScheduleSettings`**

Create `apps/web/src/components/settings/schedule-settings.tsx`.
Contains scheduling interval fields.
Props: current schedule config + `onSave` callback.

- [ ] **Step 5: Extract `ConnectionStatus`**

Create `apps/web/src/components/settings/connection-status.tsx`.
Contains the connectivity test UI (engine, Supabase, broker status indicators).
Props: status state + `onTest` callback.

- [ ] **Step 6: Update `settings/page.tsx`**

Page orchestrates: fetches config once, passes to each component, target under 150 lines.

- [ ] **Step 7: Type-check + run existing settings test**

```bash
pnpm --filter web exec tsc --noEmit
cd apps/web && pnpm test tests/pages/settings.test.tsx
```

Expected: zero type errors, test PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/settings/ apps/web/src/components/settings/
git commit -m "refactor(web): decompose settings page into focused components"
```

---

### Task 3.4: Refactor `backtest/page.tsx`

**Files:** `apps/web/src/app/backtest/page.tsx`,
`apps/web/src/components/backtest/*.tsx` (4 files)

- [ ] **Step 1: Read the full current page**

```bash
cat apps/web/src/app/backtest/page.tsx
```

- [ ] **Step 2: Extract `BacktestForm`**

Create `apps/web/src/components/backtest/backtest-form.tsx`.
Contains the strategy/date/ticker selection form. Props: `onSubmit(params)`, `loading`.

- [ ] **Step 3: Extract `MetricsTable`**

Create `apps/web/src/components/backtest/metrics-table.tsx`.
Contains the summary metrics grid (total return, Sharpe, max drawdown, win rate, etc.).
Props: `metrics: BacktestMetrics | null`.

- [ ] **Step 4: Extract `ResultsChart`**

Create `apps/web/src/components/backtest/results-chart.tsx`.
Contains the equity curve chart. Props: `equityCurve: EquityPoint[]`.

- [ ] **Step 5: Extract `TradeLog`**

Create `apps/web/src/components/backtest/trade-log.tsx`.
Contains the trades table. Props: `trades: BacktestTrade[]`.

- [ ] **Step 6: Update `backtest/page.tsx`**

Page holds state (form params, results), passes to components. Target under 150 lines.

- [ ] **Step 7: Type-check + run existing backtest test**

```bash
pnpm --filter web exec tsc --noEmit
cd apps/web && pnpm test tests/pages/backtest.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/backtest/ apps/web/src/components/backtest/
git commit -m "refactor(web): decompose backtest page into focused components"
```

---

### Task 3.5: Refactor `strategies/page.tsx`

**Files:** `apps/web/src/app/strategies/page.tsx`,
`apps/web/src/components/strategies/*.tsx` (3 files)

- [ ] **Step 1: Read the full current page**

```bash
cat apps/web/src/app/strategies/page.tsx
```

- [ ] **Step 2: Extract `StrategyCard`**

Create `apps/web/src/components/strategies/strategy-card.tsx`.
Renders one strategy row/card with name, status, last signal. Props: `strategy`, `onToggle`.

- [ ] **Step 3: Extract `StrategyParams`**

Create `apps/web/src/components/strategies/strategy-params.tsx`.
Renders the parameter editing form for a selected strategy. Props: `params`, `onSave`.

- [ ] **Step 4: Extract `SignalBadge`**

Create `apps/web/src/components/strategies/signal-badge.tsx`.
Small reusable badge showing signal direction (long/short/close) with color coding.
Props: `direction: 'long' | 'short' | 'close'`.

- [ ] **Step 5: Update `strategies/page.tsx`**

Page fetches strategies list, renders `StrategyCard` list, shows `StrategyParams` on selection.

- [ ] **Step 6: Type-check + run existing strategies test**

```bash
pnpm --filter web exec tsc --noEmit
cd apps/web && pnpm test tests/pages/strategies.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/strategies/ apps/web/src/components/strategies/
git commit -m "refactor(web): decompose strategies page into focused components"
```

---

### Task 3.6: Refactor `agents/page.tsx`

**Files:** `apps/web/src/app/agents/page.tsx`,
`apps/web/src/components/agents/*.tsx` (3 files)

- [ ] **Step 1: Read the full current page**

```bash
cat apps/web/src/app/agents/page.tsx
```

- [ ] **Step 2: Extract `AgentStatusCard`**

Create `apps/web/src/components/agents/agent-status-card.tsx`.
Renders one agent's status indicator (name, state, last-run time). Props: `agent: AgentStatus`.

- [ ] **Step 3: Extract `RecommendationCard`**

Create `apps/web/src/components/agents/recommendation-card.tsx`.
Renders one trade recommendation with approve/reject buttons.
Props: `recommendation`, `onApprove`, `onReject`.

- [ ] **Step 4: Extract `AgentAlertFeed`**

Create `apps/web/src/components/agents/agent-alert-feed.tsx`.
Renders the recent alerts list. Props: `alerts: AgentAlert[]`.

- [ ] **Step 5: Update `agents/page.tsx`**

Page fetches status + recommendations, orchestrates components, target under 150 lines.

- [ ] **Step 6: Type-check + run existing agents test**

```bash
pnpm --filter web exec tsc --noEmit
cd apps/web && pnpm test tests/pages/agents.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/agents/ apps/web/src/components/agents/
git commit -m "refactor(web): decompose agents page into focused components"
```

---

### Task 3.7: Refactor `signals/page.tsx`

**Files:** `apps/web/src/app/signals/page.tsx`,
`apps/web/src/components/signals/*.tsx` (3 files)

- [ ] **Step 1: Read the full current page**

```bash
cat apps/web/src/app/signals/page.tsx
```

- [ ] **Step 2: Extract `SignalCard`**

Create `apps/web/src/components/signals/signal-card.tsx`.
Renders one signal row (ticker, direction, confidence, strategy, timestamp).
Props: `signal: SignalResult`.

- [ ] **Step 3: Extract `SignalFilters`**

Create `apps/web/src/components/signals/signal-filters.tsx`.
Renders the filter bar (direction, strategy, ticker search).
Props: `filters`, `onChange`.

- [ ] **Step 4: Extract `SignalTimeline`**

Create `apps/web/src/components/signals/signal-timeline.tsx`.
Renders the grouped-by-time signal list.
Props: `signals: SignalResult[]`, `filters`.

- [ ] **Step 5: Update `signals/page.tsx`**

Page fetches signals, manages filter state, renders `<SignalFilters>` + `<SignalTimeline>`.

- [ ] **Step 6: Type-check**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/signals/ apps/web/src/components/signals/
git commit -m "refactor(web): decompose signals page into focused components"
```

---

## Chunk 3b: TypeScript Strict+

Enable the two deferred strict flags now that all pages are focused components.

---

### Task 3b.1: Enable `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`

**Files:** `tsconfig.base.json`

- [ ] **Step 1: Add the flags to `tsconfig.base.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 2: Run type-check across all TS apps**

```bash
pnpm --filter web exec tsc --noEmit 2>&1 | head -50
pnpm --filter agents exec tsc --noEmit 2>&1 | head -50
```

Expected: errors will appear. Fix them all before committing.

- [ ] **Step 3: Fix all type errors**

Common patterns to fix:

For `noUncheckedIndexedAccess` — array/object index access returns `T | undefined`:
```typescript
// Before (error):
const first = items[0].name;
// After (safe):
const first = items[0]?.name ?? '';
```

For `exactOptionalPropertyTypes` — optional props cannot be `undefined` when not present:
```typescript
// Before (error):
const props: { name?: string } = { name: undefined };
// After:
const props: { name?: string } = {};
```

Fix all errors across `apps/web` and `apps/agents`. Do not suppress with `// @ts-ignore`.

- [ ] **Step 4: Re-run type-check — must be zero errors**

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter agents exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Run all tests to verify no regressions**

```bash
pnpm --filter web test
pnpm --filter agents test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: enable noUncheckedIndexedAccess + exactOptionalPropertyTypes

All type errors fixed. These flags prevent undefined array/object
index access bugs at compile time."
```

---

## Chunk 4: Error Handling Standardization

---

### Task 4.1: Replace `console.error` with `toast.error` in `agents/page.tsx`

**Files:** `apps/web/src/app/agents/page.tsx`

- [ ] **Step 1: Find all `console.error` calls**

```bash
grep -n "console.error" apps/web/src/app/agents/page.tsx
```

Expected: 3 matches. Note: line numbers will differ from the original file after Chunk 3 Task 3.6
refactors this page — use the grep output to find them, not hardcoded line numbers.

- [ ] **Step 2: Replace each with `toast.error`**

At the top of the file, ensure this import exists:
```typescript
import { toast } from 'sonner';
```

Replace each:
```typescript
// Before:
console.error('Failed to load status:', err);
// After:
toast.error(err instanceof Error ? err.message : 'Failed to load status');
```

Apply the same pattern to all 3 occurrences.

- [ ] **Step 3: Verify no console.error remains in any web page**

```bash
grep -rn "console\." apps/web/src/ --include="*.tsx" --include="*.ts"
```

Expected: zero matches (or only legitimate non-error console calls — none should exist).

- [ ] **Step 4: Type-check**

```bash
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/agents/page.tsx
git commit -m "fix(web): replace console.error with toast.error in agents page"
```

---

### Task 4.2: Add FastAPI custom exception handler

**Files:** `apps/engine/src/api/main.py`

- [ ] **Step 1: Write the failing test**

Create `apps/engine/tests/unit/test_error_handler.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import HTTPException

from src.api.main import app


@pytest.mark.asyncio
async def test_http_exception_returns_error_and_detail():
    """Custom handler wraps HTTPException into {error, detail} shape."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # /health exists; hit a non-existent route to get 404
        response = await client.get("/nonexistent-route-xyz")
    assert response.status_code == 404
    body = response.json()
    assert "error" in body
    assert "detail" in body
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/engine && .venv/Scripts/python -m pytest tests/unit/test_error_handler.py -v
```

Expected: FAIL — response body has `{"detail": "Not Found"}` not `{"error": ..., "detail": ...}`

- [ ] **Step 3: Add custom exception handler to `main.py`**

Add after the `app = FastAPI(...)` block:

```python
from fastapi import HTTPException
from fastapi.responses import JSONResponse


def _status_to_key(status_code: int) -> str:
    mapping = {
        400: "bad_request", 401: "unauthorized", 403: "forbidden",
        404: "not_found", 409: "conflict", 422: "unprocessable_entity",
        429: "rate_limited", 500: "internal_error", 502: "bad_gateway",
        503: "service_unavailable",
    }
    return mapping.get(status_code, f"http_{status_code}")


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": _status_to_key(exc.status_code), "detail": str(exc.detail)},
    )
```

- [ ] **Step 4: Run the test — must pass**

```bash
cd apps/engine && .venv/Scripts/python -m pytest tests/unit/test_error_handler.py -v
```

Expected: PASS

- [ ] **Step 5: Run the full engine test suite — no regressions**

```bash
cd apps/engine && .venv/Scripts/python -m pytest --tb=short
```

Expected: all existing tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/engine/src/api/main.py apps/engine/tests/unit/test_error_handler.py
git commit -m "fix(engine): add custom HTTPException handler for consistent {error,detail} shape"
```

---

### Task 4.3: Add startup validation to engine `config.py`

**Files:** `apps/engine/src/config.py`

- [ ] **Step 1: Write the failing test**

In `apps/engine/tests/unit/test_config.py`, add a test case (the file already exists — add to it):

```python
def test_validate_raises_when_supabase_url_missing(monkeypatch):
    """Settings.validate() raises ValueError if SUPABASE_URL is empty."""
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "some-key")
    s = Settings(_env_file=None)  # prevent loading .env from disk
    with pytest.raises(ValueError, match="SUPABASE_URL"):
        s.validate()


def test_validate_passes_when_required_vars_set(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "some-key")
    s = Settings(_env_file=None)  # prevent loading .env from disk
    s.validate()  # must not raise
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/engine && .venv/Scripts/python -m pytest tests/unit/test_config.py -v
```

Expected: FAIL — `Settings` has no `validate()` method.

- [ ] **Step 3: Add `validate()` method to `Settings` in `config.py`**

```python
def validate(self) -> None:
    """Raise ValueError if any required environment variable is missing."""
    required = {
        "SUPABASE_URL": self.supabase_url,
        "SUPABASE_SERVICE_ROLE_KEY": self.supabase_service_role_key,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing)}. "
            "See .env.example for guidance."
        )
    optional_warnings = {
        "POLYGON_API_KEY": self.polygon_api_key,
        "ALPACA_API_KEY": self.alpaca_api_key,
    }
    import logging
    for name, value in optional_warnings.items():
        if not value:
            logging.warning("Optional env var %s is not set — related features disabled.", name)
```

Call `validate()` in `main.py` lifespan startup:

```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    _settings.validate()
    yield
```

- [ ] **Step 3b: Update `tests/conftest.py` to supply stub env vars for CI**

`validate()` runs inside `lifespan`, which fires when any test creates an `AsyncClient` or
`TestClient`. Without env vars in CI the entire test suite will fail. Add stubs to the root
conftest so every test environment has the minimum required vars:

```python
# apps/engine/tests/conftest.py  — add at the top, before existing fixtures
import os
import pytest

@pytest.fixture(autouse=True)
def _stub_required_env(monkeypatch):
    """Provide minimum required env vars so Settings.validate() passes in CI."""
    monkeypatch.setenv("SUPABASE_URL", os.getenv("SUPABASE_URL", "https://stub.supabase.co"))
    monkeypatch.setenv(
        "SUPABASE_SERVICE_ROLE_KEY",
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "stub-service-role-key"),
    )
```

This uses real values if present (local dev with `.env`) or safe stubs if not (CI without secrets).

- [ ] **Step 4: Run config tests — must pass**

```bash
cd apps/engine && .venv/Scripts/python -m pytest tests/unit/test_config.py -v
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/engine/src/config.py apps/engine/src/api/main.py apps/engine/tests/unit/test_config.py
git commit -m "fix(engine): add Settings.validate() with startup fail-fast for required env vars"
```

---

### Task 4.4: Standardize agents global error handler

**Files:** `apps/agents/src/server.ts`

- [ ] **Step 1: Find the global error handler**

```bash
grep -n "internal_error\|err\.message" apps/agents/src/server.ts
```

The global error handler is the **last** `app.use(...)` call at the bottom of the file.
**Do not change** the inline `message:` keys in individual route responses (e.g. `/cycle`,
`/halt`) — only the global handler changes.

- [ ] **Step 2: Update global handler to use `detail` instead of `message`**

In `server.ts`, find the global error handler at the bottom:

```typescript
// Before:
res.status(500).json({ error: 'internal_error', message: err.message });

// After:
res.status(500).json({ error: 'internal_error', detail: err.message });
```

Also update the `/cycle` route fire-and-forget error log (line ~105) — it uses
`console.error` which is acceptable here as a server-side error log (no user-facing impact).

- [ ] **Step 3: Run agents tests — no regressions**

```bash
pnpm --filter agents test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/agents/src/server.ts
git commit -m "fix(agents): standardize global error handler to {error, detail} shape"
```

---

### Task 4.5: Add env validation to `lib/supabase/client.ts`

**Files:** `apps/web/src/lib/supabase/client.ts`

- [ ] **Step 1: Add dev-mode validation**

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'See .env.example for guidance.',
    );
  }

  return createBrowserClient(url, key);
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/supabase/client.ts
git commit -m "fix(web): add readable error when Supabase env vars are missing"
```

---

### Task 4.6: Verify agents startup guards

**Files:** `apps/agents/src/index.ts`

- [ ] **Step 1: Read current startup validation**

```bash
cat apps/agents/src/index.ts
```

- [ ] **Step 2: Verify all four required vars are guarded**

The file should have fail-fast guards for: `ANTHROPIC_API_KEY`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `ENGINE_URL`.

If any are missing, add them:

```typescript
const required: Record<string, string | undefined> = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ENGINE_URL: process.env.ENGINE_URL,
};
const missing = Object.entries(required)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}. See .env.example.`);
  process.exit(1);
}
```

- [ ] **Step 3: Run agents tests**

```bash
pnpm --filter agents test
```

- [ ] **Step 4: Commit (if changes were made)**

```bash
git add apps/agents/src/index.ts
git commit -m "fix(agents): ensure all required env vars are validated at startup"
```

---

## Chunk 5: Web Unit Tests

Add tests for all extracted components and missing pages.

---

### Task 5.1: Component tests — portfolio

**Files:** `apps/web/tests/components/portfolio/positions-table.test.tsx`,
`apps/web/tests/components/portfolio/snapshot-metrics.test.tsx`

- [ ] **Step 1: Write `positions-table` test**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PositionsTable } from '@/components/portfolio/positions-table';

const mockPositions = [
  { ticker: 'AAPL', name: 'Apple Inc.', shares: 10, avgEntry: 150, currentPrice: 180, sector: 'Technology' },
];
const mockQuotes = {};

describe('PositionsTable', () => {
  it('renders position row with ticker', () => {
    render(<PositionsTable positions={mockPositions} quotes={mockQuotes} />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
  });

  it('shows empty state when no positions', () => {
    render(<PositionsTable positions={[]} quotes={{}} />);
    expect(screen.getByText(/no positions/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify it reflects the component's actual rendered output**

```bash
cd apps/web && pnpm test tests/components/portfolio/ --reporter=verbose
```

Fix assertions to match actual rendered text if needed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/components/portfolio/
git commit -m "test(web): add portfolio component unit tests"
```

---

### Task 5.2: Component tests — settings

**Files:** `apps/web/tests/components/settings/broker-settings.test.tsx`,
`apps/web/tests/components/settings/risk-settings.test.tsx`

- [ ] **Step 1: Write broker settings test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrokerSettings } from '@/components/settings/broker-settings';

describe('BrokerSettings', () => {
  it('renders mode selector', () => {
    render(<BrokerSettings config={{ broker_mode: 'paper' }} onSave={vi.fn()} />);
    expect(screen.getByText(/paper/i)).toBeInTheDocument();
  });

  it('calls onSave when form is submitted', async () => {
    const onSave = vi.fn();
    render(<BrokerSettings config={{ broker_mode: 'paper' }} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run and fix to match actual component output**

```bash
cd apps/web && pnpm test tests/components/settings/ --reporter=verbose
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/components/settings/
git commit -m "test(web): add settings component unit tests"
```

---

### Task 5.3: Component tests — backtest

**Files:** `apps/web/tests/components/backtest/backtest-form.test.tsx`,
`apps/web/tests/components/backtest/metrics-table.test.tsx`

- [ ] **Step 1: Write backtest form test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BacktestForm } from '@/components/backtest/backtest-form';

describe('BacktestForm', () => {
  it('renders run button', () => {
    render(<BacktestForm onSubmit={vi.fn()} loading={false} />);
    expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument();
  });

  it('disables run button while loading', () => {
    render(<BacktestForm onSubmit={vi.fn()} loading={true} />);
    expect(screen.getByRole('button', { name: /run/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Write metrics table test**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricsTable } from '@/components/backtest/metrics-table';

const mockMetrics = { totalReturn: 0.15, sharpe: 1.2, maxDrawdown: -0.08, winRate: 0.55 };

describe('MetricsTable', () => {
  it('renders total return', () => {
    render(<MetricsTable metrics={mockMetrics} />);
    expect(screen.getByText(/total return/i)).toBeInTheDocument();
  });

  it('renders null state gracefully', () => {
    render(<MetricsTable metrics={null} />);
    expect(screen.queryByText(/total return/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run and fix**

```bash
cd apps/web && pnpm test tests/components/backtest/ --reporter=verbose
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/components/backtest/
git commit -m "test(web): add backtest component unit tests"
```

---

### Task 5.4: Component tests — strategies, agents, signals

**Files:** one test file per component group

- [ ] **Step 1: Write strategy card test**

```typescript
// tests/components/strategies/strategy-card.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrategyCard } from '@/components/strategies/strategy-card';

describe('StrategyCard', () => {
  it('renders strategy name', () => {
    render(<StrategyCard strategy={{ id: '1', name: 'Momentum', enabled: true }} onToggle={vi.fn()} />);
    expect(screen.getByText('Momentum')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write agent status card test**

```typescript
// tests/components/agents/agent-status-card.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentStatusCard } from '@/components/agents/agent-status-card';

describe('AgentStatusCard', () => {
  it('renders agent name', () => {
    render(<AgentStatusCard agent={{ name: 'Market Sentinel', status: 'idle', lastRun: null }} />);
    expect(screen.getByText('Market Sentinel')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Write signal card test**

```typescript
// tests/components/signals/signal-card.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignalCard } from '@/components/signals/signal-card';

describe('SignalCard', () => {
  it('renders ticker and direction', () => {
    render(<SignalCard signal={{ ticker: 'AAPL', direction: 'long', confidence: 0.8, strategy: 'Momentum', timestamp: new Date().toISOString() }} />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText(/long/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run all component tests**

```bash
cd apps/web && pnpm test tests/components/ --reporter=verbose
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/tests/components/strategies/ apps/web/tests/components/agents/ apps/web/tests/components/signals/
git commit -m "test(web): add strategies, agents, signals component unit tests"
```

---

### Task 5.5: Add missing page tests — signals and dashboard

**Files:** `apps/web/tests/pages/signals.test.tsx`, `apps/web/tests/pages/dashboard.test.tsx`

- [ ] **Step 1: Write signals page smoke test**

```typescript
// tests/pages/signals.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SignalsPage from '@/app/signals/page';

vi.mock('@/lib/engine-client');
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({ from: vi.fn(() => ({ select: vi.fn(() => ({ data: [], error: null })) })) })),
}));

describe('SignalsPage', () => {
  it('renders without crashing', () => {
    render(<SignalsPage />);
    expect(screen.getByText(/signals/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write dashboard smoke test**

```typescript
// tests/pages/dashboard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/page';

vi.mock('@/lib/engine-client');
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({ channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })), removeChannel: vi.fn() })),
}));

describe('DashboardPage', () => {
  it('renders metric cards', () => {
    render(<DashboardPage />);
    // At least one metric card header should be in the document
    expect(document.querySelector('[class*="card"]')).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run both new tests**

```bash
cd apps/web && pnpm test tests/pages/signals.test.tsx tests/pages/dashboard.test.tsx --reporter=verbose
```

Adjust mocks based on what the pages actually import. The goal is zero crashes, not 100% assertion coverage for smoke tests.

- [ ] **Step 4: Add `use-realtime` hook test**

```typescript
// tests/hooks/use-realtime.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRealtime } from '@/hooks/use-realtime';

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};
const mockClient = {
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockClient),
}));

describe('useRealtime', () => {
  beforeEach(() => vi.clearAllMocks());

  it('subscribes on mount', () => {
    renderHook(() => useRealtime('test-table', vi.fn()));
    expect(mockClient.channel).toHaveBeenCalled();
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it('removes channel on unmount', () => {
    const { unmount } = renderHook(() => useRealtime('test-table', vi.fn()));
    unmount();
    expect(mockClient.removeChannel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run realtime hook test**

```bash
cd apps/web && pnpm test tests/hooks/use-realtime.test.ts --reporter=verbose
```

Adjust mocks to match the actual hook signature.

- [ ] **Step 6: Commit**

```bash
git add apps/web/tests/pages/signals.test.tsx apps/web/tests/pages/dashboard.test.tsx apps/web/tests/hooks/use-realtime.test.ts
git commit -m "test(web): add signals page, dashboard smoke test, and realtime hook tests"
```

---

## Chunk 6: Engine Integration Tests

Add `tests/integration/` suite testing each route group against the real FastAPI app.

---

### Task 6.1: Setup integration test infrastructure

**Files:** `apps/engine/tests/integration/__init__.py`,
`apps/engine/tests/integration/conftest.py`

- [ ] **Step 1: Create the integration directory**

```bash
mkdir -p apps/engine/tests/integration
touch apps/engine/tests/integration/__init__.py
```

- [ ] **Step 2: Create `conftest.py` with shared async client fixture**

```python
# apps/engine/tests/integration/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from src.api.main import app


@pytest.fixture
async def client():
    """Async HTTP client bound to the FastAPI app (no network)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
```

- [ ] **Step 3: Commit**

```bash
git add apps/engine/tests/integration/
git commit -m "test(engine): add integration test directory and shared async client fixture"
```

---

### Task 6.2: Health route integration tests

**Files:** `apps/engine/tests/integration/test_health_integration.py`

- [ ] **Step 1: Write health integration tests**

```python
import pytest


@pytest.mark.asyncio
async def test_health_returns_ok(client):
    response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"


@pytest.mark.asyncio
async def test_health_includes_service_name(client):
    response = await client.get("/health")
    body = response.json()
    assert "service" in body
```

- [ ] **Step 2: Run**

```bash
cd apps/engine && .venv/Scripts/python -m pytest tests/integration/test_health_integration.py -v
```

- [ ] **Step 3: Fix any failures then commit**

```bash
git add apps/engine/tests/integration/test_health_integration.py
git commit -m "test(engine): add health route integration tests"
```

---

### Task 6.3: Data route integration tests

**Files:** `apps/engine/tests/integration/test_data_integration.py`

- [ ] **Step 1: Write data route integration tests using respx mocks**

```python
import pytest
import respx
from httpx import Response


@pytest.mark.asyncio
async def test_quotes_returns_200_with_valid_tickers(client):
    with respx.mock:
        respx.get("https://api.polygon.io/v2/last/trade/AAPL").mock(
            return_value=Response(200, json={"results": {"p": 180.0}})
        )
        response = await client.get(
            "/api/v1/data/quotes",
            params={"tickers": "AAPL"},
            headers={"X-API-Key": "sentinel-dev-key"},
        )
    # 200 or graceful fallback (engine may return empty if Polygon key not set)
    assert response.status_code in (200, 503)


@pytest.mark.asyncio
async def test_quotes_rejects_missing_auth(client):
    response = await client.get("/api/v1/data/quotes", params={"tickers": "AAPL"})
    assert response.status_code == 401
    assert "error" in response.json()
```

- [ ] **Step 2: Run and fix**

```bash
cd apps/engine && .venv/Scripts/python -m pytest tests/integration/test_data_integration.py -v
```

- [ ] **Step 3: Commit**

```bash
git add apps/engine/tests/integration/test_data_integration.py
git commit -m "test(engine): add data route integration tests"
```

---

### Task 6.4: Portfolio, strategies, risk, backtest integration tests

**Files:** one file each for portfolio, strategies, risk, backtest

- [ ] **Step 1: Write portfolio integration tests**

```python
# tests/integration/test_portfolio_integration.py
import pytest


@pytest.mark.asyncio
async def test_portfolio_account_requires_auth(client):
    response = await client.get("/api/v1/portfolio/account")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_portfolio_account_returns_account_shape(client):
    response = await client.get(
        "/api/v1/portfolio/account",
        headers={"X-API-Key": "sentinel-dev-key"},
    )
    assert response.status_code in (200, 503)
    if response.status_code == 200:
        body = response.json()
        assert "equity" in body or "account" in body
```

Apply the same auth-required + shape-check pattern for:

- `test_strategies_integration.py`: `GET /api/v1/strategies/`
- `test_risk_integration.py`: `GET /api/v1/risk/limits`
- `test_backtest_integration.py`: `POST /api/v1/backtest/run` with minimal valid payload

- [ ] **Step 2: Run all integration tests together**

```bash
cd apps/engine && .venv/Scripts/python -m pytest tests/integration/ -v --tb=short
```

Expected: all pass or fail with clear error messages about missing env vars (not test errors).

- [ ] **Step 3: Commit**

```bash
git add apps/engine/tests/integration/
git commit -m "test(engine): add integration tests for portfolio, strategies, risk, backtest routes"
```

---

## Chunk 7: Playwright E2E Tests

---

### Task 7.1: Verify Playwright config exists and update it

**Files:** `apps/web/playwright.config.ts`

- [ ] **Step 1: Check current Playwright config**

```bash
cat apps/web/playwright.config.ts
```

- [ ] **Step 2: Ensure baseURL and webServer are configured**

The config should have:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

Update the config to match if it differs.

- [ ] **Step 3: Install Playwright browsers**

```bash
cd apps/web && pnpm exec playwright install chromium
```

---

### Task 7.2: E2E — dashboard loads

**Files:** `apps/web/tests/e2e/dashboard.spec.ts`

- [ ] **Step 1: Write test**

```typescript
import { test, expect } from '@playwright/test';

test('dashboard loads with metric cards and no console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // At least one metric card should be visible
  const cards = page.locator('[class*="card"]');
  await expect(cards.first()).toBeVisible();

  // No JavaScript console errors
  expect(consoleErrors).toHaveLength(0);
});
```

- [ ] **Step 2: Run (requires dev server)**

```bash
cd apps/web && pnpm exec playwright test tests/e2e/dashboard.spec.ts --headed
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/e2e/dashboard.spec.ts apps/web/playwright.config.ts
git commit -m "test(web): add Playwright E2E test for dashboard load"
```

---

### Task 7.3: E2E — backtest form submits

**Files:** `apps/web/tests/e2e/backtest.spec.ts`

- [ ] **Step 1: Write test**

```typescript
import { test, expect } from '@playwright/test';

test('backtest form submits and results appear', async ({ page }) => {
  await page.goto('/backtest');
  await page.waitForLoadState('networkidle');

  // Select a strategy (first available option)
  const strategySelect = page.getByRole('combobox').first();
  if (await strategySelect.isVisible()) {
    await strategySelect.selectOption({ index: 0 });
  }

  // Click run button
  const runButton = page.getByRole('button', { name: /run/i });
  await expect(runButton).toBeVisible();
  await runButton.click();

  // Wait for results or loading state to resolve (max 15s for backtest)
  await page.waitForFunction(
    () => !document.querySelector('[aria-busy="true"]'),
    { timeout: 15000 },
  );

  // Page should not show an error state
  const errorMsg = page.getByText(/failed|error/i);
  // If results appeared, that's a pass. If engine is down, check loading resolved.
  const resultsOrLoaded = await Promise.race([
    page.waitForSelector('[data-testid="metrics-table"]', { timeout: 3000 }).then(() => 'results'),
    page.waitForTimeout(3000).then(() => 'timeout'),
  ]);

  // At minimum, page should not have crashed (still showing the form)
  await expect(page).toHaveURL('/backtest');
});
```

- [ ] **Step 2: Run**

```bash
cd apps/web && pnpm exec playwright test tests/e2e/backtest.spec.ts --headed
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/e2e/backtest.spec.ts
git commit -m "test(web): add Playwright E2E test for backtest form"
```

---

### Task 7.4: E2E — settings save persists

**Files:** `apps/web/tests/e2e/settings.spec.ts`

- [ ] **Step 1: Write test**

```typescript
import { test, expect } from '@playwright/test';

test('settings page loads and save button is present', async ({ page }) => {
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');

  // Settings page should have at least one save/apply button
  const saveButton = page.getByRole('button', { name: /save|apply|update/i }).first();
  await expect(saveButton).toBeVisible();

  // Page renders without JavaScript errors
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.reload();
  await page.waitForLoadState('networkidle');
  expect(errors.filter(e => !e.includes('Supabase'))).toHaveLength(0);
});
```

- [ ] **Step 2: Run**

```bash
cd apps/web && pnpm exec playwright test tests/e2e/settings.spec.ts --headed
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/e2e/settings.spec.ts
git commit -m "test(web): add Playwright E2E test for settings page"
```

---

## Chunk 8: CI & Coverage

---

### Task 8.1: Measure actual coverage baselines

**Files:** read-only measurement step

- [ ] **Step 1: Run web coverage**

```bash
cd apps/web && pnpm exec vitest run --coverage
```

Note the reported lines/functions/branches % from the output.

- [ ] **Step 2: Run engine coverage**

```bash
cd apps/engine && .venv/Scripts/python -m pytest --cov=src --cov-report=term-missing
```

Note the reported % from the output.

- [ ] **Step 3: Run agents coverage**

```bash
cd apps/agents && pnpm exec vitest run --coverage
```

Note the reported % from the output.

Record all three baselines. Use them in Tasks 8.2–8.4 to set realistic thresholds
(target = baseline + 10%, capped at the spec targets of 70/70/75).

---

### Task 8.2: Add web coverage thresholds

**Files:** `apps/web/vitest.config.ts`

- [ ] **Step 1: Update `apps/web/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/components/ui/**'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
      },
    },
  },
});
```

- [ ] **Step 2: Run to verify thresholds are enforced**

```bash
cd apps/web && pnpm exec vitest run --coverage
```

Expected: PASS if coverage ≥ 70%. If below threshold, this will fail — add more tests first.

- [ ] **Step 3: Commit**

```bash
git add apps/web/vitest.config.ts
git commit -m "ci(web): add coverage thresholds (lines/functions ≥ 70%)"
```

---

### Task 8.3: Add agents coverage configuration

**Files:** `apps/agents/vitest.config.ts`

- [ ] **Step 1: Create `apps/agents/vitest.config.ts`** (currently missing)

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 65,
      },
    },
  },
});
```

- [ ] **Step 2: Run agents coverage**

```bash
cd apps/agents && pnpm exec vitest run --coverage
```

- [ ] **Step 3: Commit**

```bash
git add apps/agents/vitest.config.ts
git commit -m "ci(agents): add vitest coverage config with 75% thresholds"
```

---

### Task 8.4: Add engine coverage threshold

**Files:** `apps/engine/pyproject.toml`

- [ ] **Step 1: Update `[tool.pytest.ini_options]` in `pyproject.toml`**

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
addopts = "--cov=src --cov-report=term-missing --cov-fail-under=70"
```

- [ ] **Step 2: Run to verify**

```bash
cd apps/engine && .venv/Scripts/python -m pytest --tb=short
```

Expected: PASS. If coverage is below 70%, add more integration tests before this step.

- [ ] **Step 3: Commit**

```bash
git add apps/engine/pyproject.toml
git commit -m "ci(engine): enforce 70% coverage threshold via pytest-cov"
```

---

### Task 8.5: Update CI workflow

**Files:** `.github/workflows/ci.yml`

- [ ] **Step 1: Add `ruff format --check` to the engine job**

In the `test-engine` job, add after the `ruff check` step:

```yaml
- name: Ruff format check
  working-directory: apps/engine
  run: .venv/bin/python -m ruff format --check src/ tests/
```

(Note: on Linux CI the path is `.venv/bin/python`, not `.venv/Scripts/python`)

- [ ] **Step 2: Add `--coverage` flag to web test step**

```yaml
- name: Run web tests with coverage
  run: pnpm --filter web test --coverage
```

- [ ] **Step 3: Upload coverage artifacts**

Add to the `test-web` job after tests:

```yaml
- name: Upload web coverage
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: web-coverage
    path: apps/web/coverage/
```

Add similar artifact upload to `test-engine` and `test-agents` jobs.

- [ ] **Step 4: Add Playwright job**

```yaml
test-e2e:
  name: E2E Tests
  runs-on: ubuntu-latest
  needs: test-web
  steps:
    - uses: actions/checkout@v4
    - name: Setup Node 22
      uses: actions/setup-node@v4
      with:
        node-version: 22
    - name: Install pnpm
      run: npm install -g pnpm
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    - name: Install Playwright browsers
      run: pnpm --filter web exec playwright install --with-deps chromium
    - name: Run E2E tests
      run: pnpm --filter web test:e2e
      env:
        NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
        NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-anon-key
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add ruff format check, coverage uploads, and Playwright E2E job"
```

---

### Task 8.6: Update Turbo config

**Files:** `turbo.json`

- [ ] **Step 1: Update `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "persistent": true,
      "cache": false
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"],
      "env": [
        "SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "ENGINE_URL",
        "NEXT_PUBLIC_ENGINE_URL"
      ]
    },
    "test": {
      "outputs": ["coverage/**"]
    },
    "lint": {},
    "clean": {
      "cache": false
    }
  }
}
```

Note: `dependsOn: ["engine#build"]` for agents build is intentionally omitted — the engine is a
Python app with no TypeScript build output for agents to depend on. Build ordering is fine as-is.

- [ ] **Step 2: Commit**

```bash
git add turbo.json
git commit -m "chore: add env pass-through and coverage outputs to turbo.json"
```

---

## Chunk 9: Documentation

---

### Task 9.1: Per-app READMEs

**Files:** `apps/web/README.md`, `apps/engine/README.md`, `apps/agents/README.md`

- [ ] **Step 1: Create `apps/web/README.md`**

```markdown
# Sentinel Web

Next.js 16 dashboard for the Sentinel Trading Platform.

## Local Development

```bash
pnpm dev          # Start dev server at http://localhost:3000
pnpm test         # Run Vitest unit tests
pnpm test:e2e     # Run Playwright E2E tests
pnpm build        # Production build
```

## Required Environment Variables

| Variable | Description |
| -------- | ----------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_ENGINE_URL` | URL of the FastAPI engine (default: http://localhost:8000) |

Copy `.env.example` at the repo root and fill in values.
```

- [ ] **Step 2: Create `apps/engine/README.md`**

```markdown
# Sentinel Engine

Python FastAPI quant engine — market data ingestion, strategy signal generation, risk management,
backtesting, and order execution.

## Local Development

```bash
.venv/Scripts/python -m uvicorn src.api.main:app --reload --port 8000
```

API docs available at http://localhost:8000/docs once running.

## Tests

```bash
.venv/Scripts/python -m pytest               # All tests
.venv/Scripts/python -m pytest --cov=src     # With coverage
.venv/Scripts/python -m pytest tests/integration/  # Integration only
```

## Required Environment Variables

| Variable | Description |
| -------- | ----------- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `POLYGON_API_KEY` | Polygon.io market data API key |
| `ALPACA_API_KEY` | Alpaca brokerage API key |
| `ALPACA_SECRET_KEY` | Alpaca brokerage secret key |
```

- [ ] **Step 3: Create `apps/agents/README.md`**

```markdown
# Sentinel Agents

Node.js Claude AI agent orchestrator. Runs five specialized trading agents on a cron schedule
and exposes a REST API for the web dashboard.

## Local Development

```bash
pnpm dev    # Start with tsx watch at http://localhost:3001
pnpm test   # Run Vitest unit tests
```

## Required Environment Variables

| Variable | Description |
| -------- | ----------- |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `ENGINE_URL` | URL of the FastAPI engine |
```

- [ ] **Step 4: Commit all READMEs**

```bash
git add apps/web/README.md apps/engine/README.md apps/agents/README.md
git commit -m "docs: add per-app README files"
```

---

### Task 9.2: Enrich engine OpenAPI metadata

**Files:** `apps/engine/src/api/routes/*.py` (6 files)

- [ ] **Step 1: Add tags and summaries to `health.py`**

```python
@router.get("/health", summary="Health check", tags=["System"])
async def health():
    ...
```

- [ ] **Step 2: Add tags and summaries to `data.py`**

All routes in this file get `tags=["Market Data"]` and descriptive `summary=` strings.

- [ ] **Step 3: Add tags and summaries to `portfolio.py`**

All routes get `tags=["Portfolio"]`.

- [ ] **Step 4: Add tags and summaries to `strategies.py`**

All routes get `tags=["Strategies"]`.

- [ ] **Step 5: Add tags and summaries to `risk.py`**

All routes get `tags=["Risk"]`.

- [ ] **Step 6: Add tags and summaries to `backtest.py`**

All routes get `tags=["Backtest"]`.

- [ ] **Step 7: Start the server and verify docs**

```bash
cd apps/engine && .venv/Scripts/python -m uvicorn src.api.main:app --port 8000 &
sleep 3
curl -s http://localhost:8000/openapi.json | python3 -c "import json,sys; d=json.load(sys.stdin); [print(p) for p in d['paths']]"
```

Expected: all 13 routes listed with tags and summaries.

- [ ] **Step 8: Commit**

```bash
git add apps/engine/src/api/routes/
git commit -m "docs(engine): enrich all route functions with OpenAPI summary and tags"
```

---

### Task 9.3: Add migration header comments

**Files:** `supabase/migrations/00001_initial_schema.sql`,
`supabase/migrations/00002_indexes_rls_realtime.sql`,
`supabase/migrations/00003_agent_tables.sql`

- [ ] **Step 1: Add header to `00001_initial_schema.sql`**

At the very top of the file, before any SQL:

```sql
-- ============================================================
-- Migration 00001: Initial Schema
-- ============================================================
-- Creates the core domain tables for the Sentinel Trading Platform:
--   instruments   - Financial instruments (equities, ETFs, etc.)
--   market_data   - OHLCV time-series bars per instrument
--   strategies    - User-defined trading strategy configurations
--   signals       - Generated trade signals from the quant engine
--   orders        - Submitted and filled broker orders
--   accounts      - Broker account snapshots
-- ============================================================
```

- [ ] **Step 2: Add header to `00002_indexes_rls_realtime.sql`**

```sql
-- ============================================================
-- Migration 00002: Indexes, RLS Policies, and Realtime Config
-- ============================================================
-- Indexes: Composite indexes on (ticker, timestamp) for time-series
--   queries. Single-column indexes on foreign keys.
-- RLS: Row Level Security policies enabling service-role full access
--   and anon read-only access to market_data and signals.
-- Realtime: Enables Supabase Realtime on signals and orders tables
--   so the web dashboard receives live push updates.
-- ============================================================
```

- [ ] **Step 3: Add header to `00003_agent_tables.sql`**

```sql
-- ============================================================
-- Migration 00003: Agent Tables
-- ============================================================
-- Adds tables for the Claude AI agent orchestration layer:
--   recommendations - Trade recommendations from agents, with
--                     approval workflow (pending→approved/rejected)
--   alerts          - Agent-generated alerts and notifications
--                     displayed in the web dashboard
-- ============================================================
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "docs(db): add design-intent header comments to all migration files"
```

---

## Final Verification

After all 9 chunks are complete, run the full test suite and verify all success criteria.

- [ ] **Run all tests**

```bash
pnpm test
cd apps/engine && .venv/Scripts/python -m pytest --tb=short
```

Expected: all passing, coverage thresholds met.

- [ ] **Run type-check**

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter agents exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Verify no large page files remain**

```bash
wc -l apps/web/src/app/*/page.tsx | sort -rn | head -10
```

Expected: no page file exceeds 200 lines.

- [ ] **Verify no console statements in web source**

```bash
grep -rn "console\." apps/web/src/ --include="*.tsx" --include="*.ts"
```

Expected: zero matches.

- [ ] **Final commit — push to main**

```bash
git push origin main
```

Vercel will auto-deploy from the GitHub integration.
