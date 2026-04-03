# Claude Code Ticket Board — Q3 2026 Professional Upgrade

_Created: 2026-04-03_

Purpose: Atomic ticket board for the Sentinel Professional Upgrade Plan. Continues from the Q2 hardening program (Phases A-F). See `docs/ai/sentinel-professional-upgrade-plan-q3-2026.md` for the full plan with context and rationale.

## Operating Rules (same as Q2)

- Follow `AGENTS.md` non-negotiables.
- Claim exactly one ticket at a time in `docs/ai/state/project-state.md`.
- Keep diffs minimal and scoped.
- Do not present simulated/fallback data as live.
- Do not modify restricted files unless ticket scope explicitly includes them.
- Report exact command outputs and pass/fail status in each handoff.

## Validation Baseline

- Node workspaces: `pnpm lint`, `pnpm test`, `pnpm build`
- Engine: `pnpm lint:engine`, `pnpm format:check:engine`, `pnpm test:engine`
- E2E: `pnpm test:web:e2e` (after T-K01)
- Scoped runs allowed for narrow tickets; critical-path tickets require targeted tests.

---

## Phase G — Environment & Data Pipeline Reliability

### T-G01 — Environment validation UI

- **Outcome:** Settings page shows which external services are configured/connected with setup guidance.
- **Scope:** `apps/web/src/app/(dashboard)/settings/page.tsx`, `apps/web/src/app/api/settings/connections/route.ts` (new), engine health endpoint additions
- **Dependencies:** None
- **Acceptance Criteria:**
  - Settings shows connection status for: Supabase, Polygon, Alpaca Trading, Alpaca Broker, Anthropic
  - Unconfigured services show setup instructions
  - Engine `/health` returns per-dependency status
- **Validation:** `pnpm --filter web test`; `pnpm test:engine`

### T-G02 — Market data fallback transparency

- **Outcome:** Markets page clearly communicates synthetic vs. live data and prompts to configure Polygon.
- **Scope:** `apps/web/src/app/(dashboard)/markets/page.tsx`, `apps/web/src/lib/constants.ts`
- **Dependencies:** T-G01
- **Acceptance Criteria:**
  - Engine online + Polygon unconfigured: "Configure Polygon API key" banner linking to settings
  - Synthetic data explicitly labeled beyond DataProvenance badge
  - Auto-refresh when live (30s quotes, 60s bars)
- **Validation:** `pnpm --filter web test -- --run tests/pages/markets.test.tsx`

### T-G03 — Signal scan reliability & feedback

- **Outcome:** Signals page provides actionable feedback on empty scans and streaming progress.
- **Scope:** `apps/web/src/app/(dashboard)/signals/page.tsx`, `apps/web/src/components/signals/`
- **Dependencies:** T-G02
- **Acceptance Criteria:**
  - Empty results show reason (no API key, no signals above threshold, error)
  - Progress indicator during scan
  - Last scan results persist in session
- **Validation:** `pnpm --filter web test -- --run tests/pages/signals.test.tsx`

### T-G04 — Portfolio data pipeline verification

- **Outcome:** Portfolio works end-to-end with Alpaca paper trading.
- **Scope:** `apps/web/src/app/(dashboard)/portfolio/page.tsx`, related query hooks
- **Dependencies:** T-G01
- **Acceptance Criteria:**
  - Account summary renders from engine data
  - Positions list with real-time quotes
  - Empty state guides to Alpaca configuration or paper trading
- **Validation:** `pnpm --filter web test -- --run tests/pages/portfolio.test.tsx`

---

## Phase H — Analysis Pages Activation

### T-H01 — Analysis page empty-state standardization

- **Outcome:** Reusable empty-state component for all analysis pages.
- **Scope:** `apps/web/src/components/ui/analysis-empty-state.tsx` (new), all analysis pages
- **Dependencies:** Phase G complete
- **Acceptance Criteria:**
  - `AnalysisEmptyState` component with icon, title, description, action button
  - Each page explains what populates data and how to trigger it
  - Action buttons link to relevant pages or inline forms
- **Validation:** `pnpm --filter web test -- --run tests/components/`

