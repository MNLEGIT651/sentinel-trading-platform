# Sentinel Trading Platform — Codebase Optimization Design

**Date:** 2026-03-15
**Approach:** Surgical Precision (Approach A)
**Status:** Approved

---

## 1. Scope

**Remove:** `apps/compass/` — prototype with no tests, no deployment, no integrations. Delete entirely, clean all references from workspace config, Turbo, and CI.

**Optimize:**
- `apps/web` — Next.js 16 dashboard
- `apps/engine` — Python FastAPI quant engine
- `apps/agents` — Claude AI orchestrator
- `packages/shared` — TypeScript types

**No new apps added.** The three-app architecture covers all concerns cleanly.

---

## 2. Developer Tooling Layer

Professional codebases enforce quality automatically — before code lands, not after.

### 2.1 Formatting & Style
- **`.prettierrc`** — Consistent formatting across TS/TSX/JSON/CSS/YAML. Settings: `semi: true`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: "all"`, `printWidth: 100`.
- **`.editorconfig`** — IDE-agnostic rules for indent style, charset, trailing newlines. Ensures VS Code, Vim, WebStorm all agree.

### 2.2 Pre-commit Enforcement
- **`husky`** — Git hooks manager. Installed at monorepo root.
- **`lint-staged`** — Runs only on staged files. Runs Prettier (format) then ESLint (lint) on `.ts/.tsx` files, Prettier on `.json/.css/.yaml`, Ruff on `.py`.
- **`commitlint`** — Enforces conventional commit format (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`). Blocks non-conforming commits.

### 2.3 TypeScript Consistency
- **Root `tsconfig.base.json`** — Shared strict TypeScript config extended by all three TS apps. Settings: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Each app's `tsconfig.json` extends this base.

### 2.4 Node Version Pinning
- **`.nvmrc`** — Pins `22` (LTS). `fnm use` / `nvm use` auto-activates correct version.

### 2.5 CI Coverage Gates
- CI fails if coverage drops below: web ≥ 70%, engine ≥ 70%, agents ≥ 75%.
- Coverage reports uploaded as CI artifacts.

---

## 3. Code Refactoring

Principle: a file that does one thing is easier to test, review, and change. The six oversized pages get decomposed. No logic changes — pure extraction.

### 3.1 Web Page Decomposition

Each large page becomes an orchestrator that composes focused sub-components. Components live in `src/components/<domain>/`.

| Page | Current Lines | Extracted Components |
|------|--------------|----------------------|
| `portfolio/page.tsx` | 758 | `PositionsTable`, `AllocationChart`, `SnapshotMetrics`, `OrderHistory` |
| `settings/page.tsx` | 667 | `BrokerSettings`, `RiskSettings`, `ScheduleSettings`, `ConnectionStatus` |
| `backtest/page.tsx` | 651 | `BacktestForm`, `ResultsChart`, `MetricsTable`, `TradeLog` |
| `strategies/page.tsx` | 491 | `StrategyCard`, `StrategyParams`, `SignalBadge` |
| `agents/page.tsx` | 384 | `AgentStatusCard`, `RecommendationCard`, `AgentAlertFeed` |
| `signals/page.tsx` | 343 | `SignalCard`, `SignalFilters`, `SignalTimeline` |

Target: no page file exceeds 200 lines. Each extracted component: ≤150 lines, single responsibility, fully typed props.

### 3.2 Shared Hook: `useAsyncAction`
Eliminate the repeated pattern of `loading/error/data` state across every page. A single `useAsyncAction<T>(fn)` hook returns `{ execute, data, loading, error, reset }` and handles try/catch/finally. All pages migrate to it.

### 3.3 Error Handling Standardization
- **Web:** All API errors surface through a single `toast` call (shadcn/ui Toast). No `console.error` in production code — replace with `toast.error(message)`.
- **Engine:** All route handlers use a single `HTTPException` raise pattern with consistent error response shape `{ error: string, detail: string }`.
- **Agents:** Existing `AgentsApiError` class retained; all route handlers already use it.

### 3.4 Engine Config Validation
`apps/engine/src/config.py` raises `ValueError` at startup if required env vars are missing. Required vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Optional vars (broker, data) log a warning but don't halt.

---

## 4. Testing Strategy

Target: every public interface has a test. Every user-facing critical path has an E2E test.

### 4.1 Web Unit Tests (Vitest)
New tests for all extracted components (each has a render + interaction test), the `useAsyncAction` hook, `use-realtime` hook, and the `signals/page` and dashboard `page` (currently untested).

