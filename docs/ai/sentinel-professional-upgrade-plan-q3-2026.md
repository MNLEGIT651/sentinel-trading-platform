# Sentinel Professional Upgrade Plan — Q3 2026

## Context

The Q2 2026 hardening program (Phases A-F, 20 tickets) is complete. The platform now has:
- Supabase Auth (login/signup/password-reset/RBAC)
- 800+ automated tests (vitest + pytest + Playwright setup)
- CI/CD via GitHub Actions (lint, test, build, security audit)
- Data provenance, CSRF, rate limiting, correlation IDs, structured logging
- Order form with market/limit types, TIF, error mapping
- Risk summary component, journal linkage, advisor chat with retry

**The core gap:** Pages are well-engineered with proper query hooks and engine integration, but display empty/simulated states because (a) external API keys aren't configured in production, (b) some analysis pages depend on data that only exists after agent cycles run, and (c) several features need "last mile" UI polish to feel production-ready. The audit overstates the problem — this is not "mostly stubs" but rather "mostly wired, needs data and polish."

**Goal:** Transform Sentinel from a well-engineered prototype into a production-grade trading platform that delivers real value to users. Focus on making existing wiring work end-to-end, not building new systems.

---

## Corrected Assessment vs. Audit Claims

| Audit Claim | Actual State | Real Gap |
|---|---|---|
| "No auth system" | Supabase Auth fully integrated with RBAC | None — auth is done |
| "No testing or CI" | 800+ tests, GitHub Actions CI | Need E2E tests in CI |
| "Markets page shows skeleton loaders with no data" | Page has `useQuotesQuery`/`useBarsQuery` hooks wired to engine; falls back to synthetic data when offline | Needs Polygon API key configured; fallback UX could be clearer |
| "Signals scanning returns 'No signals yet'" | Scan button calls `POST /api/v1/strategies/scan` correctly | Needs Polygon key for real data; empty-state could suggest configuring keys |
| "Portfolio orders cannot be submitted" | QuickOrder supports market/limit with TIF, error mapping | Needs Alpaca keys; order flow is otherwise functional |
| "Analysis pages display zero entries" | Regime, catalysts, shadow portfolios, data-quality pages all have Supabase-backed query hooks | Data is empty until agent cycles run and populate tables |
| "No state management" | Zustand + TanStack React Query | None — state mgmt is solid |

---

## Phase Map

### Phase G — Environment & Data Pipeline Reliability
**Goal:** Ensure the platform works end-to-end when API keys are configured, and degrades gracefully when they're not.

#### T-G01 — Environment validation UI
- **Outcome:** Settings page shows which external services are configured/connected, with setup guidance for missing ones.
- **Scope:** `apps/web/src/app/(dashboard)/settings/page.tsx`, `apps/web/src/app/api/settings/connections/route.ts`, new `apps/engine/src/api/routes/health.py` endpoint additions
- **Dependencies:** None
- **Acceptance Criteria:**
  - Settings page shows connection status for: Supabase, Polygon, Alpaca Trading, Alpaca Broker, Anthropic
  - Each unconfigured service shows setup instructions
  - Engine `/health` endpoint returns per-dependency status (already partially exists)
- **Validation:** `pnpm --filter web test`; `pnpm test:engine`

#### T-G02 — Market data fallback transparency
- **Outcome:** Markets page clearly communicates when showing synthetic vs. live data and prompts users to configure Polygon.
- **Scope:** `apps/web/src/app/(dashboard)/markets/page.tsx`, `apps/web/src/lib/constants.ts`
- **Dependencies:** T-G01
- **Acceptance Criteria:**
  - When engine is online but Polygon unconfigured: show "Configure Polygon API key for live data" banner with link to settings
  - Synthetic data labeled explicitly (not just DataProvenance badge)
  - Auto-refresh interval when live data available (30s quotes, 60s bars)
- **Validation:** `pnpm --filter web test -- --run tests/pages/markets.test.tsx`

