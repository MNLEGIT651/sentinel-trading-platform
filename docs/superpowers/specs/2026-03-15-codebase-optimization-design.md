# Sentinel Trading Platform — Codebase Optimization Design

**Date:** 2026-03-15
**Approach:** Surgical Precision (Approach A)
**Status:** Approved

---

## 1. Scope

**Remove:** `apps/compass/` — prototype with no tests, no deployment, no integrations. Delete the
directory entirely. The `pnpm-workspace.yaml` uses an `apps/*` glob so no workspace config change
is needed; verify no source file imports `@compass/*` before deleting.

**Optimize:**

- `apps/web` — Next.js 16.1.6 dashboard
- `apps/engine` — Python FastAPI quant engine
- `apps/agents` — Claude AI orchestrator
- `packages/shared` — TypeScript types

**No new apps added.** The three-app architecture covers all concerns cleanly.

---

## 2. Developer Tooling Layer

Professional codebases enforce quality automatically — before code lands, not after.

### 2.1 Formatting & Style

- **`.prettierrc`** — Consistent formatting across TS/TSX/JSON/CSS/YAML. Settings: `semi: true`,
  `singleQuote: true`, `tabWidth: 2`, `trailingComma: "all"`, `printWidth: 100`.
- **`.editorconfig`** — IDE-agnostic rules for indent style, charset, trailing newlines. Ensures
  VS Code, Vim, WebStorm all agree.

### 2.2 Pre-commit Enforcement

- **`husky`** — Git hooks manager. Installed at monorepo root.
- **`lint-staged`** — Runs only on staged files. Runs Prettier (format) then ESLint (lint) on
  `.ts/.tsx` files, Prettier on `.json/.css/.yaml`, Ruff check+format on `.py`.
- **`commitlint`** — Enforces conventional commit format (`feat:`, `fix:`, `chore:`, `test:`,
  `docs:`, `refactor:`). Blocks non-conforming commits.

### 2.3 TypeScript Consistency

- **Root `tsconfig.base.json`** — Shared strict TypeScript config extended by all three TS apps.
  Base settings: `strict: true` (covers `noImplicitAny`, `strictNullChecks`, etc.).

  **Note:** `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are deliberately deferred
  to after Chunk 3 (refactoring) is complete. Enabling them before decomposition would produce
  hundreds of type errors across 6 large files simultaneously. They are added as Chunk 3b once
  pages are decomposed into small, focused components.

- Each app's `tsconfig.json` extends `../../tsconfig.base.json`.

### 2.4 Node Version Pinning

- **`.nvmrc`** — Pins `22` (LTS). `fnm use` / `nvm use` auto-activates the correct version.

### 2.5 CI Coverage Gates

Coverage baselines must be measured by running the test suites before adding thresholds.
Run `pnpm test --coverage` and `pytest --cov=src` to record actual baselines, then set gates
at baseline + a modest improvement target.

Provisional targets (revise after baseline run):

- web ≥ 70%, engine ≥ 70%, agents ≥ 75%

The agents target is highest because its test infrastructure is already the most mature
(8 test files, ~67% coverage) — getting to 75% requires only targeted gap-filling, whereas web
and engine need larger additions from a lower starting point.

---

## 3. Code Refactoring

Principle: a file that does one thing is easier to test, review, and change. The six oversized
pages get decomposed — no logic changes, pure extraction into focused components.

### 3.1 Web Page Decomposition

Each large page becomes an orchestrator that composes focused sub-components.
Components live in `src/components/<domain>/`.

| Page                  | Lines | Extracted Components                                                     |
| --------------------- | ----- | ------------------------------------------------------------------------ |
| `portfolio/page.tsx`  | 758   | `PositionsTable`, `AllocationChart`, `SnapshotMetrics`, `OrderHistory`   |
| `settings/page.tsx`   | 667   | `BrokerSettings`, `RiskSettings`, `ScheduleSettings`, `ConnectionStatus` |
| `backtest/page.tsx`   | 651   | `BacktestForm`, `ResultsChart`, `MetricsTable`, `TradeLog`               |
| `strategies/page.tsx` | 491   | `StrategyCard`, `StrategyParams`, `SignalBadge`                          |
| `agents/page.tsx`     | 384   | `AgentStatusCard`, `RecommendationCard`, `AgentAlertFeed`                |
| `signals/page.tsx`    | 343   | `SignalCard`, `SignalFilters`, `SignalTimeline`                          |

The dashboard `page.tsx` (288 lines) is below the 300-line threshold and will not be structurally
decomposed. It receives a smoke test (render + assert key elements) in Chunk 5.

Target: no decomposed page file exceeds 200 lines after extraction. Each extracted component:
≤ 150 lines, single responsibility, fully typed props interface.

### 3.2 Shared Hook: `useAsyncAction`

Eliminate the repeated `loading/error/data` state pattern across every page. A single
`useAsyncAction<T>(fn)` hook returns `{ execute, data, loading, error, reset }` and handles
try/catch/finally centrally. All pages migrate to it.

### 3.3 Error Handling Standardization

**Web:** All API errors surface via `toast()` from `sonner` (already wired into `layout.tsx` via
`@/components/ui/sonner`). No `console.error` in production code — replace the 3 instances in
`agents/page.tsx` with `toast.error(message)`. Import: `import { toast } from 'sonner'`.

**Engine:** FastAPI's native `HTTPException` produces `{ "detail": "..." }`. To emit a consistent
two-field shape `{ "error": string, "detail": string }` across all routes, add a custom exception
handler in `main.py`:

```python
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": http_status_to_key(exc.status_code), "detail": exc.detail},
    )