### 4.2 Engine Integration Tests (pytest)
New `tests/integration/` suite. One integration test file per route group, using `httpx.AsyncClient` against the real FastAPI app with mocked external services (Polygon, Alpaca). Tests cover: happy path, error cases, validation rejection.

### 4.3 Playwright E2E Tests
Three critical-path tests:
1. **Dashboard loads** — visit `/`, assert metric cards render, no console errors.
2. **Backtest runs** — fill form, submit, assert results table appears.
3. **Settings save** — change a risk limit, save, reload, assert value persisted.

### 4.4 Coverage Configuration
- **Web:** `vitest.config.ts` adds `coverage.thresholds` at 70%.
- **Engine:** `pyproject.toml` adds `--cov-fail-under=70`.
- **Agents:** `vitest.config.ts` adds `coverage.thresholds` at 75%.

---

## 5. Security & Environment

### 5.1 `.env` Gitignore Verification
Confirm `.env` is in `.gitignore`. If not, add it immediately. The `.env.example` is the canonical reference — it already exists.

### 5.2 Environment Validation
- **Engine** (`config.py`): raise on missing critical vars at import time.
- **Agents** (`index.ts`): already has startup guards — verify they cover all required vars.
- **Web:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are validated in the Supabase client factory — add an explicit check that throws a readable error in development.

### 5.3 API Documentation
FastAPI auto-generates OpenAPI at `/docs`. Ensure `title`, `description`, `version` are set in `main.py`. Add `summary` and `tags` to all route functions so the generated docs are navigable.

---

## 6. Dependency & Config Cleanup

### 6.1 Turbo Pipeline Improvements
- Add `env` pass-through for `SUPABASE_URL`, `NEXT_PUBLIC_*` so Turbo cache is invalidated when env changes.
- Add `outputs` for test coverage artifacts.
- Tighten `dependsOn` so `agents` build depends on `engine` health check.

### 6.2 Package Deduplication
- Move `typescript` to root `devDependencies` and remove from individual apps (Turbo hoists it).
- Verify `@supabase/supabase-js` version is pinned consistently across web and agents.

### 6.3 Python Tooling
- `ruff format` added alongside `ruff check` in CI (formatting enforcement, not just linting).
- `pyproject.toml` adds `[tool.ruff.format]` section with `quote-style = "double"`, `indent-style = "space"`.

---

## 7. Documentation

### 7.1 Per-App READMEs
Each app directory gets a focused `README.md` covering: what it does, how to run it locally, env vars required, test command.

### 7.2 OpenAPI Enrichment
All engine route functions get `summary`, `description`, and `tags`. FastAPI `/docs` becomes the living API reference.

### 7.3 Database Schema Comment
`supabase/migrations/00001_initial_schema.sql` gets a header comment block describing the schema design intent (already has table comments — augment at the migration level).

---

## 8. Implementation Chunks

Ordered by dependency — each chunk is independently shippable:

| Chunk | Work | Risk |
|-------|------|------|
| 1. Cleanup | Delete compass, fix .gitignore, verify secrets | Zero |
| 2. Tooling | Prettier, EditorConfig, Husky, Commitlint, tsconfig.base, .nvmrc | Low |
| 3. Refactor | Decompose 6 pages into components, add useAsyncAction hook | Medium |
| 4. Error handling | Standardize web toasts, engine error shapes, env validation | Low |
| 5. Testing — Web | Unit tests for all new components + missing pages | Low |
| 6. Testing — Engine | Integration test suite for all 6 route groups | Low |
| 7. Testing — E2E | Three Playwright critical-path tests | Medium |
| 8. CI & Coverage | Add thresholds, coverage artifacts, ruff format | Low |
| 9. Docs | Per-app READMEs, OpenAPI enrichment | Zero |

---

## 9. Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| Test coverage — web | 25% | ≥ 70% |
| Test coverage — engine | 35% | ≥ 70% |
| Test coverage — agents | 67% | ≥ 75% |
| Largest page file | 758 lines | ≤ 200 lines |
| Pre-commit hooks | None | Prettier + ESLint + Commitlint |
| E2E tests | 0 | 3 critical paths |
| Engine integration tests | 0 | 6 route suites |
| `.env` in gitignore | Unknown | Confirmed |
| `console.error` in prod code | 3 | 0 |
| `compass` app | Present | Deleted |