#### T-G03 — Signal scan reliability & feedback
- **Outcome:** Signals page provides actionable feedback when scans return empty, and streaming progress for long scans.
- **Scope:** `apps/web/src/app/(dashboard)/signals/page.tsx`, `apps/web/src/components/signals/`
- **Dependencies:** T-G02
- **Acceptance Criteria:**
  - Empty scan result shows reason (no API key, no signals above threshold, scan error)
  - Scan progress indicator (ticker count processed / total)
  - Last scan results persist in session (not lost on navigation)
- **Validation:** `pnpm --filter web test -- --run tests/pages/signals.test.tsx` (create if missing)

#### T-G04 — Portfolio data pipeline verification
- **Outcome:** Portfolio page works end-to-end with Alpaca paper trading, showing real positions and P&L.
- **Scope:** `apps/web/src/app/(dashboard)/portfolio/page.tsx`, `apps/web/src/hooks/queries/use-positions-query.ts`, `apps/web/src/hooks/queries/use-account-query.ts`
- **Dependencies:** T-G01
- **Acceptance Criteria:**
  - Account summary (buying power, equity, P&L) renders from engine data
  - Positions list with real-time quotes
  - Empty state guides user to either configure Alpaca or use paper trading
- **Validation:** `pnpm --filter web test -- --run tests/pages/portfolio.test.tsx`

---

### Phase H — Analysis Pages Activation
**Goal:** Make analysis pages (regime, catalysts, data-quality, shadow portfolios, counterfactuals, replay) show real data from Supabase.

#### T-H01 — Analysis page empty-state standardization
- **Outcome:** All analysis pages share a consistent empty-state pattern that explains what populates data and how to trigger it.
- **Scope:** `apps/web/src/components/ui/analysis-empty-state.tsx` (new), all analysis pages
- **Dependencies:** Phase G
- **Acceptance Criteria:**
  - Reusable `AnalysisEmptyState` component with icon, title, description, action button
  - Each analysis page explains: "This page populates when [agent cycles run / you record a regime / you create a shadow portfolio]"
  - Action buttons: "Run Agent Cycle" (links to agents page), "Create First Entry" (inline form)
- **Validation:** `pnpm --filter web test -- --run tests/components/`

#### T-H02 — Regime & catalysts seeding
- **Outcome:** Regime and catalysts pages can be manually populated and show meaningful initial data.
- **Scope:** `apps/web/src/app/(dashboard)/regime/page.tsx`, `apps/web/src/app/(dashboard)/catalysts/page.tsx`
- **Dependencies:** T-H01
- **Acceptance Criteria:**
  - Regime page: "Record Current Regime" form works (already has mutation hook)
  - Catalysts page: "Add Catalyst" form works (already has mutation hook)
  - Both pages render data after creation without page refresh
  - Playbook creation/deletion works on regime page
- **Validation:** `pnpm --filter web test`; manual verification with Supabase

#### T-H03 — Shadow portfolio lifecycle
- **Outcome:** Shadow portfolios can be created, viewed with performance metrics, and compared.
- **Scope:** `apps/web/src/app/(dashboard)/shadow-portfolios/page.tsx`, related query hooks
- **Dependencies:** T-H01
- **Acceptance Criteria:**
  - Create dialog submits to Supabase successfully
  - Portfolio card shows initial capital, strategy allocation, and creation date
  - Delete confirmation works
  - Performance metrics render when experiment snapshots exist
- **Validation:** `pnpm --filter web test`

#### T-H04 — Data quality & replay activation
- **Outcome:** Data quality events render from Supabase; replay page shows decision history.
- **Scope:** `apps/web/src/app/(dashboard)/data-quality/page.tsx`, `apps/web/src/app/(dashboard)/replay/page.tsx`
- **Dependencies:** T-H01
- **Acceptance Criteria:**
  - Data quality: events table renders, filtering by type/severity works, resolve action works
  - Replay: decision journal entries render with linked order/recommendation context
  - Both pages handle pagination for large datasets
- **Validation:** `pnpm --filter web test`

---

### Phase I — Strategy & Agent Enhancement
**Goal:** Complete strategy management UI and make agent orchestration interactive.

#### T-I01 — Strategy detail view & activation
- **Outcome:** Each strategy can be viewed in detail, activated/deactivated, and parameters adjusted.
- **Scope:** `apps/web/src/app/(dashboard)/strategies/page.tsx`, `apps/web/src/components/strategies/`
- **Dependencies:** Phase G
- **Acceptance Criteria:**
  - Strategy card expands to show parameters, health metrics, and recent signals
  - Toggle strategy active/inactive state (persists to Supabase)
  - Parameter editing with validation and save
