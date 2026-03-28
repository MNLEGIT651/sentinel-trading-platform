# Page Alignment Audit

> Generated as part of `cc-page-alignment` audit task.
> Read-only audit — no page code was modified.

## Summary

| Page      | Blueprint Widgets                                           | Status | Notes                                            |
| --------- | ----------------------------------------------------------- | ------ | ------------------------------------------------ |
| Dashboard | health, mode, approvals, alerts, fills, regime              | ⚠️     | Missing market regime widget                     |
| Markets   | watchlist, regime panel, top movers                         | ❌     | Missing regime panel and top movers              |
| Signals   | ranked list, reason/metadata, portfolio fit, approve/reject | ❌     | Missing portfolio fit and approve/reject actions |
| Portfolio | positions, allocation, orders, daily P&L, drawdown          | ⚠️     | Missing drawdown visualization                   |
| Agents    | status, cycle timeline, run history, errors, rec queue      | ⚠️     | Cycle timeline and run history are minimal       |
| Settings  | system mode, hard limits, approval rules, policy version    | ⚠️     | Missing policy version display                   |

**Legend:** ✅ = fully aligned, ⚠️ = mostly aligned with minor gaps, ❌ = significant gaps

---

## Detailed Findings

### Dashboard (`page.tsx`)

| Widget            | Present? | Implementation                                                                               |
| ----------------- | -------- | -------------------------------------------------------------------------------------------- |
| System health     | ✅       | Health strip shows trading status via `systemControls?.trading_halted`                       |
| Trading mode      | ✅       | `systemControls?.global_mode` displayed in health strip                                      |
| Pending approvals | ✅       | Count shown in health strip from `pendingRecs?.length`                                       |
| Active alerts     | ✅       | Alert feed + active incident count card (critical unresolved)                                |
| Recent fills      | ✅       | Active Signals section renders filled recommendations                                        |
| Market regime     | ❌       | **Not rendered.** `useRegimeStateQuery` hook exists in codebase but is not used on this page |

**Data sources:** `useQuotesQuery`, `useAccountQuery`, `useAlertsQuery`, `useRecommendationsQuery`, `useSystemControlsQuery`, `useAgentStatusQuery`, `useOperatorActionsQuery`. All server-sourced via TanStack Query; no localStorage for policy data. Zustand store provides `engineOnline`/`agentsOnline` status.

---

### Markets (`markets/page.tsx`)

| Widget       | Present? | Implementation                                                            |
| ------------ | -------- | ------------------------------------------------------------------------- |
| Watchlist    | ✅       | 10-ticker list (AAPL, MSFT, GOOGL, etc.) with live prices, click-to-chart |
| Regime panel | ❌       | **Not present.** No regime data or component rendered                     |
| Top movers   | ❌       | **Not present.** No movers calculation or section                         |

**Data sources:** `useQuotesQuery`, `useBarsQuery`, `useAppStore`. Fallback data includes hardcoded prices and synthetic OHLCV generation for offline mode. No localStorage usage.

---

### Signals (`signals/page.tsx`)

| Widget             | Present? | Implementation                                                                                        |
| ------------------ | -------- | ----------------------------------------------------------------------------------------------------- |
| Ranked signal list | ✅       | `SignalTimeline` table sorted by strength (desc), with sortable columns                               |
| Reason/metadata    | ⚠️       | `signal.reason` and `signal.strategy_name` shown; `signal.metadata` stored but **not rendered** in UI |
| Portfolio fit      | ❌       | **Not present.** No portfolio overlap or correlation analysis                                         |
| Approve/reject     | ❌       | **Not present.** Page is read-only signal viewer; approve/reject lives on Agents page instead         |

**Data sources:** Direct `fetch()` to engine via `engineUrl('/api/v1/strategies/scan')`. Fully client-side (`'use client'`). Zustand provides `engineOnline`. No caching—fresh scan on each invocation. No localStorage.

---

### Portfolio (`portfolio/page.tsx`)

| Widget        | Present? | Implementation                                                 |
| ------------- | -------- | -------------------------------------------------------------- |
| Positions     | ✅       | `PositionsTable` with ticker, shares, entry/current price, P&L |
| Allocation    | ✅       | `AllocationChart` with sector-based breakdown                  |
| Recent orders | ✅       | `RecentOrders` component with order history and polling        |
| Daily P&L     | ✅       | `SnapshotMetrics` displays `totalPnl` and `totalPnlPct`        |
| Drawdown      | ❌       | **Not present.** No drawdown calculation or visualization      |