```

All route handlers continue to `raise HTTPException(...)` — only the serialization changes.

**Agents:** The server uses inline `res.status(...).json({ error: '...', detail: '...' })` and a
global error handler emitting `{ error: 'internal_error', message: err.message }`. Standardize
the global handler to emit `detail` instead of `message` so the shape is consistent with the
engine contract: `{ error: string, detail: string }`.

### 3.4 Engine Config Validation

`apps/engine/src/config.py` raises `ValueError` at startup if required env vars are missing.

- Required vars (raise if absent): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Optional vars (warn and continue): `POLYGON_API_KEY`, `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`

---

## 4. Testing Strategy

Target: every public interface has a test. Every user-facing critical path has an E2E test.

### 4.1 Web Unit Tests (Vitest)

New tests for:

- All extracted components from Section 3.1 (render + at least one interaction per component)
- The `useAsyncAction` hook (loading/success/error state transitions)
- The `use-realtime` hook (subscribe/unsubscribe lifecycle)
- `signals/page` (currently no test file)
- Dashboard `page.tsx` — smoke test only (render, assert presence of metric cards)

### 4.2 Engine Integration Tests (pytest)

New `tests/integration/` suite. One file per route group using `httpx.AsyncClient` against the
real FastAPI `app` instance with external services mocked via `respx`.

Route groups: `health`, `data`, `portfolio`, `strategies`, `risk`, `backtest`.
Each suite covers: happy path, error/validation rejection, missing-auth rejection.

### 4.3 Playwright E2E Tests

Three critical-path tests (app running against test Supabase):

1. **Dashboard loads** — visit `/`, assert metric cards render, zero console errors.
2. **Backtest runs** — fill strategy form, submit, assert results table appears.
3. **Settings save** — change a risk limit, save, reload page, assert value persisted.

### 4.4 Coverage Configuration

After measuring actual baselines (Section 2.5), set thresholds:

- **Web:** `vitest.config.ts` `coverage.thresholds` (lines/functions/branches)
- **Engine:** `pyproject.toml` `addopts = "--cov-fail-under=70"`
- **Agents:** `vitest.config.ts` `coverage.thresholds`

---

## 5. Security & Environment

### 5.1 `.env` Gitignore Verification

Confirm `.env` is listed in `.gitignore`. If currently tracked by git
(`git ls-files .env` returns a path), remove it with `git rm --cached .env` and add to
`.gitignore`. The `.env.example` file is the canonical reference — it already exists.

### 5.2 Environment Validation

- **Engine** (`config.py`): raise on missing critical vars (see Section 3.4).
- **Agents** (`index.ts`): audit startup guards — verify `ANTHROPIC_API_KEY`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, and `ENGINE_URL` all fail-fast if absent.
- **Web:** In `lib/supabase/client.ts`, add an explicit dev-mode check: if
  `NEXT_PUBLIC_SUPABASE_URL` is empty, throw a readable `Error` with the variable name and a link
  to `.env.example`.

### 5.3 API Documentation

FastAPI auto-generates OpenAPI at `/docs`. Ensure `main.py` sets `title`, `description`, and
`version`. Add `summary`, `description`, and `tags` to all 13 route functions so the generated
docs are navigable and usable as the living API reference.

---

## 6. Dependency & Config Cleanup

### 6.1 Turbo Pipeline Improvements

- Add `env` array to the `build` task for `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` so Turbo cache is correctly invalidated on env changes.
- Add `outputs` entries for test coverage report directories.
- Add `"dependsOn": ["engine#build"]` to the agents `build` task so Turbo builds engine before
  agents. This is a build-order dependency, not a runtime health check.

### 6.2 Package Deduplication

- Move `typescript` to root `devDependencies` (remove from `apps/web` and `apps/agents` —
  pnpm hoists it and all three TS apps use the same version).
- Verify `@supabase/supabase-js` version is pinned consistently across web and agents.

### 6.3 Python Tooling

- Add `ruff format` alongside `ruff check` in CI and in the `lint-staged` hook.
- Add `[tool.ruff.format]` to `pyproject.toml`: `quote-style = "double"`, `indent-style = "space"`.

---

## 7. Documentation

### 7.1 Per-App READMEs

Each app directory gets a concise `README.md` covering: what it does, local dev command,
required env vars, test command.

### 7.2 OpenAPI Enrichment

All 13 engine route functions receive `summary`, `description`, and `tags` kwargs.
FastAPI `/docs` and `/redoc` become the living API reference.

### 7.3 Database Schema Comments

All three migration files get a header comment block describing design intent:

- `00001_initial_schema.sql` — core tables (instruments, market_data, signals, orders)
- `00002_indexes_rls_realtime.sql` — index strategy, RLS policy rationale, Realtime config
- `00003_agent_tables.sql` — agent recommendations and alerts schema

---

## 8. Implementation Chunks

Ordered by dependency — each chunk is independently shippable:

| #   | Chunk            | Work                                                             | Risk   |
| --- | ---------------- | ---------------------------------------------------------------- | ------ |
| 1   | Cleanup          | Delete compass, fix .gitignore, verify .env not tracked          | Zero   |
| 2   | Tooling          | Prettier, EditorConfig, Husky, Commitlint, tsconfig.base, .nvmrc | Medium |
| 3   | Refactor         | Decompose 6 pages → components, add `useAsyncAction` hook        | Medium |
| 3b  | TS Strict+       | Enable `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` | Medium |
| 4   | Error handling   | Sonner toasts, FastAPI custom exception handler, env validation  | Low    |
| 5   | Testing — Web    | Unit tests for components + missing pages + hooks                | Low    |
| 6   | Testing — Engine | Integration test suite (6 route groups, respx mocks)             | Low    |
| 7   | Testing — E2E    | Three Playwright critical-path tests                             | Medium |
| 8   | CI & Coverage    | Measure baselines, add thresholds, ruff format in CI             | Low    |
| 9   | Docs             | Per-app READMEs, OpenAPI enrichment, migration header comments   | Zero   |

Chunk 2 is Medium risk: `tsconfig.base` + `strict` may surface existing type errors that must
be fixed before the chunk is complete.

---

## 9. Success Criteria

| Metric                       | Before            | Target                                         |
| ---------------------------- | ----------------- | ---------------------------------------------- |
| Test coverage — web          | ~25% (unverified) | ≥ 70%                                          |
| Test coverage — engine       | ~35% (unverified) | ≥ 70%                                          |
| Test coverage — agents       | ~67% (unverified) | ≥ 75%                                          |
| Largest page file            | 758 lines         | ≤ 200 lines                                    |
| Pre-commit hooks             | None              | Prettier + ESLint + Commitlint                 |
| E2E tests                    | 0                 | 3 critical paths                               |
| Engine integration tests     | 0                 | 6 route suites                                 |
| `.env` tracked by git        | Unknown           | Confirmed not tracked                          |
| `console.error` in prod code | 3                 | 0                                              |
| `compass` app                | Present           | Deleted                                        |
| TypeScript strict mode       | Partial           | Full (`strict` + deferred flags post-refactor) |
| FastAPI error shape          | Inconsistent      | `{ error, detail }` uniformly                  |
| OpenAPI docs enriched        | None              | All 13 routes have summary + tags              |