- **Validation:** `pnpm --filter web test`

#### T-I02 — Agent cycle visibility & history
- **Outcome:** Agents page shows cycle history, per-agent run details, and tool call logs.
- **Scope:** `apps/web/src/app/(dashboard)/agents/page.tsx`, `apps/web/src/components/agents/`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Cycle history timeline (last 10 cycles with status, duration, agent results)
  - Per-agent expandable detail: last run time, tools invoked, output summary
  - Real-time cycle progress when a cycle is running
- **Validation:** `pnpm --filter web test`

#### T-I03 — Recommendation approval workflow polish
- **Outcome:** Recommendations page provides full context for approve/reject decisions.
- **Scope:** `apps/web/src/app/(dashboard)/recommendations/[id]/page.tsx`, `apps/web/src/components/agents/recommendation-card.tsx`
- **Dependencies:** T-I02
- **Acceptance Criteria:**
  - Recommendation detail shows: agent reasoning, risk assessment, position sizing suggestion
  - Approve triggers order with pre-populated fields; reject requires reason
  - Status transitions visible (pending → approved → filled / rejected → archived)
  - Toast notifications for state changes
- **Validation:** `pnpm --filter web test`

---

### Phase J — Onboarding & Settings Completion
**Goal:** Complete the user journey from signup to first trade.

#### T-J01 — Onboarding flow end-to-end verification
- **Outcome:** Live account onboarding (disclosures → KYC → bank link → funding) works when Alpaca Broker API is configured.
- **Scope:** `apps/web/src/app/(dashboard)/onboarding/live-account/page.tsx`, `apps/web/src/components/onboarding/`
- **Dependencies:** T-G01
- **Acceptance Criteria:**
  - Each step submits to engine onboarding endpoints
  - Step state persists across page reloads (uses Supabase `customer_onboarding` table)
  - Error handling for KYC rejection, bank link failure
  - Success state advances to funded account
- **Validation:** `pnpm --filter web test`; manual flow with Alpaca sandbox

#### T-J02 — Settings page completion
- **Outcome:** Settings page covers all user-configurable options: profile, risk preferences, broker connection, notifications.
- **Scope:** `apps/web/src/app/(dashboard)/settings/page.tsx`, `apps/web/src/components/settings/`
- **Dependencies:** T-G01, T-J01
- **Acceptance Criteria:**
  - Profile tab: display name, email (read-only from Supabase Auth)
  - Risk tab: max position size, sector limits, drawdown threshold (persists to `user_trading_policy`)
  - Broker tab: connection status, paper/live mode toggle
  - Notifications tab: email preference, push notification toggle
- **Validation:** `pnpm --filter web test`

#### T-J03 — Dashboard home page activation
- **Outcome:** Dashboard home shows real portfolio summary, recent signals, active alerts, and agent status.
- **Scope:** `apps/web/src/app/(dashboard)/page.tsx`, `apps/web/src/components/dashboard/`
- **Dependencies:** T-G04, T-G03
- **Acceptance Criteria:**
  - Portfolio summary card (equity, day P&L, buying power) from engine
  - Recent signals (last 5) from most recent scan
  - Active alerts from agents
  - Setup progress tracker for new users (configure API keys, run first scan, etc.)
  - All cards degrade gracefully when services unavailable
- **Validation:** `pnpm --filter web test`

---

### Phase K — E2E Testing & API Documentation
**Goal:** Production confidence through automated E2E tests and published API docs.

#### T-K01 — Playwright E2E test suite for critical paths
- **Outcome:** E2E tests cover: login, dashboard load, signal scan, order submission, journal entry.
- **Scope:** `apps/web/tests/e2e/`, `apps/web/playwright.config.ts`, `.github/workflows/ci.yml`
- **Dependencies:** Phase J
- **Acceptance Criteria:**
  - 5+ E2E scenarios covering critical user flows
  - Tests run in CI on PR (with mocked engine/agents via MSW or fixture server)
  - Failure screenshots uploaded as artifacts