**Data sources:** `useAccountQuery`, `usePositionsQuery`, `useOrderHistoryQuery`, `useQuotesQuery`, `useOrderStatusQuery`, `useSubmitOrderMutation`. All via TanStack Query. Fallback account with `equity: 100_000`. No localStorage.

---

### Agents (`agents/page.tsx`)

| Widget               | Present? | Implementation                                                                                                                                 |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent status         | ✅       | 5 agent cards (Market Sentinel, Strategy Analyst, Risk Monitor, Research Analyst, Execution Monitor) with status badges and pulsing indicators |
| Cycle timeline       | ⚠️       | Shows `cycleCount` and `nextCycleAt` text; **no visual timeline component**                                                                    |
| Run history          | ⚠️       | Only `lastRun` timestamp per agent card; **no detailed run history view or log**                                                               |
| Errors               | ✅       | Agent error state + `AgentAlertFeed` with severity-filtered alerts                                                                             |
| Recommendation queue | ✅       | `RecommendationCard` with pending trades, approve/reject buttons, and `ApprovalDialog` with risk preview                                       |

**Data sources:** `useAgentStatusQuery` (5s poll), `useRecommendationsQuery` (5s), `useAlertsQuery` (5s), `useRiskPreviewQuery` (on-demand). Mutations for cycle/halt/resume/approve/reject. Zustand provides `agentsOnline`. No localStorage or hardcoded demo data.

---

### Settings (`settings/page.tsx`)

| Widget         | Present? | Implementation                                                                                                               |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| System mode    | ✅       | Banner showing `systemControls.global_mode` with halt indicator; links to `/system-controls`                                 |
| Hard limits    | ✅       | Position Limits card (max position %, sector %, open positions) + Circuit Breakers card (daily loss %, soft/hard drawdown %) |
| Approval rules | ✅       | "Require Confirmation" toggle in Trading Mode card                                                                           |
| Policy version | ❌       | **Not displayed.** No version number, timestamp, or policy revision shown                                                    |

**Data sources:** `useTradingPolicy()` (fetches/updates via `/api/settings/policy`), `useSystemControlsQuery()`. Notification preferences use `localStorage` key `sentinel:notification-prefs` (UI-only prefs, not policy data—acceptable). Connection status via direct fetch to `/api/settings/status`.

---

## Data Fetching Patterns Summary

| Page      | Primary Hook Pattern                             | Policy from localStorage? | Proper Auth?     |
| --------- | ------------------------------------------------ | ------------------------- | ---------------- |
| Dashboard | TanStack Query + Zustand                         | No                        | ✅ Engine proxy  |
| Markets   | TanStack Query + Zustand                         | No                        | ✅ Engine proxy  |
| Signals   | Direct fetch + Zustand                           | No                        | ✅ `engineUrl()` |
| Portfolio | TanStack Query + Zustand                         | No                        | ✅ Engine proxy  |
| Agents    | TanStack Query + Zustand                         | No                        | ✅ Agents client |
| Settings  | TanStack Query + localStorage (notif prefs only) | No (policy via API)       | ✅ API routes    |

---

## Gaps Requiring Implementation (Do Not Fix — Document Only)

1. **Dashboard — Market regime widget:** Hook `useRegimeStateQuery` exists but is not wired into the dashboard. Needs a regime indicator card or badge.

2. **Markets — Regime panel:** No regime data is fetched or displayed. Needs a component showing current market regime (bull/bear/neutral/volatile).

3. **Markets — Top movers:** No movers calculation. Needs a section ranking tickers by absolute change or volume.

4. **Signals — Portfolio fit:** No portfolio-aware analysis. Needs integration showing how a signal relates to current holdings (overlap, correlation, concentration risk).

5. **Signals — Approve/reject actions:** Signals page is read-only. Approve/reject lives exclusively on Agents page. Blueprint may intend signals to also have action buttons, or this is a deliberate separation of concerns.

6. **Portfolio — Drawdown visualization:** No max-drawdown chart or metric. Needs a drawdown curve or at minimum a current/max drawdown number.

7. **Agents — Cycle timeline:** Only text-based count + next time. Needs a visual timeline (e.g., Gantt-style or stepped progress) showing cycle phases.

8. **Agents — Run history:** Only `lastRun` per agent. Needs a detailed history view with past cycle results, durations, and outcomes.

9. **Settings — Policy version:** No version or revision identifier displayed. Needs a version number or last-updated timestamp for the active trading policy.