### T-H02 — Regime & catalysts seeding

- **Outcome:** Regime and catalysts pages can be manually populated and display data.
- **Scope:** `apps/web/src/app/(dashboard)/regime/page.tsx`, `apps/web/src/app/(dashboard)/catalysts/page.tsx`
- **Dependencies:** T-H01
- **Acceptance Criteria:**
  - "Record Current Regime" form works via existing mutation hook
  - "Add Catalyst" form works via existing mutation hook
  - Data renders after creation without page refresh
  - Playbook CRUD works on regime page
- **Validation:** `pnpm --filter web test`; manual Supabase verification

### T-H03 — Shadow portfolio lifecycle

- **Outcome:** Shadow portfolios can be created, viewed with metrics, compared, and deleted.
- **Scope:** `apps/web/src/app/(dashboard)/shadow-portfolios/page.tsx`, related hooks
- **Dependencies:** T-H01
- **Acceptance Criteria:**
  - Create dialog submits to Supabase
  - Portfolio card shows capital, strategies, creation date
  - Delete confirmation works
  - Performance metrics render when snapshots exist
- **Validation:** `pnpm --filter web test`

### T-H04 — Data quality & replay activation

- **Outcome:** Data quality events render; replay page shows decision history.
- **Scope:** `apps/web/src/app/(dashboard)/data-quality/page.tsx`, `apps/web/src/app/(dashboard)/replay/page.tsx`
- **Dependencies:** T-H01
- **Acceptance Criteria:**
  - Data quality events table with type/severity filtering and resolve action
  - Replay page renders decision journal entries with linked context
  - Pagination for large datasets
- **Validation:** `pnpm --filter web test`

---

## Phase I — Strategy & Agent Enhancement

### T-I01 — Strategy detail view & activation

- **Outcome:** Strategies can be viewed in detail, toggled active/inactive, and parameters edited.
- **Scope:** `apps/web/src/app/(dashboard)/strategies/page.tsx`, `apps/web/src/components/strategies/`
- **Dependencies:** Phase G complete
- **Acceptance Criteria:**
  - Expandable strategy card with parameters, health, recent signals
  - Active/inactive toggle persists to Supabase
  - Parameter editing with validation and save
- **Validation:** `pnpm --filter web test`

### T-I02 — Agent cycle visibility & history

- **Outcome:** Agents page shows cycle history, per-agent details, and tool call logs.
- **Scope:** `apps/web/src/app/(dashboard)/agents/page.tsx`, `apps/web/src/components/agents/`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Cycle history timeline (last 10 with status, duration, results)
  - Per-agent expandable detail with last run, tools, output summary
  - Real-time progress during running cycle
- **Validation:** `pnpm --filter web test`

### T-I03 — Recommendation approval workflow polish

- **Outcome:** Recommendations provide full context for approve/reject decisions.
- **Scope:** `apps/web/src/app/(dashboard)/recommendations/[id]/page.tsx`, recommendation components
- **Dependencies:** T-I02
- **Acceptance Criteria:**
  - Detail shows agent reasoning, risk assessment, sizing suggestion
  - Approve pre-populates order fields; reject requires reason
  - Status transitions visible with toast notifications
- **Validation:** `pnpm --filter web test`

---

## Phase J — Onboarding & Settings Completion

### T-J01 — Onboarding flow end-to-end verification

- **Outcome:** Live account onboarding (disclosures → KYC → bank → funding) works with Alpaca Broker API.
- **Scope:** `apps/web/src/app/(dashboard)/onboarding/live-account/page.tsx`, onboarding components
- **Dependencies:** T-G01
- **Acceptance Criteria:**
  - Each step submits to engine onboarding endpoints
  - State persists across reloads via Supabase `customer_onboarding`
  - Error handling for KYC rejection, bank link failure
  - Success advances to funded account
- **Validation:** `pnpm --filter web test`; manual Alpaca sandbox flow

### T-J02 — Settings page completion