- **Validation:** `pnpm test:web:e2e`; CI workflow green

#### T-K02 — OpenAPI spec generation & docs
- **Outcome:** Engine auto-generates OpenAPI spec; interactive docs accessible at `/docs`.
- **Scope:** `apps/engine/src/api/main.py`, engine route docstrings
- **Dependencies:** None
- **Acceptance Criteria:**
  - FastAPI auto-generates OpenAPI 3.1 spec (already built-in, needs docstring polish)
  - All routes have summary, description, request/response examples
  - `/docs` (Swagger UI) and `/redoc` accessible when engine running
  - Spec exported to `docs/api/openapi.json` in CI
- **Validation:** `pnpm test:engine`; manual verification of `/docs` endpoint

#### T-K03 — Test coverage gap closure
- **Outcome:** Test coverage meets thresholds for all critical-path modules.
- **Scope:** `apps/web/tests/`, `apps/engine/tests/`, `apps/agents/tests/`
- **Dependencies:** T-K01
- **Acceptance Criteria:**
  - Web: 60% statement coverage (current threshold)
  - Engine: Add route-level tests for data, portfolio, signals endpoints
  - Agents: Add orchestrator cycle test, recommendation lifecycle test
- **Validation:** `pnpm test`; `pnpm test:engine`; coverage reports

---

### Phase L — Performance & Polish
**Goal:** Production-grade performance, accessibility, and visual polish.

#### T-L01 — Loading & error state audit
- **Outcome:** Every page has consistent loading skeleton, error state with retry, and empty state.
- **Scope:** All dashboard pages
- **Dependencies:** T-H01
- **Acceptance Criteria:**
  - Loading: skeleton shimmer matching page layout (not generic spinner)
  - Error: message + "Retry" button + "Report Issue" link
  - Empty: contextual guidance (what to do next)
  - Success: toast notification for mutations
- **Validation:** Visual audit; `pnpm --filter web test`

#### T-L02 — Mobile responsiveness pass
- **Outcome:** All pages render correctly on mobile (375px+) with touch-friendly interactions.
- **Scope:** All dashboard pages, `apps/web/src/components/layout/`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Sidebar collapses to bottom nav on mobile (already partially done via T9.3)
  - Tables scroll horizontally; cards stack vertically
  - Touch targets >= 44px
  - No horizontal overflow on any page
- **Validation:** Playwright mobile viewport tests; manual device testing

#### T-L03 — Accessibility audit & fixes
- **Outcome:** WCAG 2.1 AA compliance for critical flows.
- **Scope:** All dashboard pages and components
- **Dependencies:** T-L01
- **Acceptance Criteria:**
  - All interactive elements keyboard-navigable
  - ARIA labels on custom components (already partially done)
  - Color contrast ratios meet AA (dark theme)
  - Screen reader announces page transitions and toast notifications
- **Validation:** axe-core audit; manual keyboard navigation test

#### T-L04 — Performance optimization
- **Outcome:** Dashboard loads in < 3s on 3G; no layout shifts after initial paint.
- **Scope:** `apps/web/next.config.ts`, component lazy loading, query prefetching
- **Dependencies:** None
- **Acceptance Criteria:**
  - Route-level code splitting (Next.js dynamic imports for heavy components like charts)
  - React Query prefetching for likely next pages
  - Image optimization via Next.js Image component
  - Bundle size audit (no large unused dependencies)
- **Validation:** Lighthouse CI score > 80 on Performance; `pnpm build` bundle analysis

---

## Decision Gates

| Gate | Between | Go Criteria |
|---|---|---|
| G-GH | G → H | Environment validation works; markets/signals show data with API keys configured |
| G-HI | H → I | Analysis pages render data from Supabase; empty states guide users |
| G-IJ | I → J | Strategy management functional; agent cycles visible in UI |
| G-JK | J → K | Onboarding flow works end-to-end; dashboard home shows real data |
| G-KL | K → L | E2E tests in CI; OpenAPI spec published; coverage thresholds met |
| G-DONE | L → Release | All tickets done; full validation suite green; Lighthouse > 80 |

---

## Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Polygon/Alpaca API rate limits throttle live experience | High | Medium | Engine already has caching and fallback; document rate limit expectations |
| R2 | Agent cycles produce low-quality recommendations | Medium | High | Phase I adds visibility into agent reasoning; human approval required |
| R3 | Onboarding KYC flow has edge cases with Alpaca sandbox | Medium | Medium | Test with Alpaca sandbox; document known limitations |
| R4 | E2E tests flaky due to external service dependencies | High | Medium | Mock engine/agents in E2E via MSW; only test UI behavior |
| R5 | Mobile layout breaks complex pages (agents, strategies) | Medium | Low | Progressive enhancement; complex features desktop-only with mobile summary |

---

## Execution Order & Dependencies

```
Phase G (Data Pipeline)     ─── T-G01 → T-G02 → T-G03
                                  └──→ T-G04

Phase H (Analysis Pages)    ─── T-H01 → T-H02
                                  ├──→ T-H03
                                  └──→ T-H04

Phase I (Strategy & Agents) ─── T-I01, T-I02 → T-I03

Phase J (Onboarding)        ─── T-J01 → T-J02
                                         └──→ T-J03

Phase K (Testing & Docs)    ─── T-K01, T-K02 → T-K03

Phase L (Polish)            ─── T-L01 → T-L03
                                T-L02, T-L04 (independent)
```

Phases G and H can run in parallel. Phase I can start after G. Phase J depends on G. Phase K depends on J. Phase L can start anytime after H.

---

## Verification

After all phases complete:
1. `pnpm lint && pnpm test && pnpm build` — green
2. `pnpm lint:engine && pnpm format:check:engine && pnpm test:engine` — green
3. `pnpm test:web:e2e` — green
4. `node scripts/security-audit.mjs` — no new findings
5. Lighthouse Performance > 80 on dashboard, markets, portfolio pages
6. Manual smoke test: signup → configure API keys → view markets → run scan → submit order → view journal

---

## Key Files Reference

| Purpose | Path |
|---|---|
| Engine data routes | `apps/engine/src/api/routes/data.py` |
| Engine portfolio routes | `apps/engine/src/api/routes/portfolio.py` |
| Engine strategies routes | `apps/engine/src/api/routes/strategies.py` |
| Engine onboarding routes | `apps/engine/src/api/routes/onboarding.py` |
| Engine health endpoint | `apps/engine/src/api/routes/health.py` |
| Web markets page | `apps/web/src/app/(dashboard)/markets/page.tsx` |
| Web signals page | `apps/web/src/app/(dashboard)/signals/page.tsx` |
| Web portfolio page | `apps/web/src/app/(dashboard)/portfolio/page.tsx` |
| Web strategies page | `apps/web/src/app/(dashboard)/strategies/page.tsx` |
| Web agents page | `apps/web/src/app/(dashboard)/agents/page.tsx` |
| Web settings page | `apps/web/src/app/(dashboard)/settings/page.tsx` |
| Web dashboard home | `apps/web/src/app/(dashboard)/page.tsx` |
| Web onboarding | `apps/web/src/app/(dashboard)/onboarding/live-account/page.tsx` |
| Query hooks | `apps/web/src/hooks/queries/` |
| Engine fetch proxy | `apps/web/src/lib/engine-fetch.ts` |
| DataProvenance component | `apps/web/src/components/ui/data-provenance.tsx` |
| Shared types | `packages/shared/src/types.ts` |
| CI workflow | `.github/workflows/ci.yml` |
| Existing Q2 plan | `docs/ai/claude-execution-plan-2026-q2.md` |
| Existing ticket board | `docs/ai/claude-ticket-board-2026-q2.md` |
| Project state ledger | `docs/ai/state/project-state.md` |

---

## What This Plan Does NOT Include (Deferred)

- **Mobile native app / PWA** — premature until web is production-grade
- **Social features / leaderboards** — not core to trading value proposition
- **Complex multi-agent orchestration changes** — agent pipeline already works; focus on UI visibility
- **New agent roles** — per T-E01 classification, non-essential agents (PR manager etc.) remain deprioritized
- **Infrastructure-as-code** — current Vercel + Railway setup is sufficient
- **Real-time WebSocket market data** — polling is adequate for v1; WebSocket upgrade is a v2 optimization