- **Outcome:** Settings covers profile, risk preferences, broker connection, notifications.
- **Scope:** `apps/web/src/app/(dashboard)/settings/page.tsx`, settings components
- **Dependencies:** T-G01, T-J01
- **Acceptance Criteria:**
  - Profile tab: display name, email
  - Risk tab: position limits, sector limits, drawdown threshold (persists to `user_trading_policy`)
  - Broker tab: connection status, paper/live toggle
  - Notifications tab: email and push preferences
- **Validation:** `pnpm --filter web test`

### T-J03 — Dashboard home page activation

- **Outcome:** Dashboard home shows real portfolio summary, recent signals, alerts, agent status.
- **Scope:** `apps/web/src/app/(dashboard)/page.tsx`, dashboard components
- **Dependencies:** T-G04, T-G03
- **Acceptance Criteria:**
  - Portfolio summary card (equity, day P&L, buying power)
  - Recent signals from most recent scan
  - Active agent alerts
  - Setup progress tracker for new users
  - Graceful degradation when services unavailable
- **Validation:** `pnpm --filter web test`

---

## Phase K — E2E Testing & API Documentation

### T-K01 — Playwright E2E test suite

- **Outcome:** E2E tests cover login, dashboard, scan, order submission, journal.
- **Scope:** `apps/web/tests/e2e/`, `apps/web/playwright.config.ts`, `.github/workflows/ci.yml`
- **Dependencies:** Phase J complete
- **Acceptance Criteria:**
  - 5+ E2E scenarios for critical user flows
  - CI runs on PR with mocked backend
  - Failure screenshots as artifacts
- **Validation:** `pnpm test:web:e2e`; CI green

### T-K02 — OpenAPI spec generation & docs

- **Outcome:** Engine auto-generates OpenAPI spec; interactive docs at `/docs`.
- **Scope:** `apps/engine/src/api/main.py`, route docstrings
- **Dependencies:** None
- **Acceptance Criteria:**
  - All routes have summary, description, examples
  - `/docs` and `/redoc` accessible
  - Spec exported to `docs/api/openapi.json` in CI
- **Validation:** `pnpm test:engine`; manual `/docs` check

### T-K03 — Test coverage gap closure

- **Outcome:** Coverage meets thresholds for all critical-path modules.
- **Scope:** All test directories
- **Dependencies:** T-K01
- **Acceptance Criteria:**
  - Web: 60% statement coverage
  - Engine: route-level tests for data, portfolio, signals
  - Agents: orchestrator cycle and recommendation lifecycle tests
- **Validation:** `pnpm test`; `pnpm test:engine`; coverage reports

---

## Phase L — Performance & Polish

### T-L01 — Loading & error state audit

- **Outcome:** Every page has consistent loading, error, and empty states.
- **Scope:** All dashboard pages
- **Dependencies:** T-H01
- **Acceptance Criteria:**
  - Loading: skeleton shimmer matching layout
  - Error: message + retry + report link
  - Empty: contextual guidance
  - Success: toast for mutations
- **Validation:** Visual audit; `pnpm --filter web test`

### T-L02 — Mobile responsiveness pass

- **Outcome:** All pages render correctly on 375px+ with touch-friendly targets.
- **Scope:** All dashboard pages, layout components
- **Dependencies:** None
- **Acceptance Criteria:**
  - Tables scroll horizontally; cards stack vertically
  - Touch targets >= 44px
  - No horizontal overflow
- **Validation:** Playwright mobile viewport; manual device testing

### T-L03 — Accessibility audit & fixes

- **Outcome:** WCAG 2.1 AA compliance for critical flows.
- **Scope:** All dashboard pages and components
- **Dependencies:** T-L01
- **Acceptance Criteria:**
  - Keyboard navigation for all interactive elements
  - ARIA labels on custom components
  - Color contrast meets AA
  - Screen reader announces transitions and toasts
- **Validation:** axe-core audit; keyboard testing

### T-L04 — Performance optimization

- **Outcome:** Dashboard loads in < 3s on 3G; no layout shifts after initial paint.
- **Scope:** `apps/web/next.config.ts`, components, query hooks
- **Dependencies:** None
- **Acceptance Criteria:**
  - Route-level code splitting
  - React Query prefetching
  - Image optimization
  - Bundle size audit
- **Validation:** Lighthouse > 80 Performance; `pnpm build` analysis
