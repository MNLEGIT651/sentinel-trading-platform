# Sentinel Worklog

> Cross-session context persistence. Updated by every AI agent at session start and end.
> Prevents context loss, circular debugging, and repeated failed approaches.
>
> **Rule**: Read this file at session start. Update it at session end.

## Active Context

_Last updated: 2026-04-10_

### Current Architecture Decisions

- **Web → Engine**: All calls go through `apps/web/src/lib/engine-fetch.ts` (same-origin proxy)
- **Web → Agents**: All calls go through `apps/web/src/lib/agents-client.ts`
- **Deployment**: Vercel (web) + Railway (engine + agents) + Supabase (database)
- **Agent coordination**: `docs/ai/state/project-state.md` is the single source of truth for task status

### Known Working Patterns

- `pnpm lint && pnpm test && pnpm build` for Node workspace validation
- `pnpm lint:engine && pnpm format:check:engine && pnpm test:engine` for Python engine
- `pnpm guardian` to run PR Guardian checks locally before creating a PR
- `turbo --ui stream` required for CI/scripting (TUI mode swallows output otherwise)
- `pnpm install` may prompt interactively — answer Y if it asks to rebuild node_modules

### Known Gotchas

- Node 24.x triggers `typescript-estree` warnings (supports <6.0.0) — cosmetic, non-blocking
- TypeScript 6.0.2 is bleeding edge — some ecosystem tools emit warnings
- `apps/web/.next/cache` can grow large — `pnpm clean` if builds are slow
- `proxy.ts` and `middleware.ts` cannot coexist in Next.js — use only `proxy.ts`

---

## Failed Approaches Log

> Record approaches that were tried and failed. Prevents agents from re-trying the same thing.

| Date       | Agent    | What Was Tried                                     | Why It Failed                                            | Lesson                                              |
| ---------- | -------- | -------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| 2026-04-09 | Multiple | 8 overlapping PRs from 3 agents                    | No coordination — agents didn't check for in-flight work | Always check open PRs before starting work          |
| 2026-04-09 | Codex    | PR #297 used `BrokerInterface` class name          | Hallucinated — actual class is `BrokerAdapter`           | Run `pnpm typecheck` before creating PR             |
| 2026-04-09 | Codex    | PR #295 added `middleware.ts` alongside `proxy.ts` | Next.js rejects coexistence of middleware + proxy        | Check existing patterns before introducing new ones |
| 2026-04-09 | Codex    | PR #297 touched 64 files across 5 subsystems       | Too broad — impossible to review safely                  | Keep PRs under 20 files, one concern per PR         |

---

## Session Log

> Brief entry per agent session. Most recent first.

### 2026-04-12 — Claude (Phase 2 — Sentry SDK Wire-up + PR Hygiene)

**Goal**: Wire Sentry error tracking into the FastAPI engine (opt-in via DSN env
var) so production errors surface immediately in an observability dashboard.
Close redundant PR #309 to unblock PR Guardian on PR #306.

**What changed**:

- `apps/engine/src/telemetry.py` — added `init_sentry(dsn, environment,
  traces_sample_rate)` function. Lazy-imports `sentry_sdk` + FastAPI/Starlette
  integrations; returns False gracefully if DSN is empty or SDK is missing.
  Uses `send_default_pii=False`, falls back to `RAILWAY_ENVIRONMENT` when
  environment param is empty.
- `apps/engine/src/config.py` — added `sentry_dsn`, `sentry_environment`,
  `sentry_traces_sample_rate` settings (all opt-in, empty/0.1 defaults).
- `apps/engine/src/api/main.py` — calls `init_sentry()` in lifespan before
  `_settings.validate()` so startup errors are captured.
- `apps/engine/pyproject.toml` — added `sentry-sdk[fastapi]>=2.0` dependency.
- `apps/engine/uv.lock` — regenerated (sentry-sdk v2.57.0 resolved).
- `apps/engine/tests/unit/test_sentry_init.py` — 5 unit tests: no-op on empty
  DSN, no-op on None DSN, no-op when SDK not installed, successful init with
  correct kwargs, RAILWAY_ENVIRONMENT fallback.
- `docs/runbooks/release-checklist.md` — added §5.6 "Sentry Error Tracking
  (Engine)" with env var matrix and post-deploy checks; added §5.7 "CI
  Environment Prerequisites" documenting `VERCEL_PREVIEW_SMOKE_URL` and other
  required secrets.
- Closed PR #309 (redundant cherry-pick of active branch commits; caused PR
  Guardian overlap failure on PR #306).

**Validation**:

- `pnpm test:engine` — pass (+ 5 new tests)
- `pnpm lint:engine` — clean
- `pnpm format:check:engine` — clean

**Decisions**:

- Sentry init runs before `_settings.validate()` — captures startup crashes
  (missing env vars, DB unreachable) which are the highest-value errors in prod.
- `send_default_pii=False` — never ship user IPs/emails to Sentry. If needed
  later, requires explicit opt-in + privacy review.
- Kept sentry-sdk as a hard dep (not optional) because it's a core production
  observability tool. The init_sentry() function is still a no-op when DSN is
  empty, so dev/test environments pay zero cost.
- PR #309 closed rather than merged — it cherry-picked from the active branch
  inverting source-of-truth and blocking Guardian with 9-file overlap.

**Next steps**:

1. **Ops**: Set `SENTRY_DSN` in Railway engine production secrets.
2. **Ops**: Set `VERCEL_PREVIEW_SMOKE_URL` in GitHub repo secrets.
3. **Phase 2 continued**: Nightly cash/position reconciliation cron, SLO
   dashboards.

### 2026-04-11 — Claude (Phase 1 Blocker #3 — Order Reconciliation Loop)

**Goal**: Close the last tractable Phase 1 code blocker — periodic reconciliation
of non-terminal Alpaca orders — so that asynchronously-filled live orders settle
in the local store without manual `GET /orders/{id}` calls. Per the 2026-04-10
decision, reconciliation belongs in the engine (not the web webhook) because
Alpaca's Trading API uses SSE, not HTTP webhooks.

**What changed**:

- `apps/engine/src/services/order_reconciliation.py` — new background service.
  Exposes `reconcile_once()` (single sweep) and `reconciliation_loop(interval)` +
  `start_reconciliation_task(interval)` (long-running loop). Sweep is a no-op
  for PaperBroker, sequential per-order refresh to stay under Alpaca's 200 req/min,
  per-order errors swallowed so one bad ID cannot stall the loop, cooperative
  cancellation on shutdown.
- `apps/engine/src/config.py` — `order_reconciliation_interval_seconds: float = 30.0`
  (set to 0 to disable; env var `ORDER_RECONCILIATION_INTERVAL_SECONDS`).
- `apps/engine/src/api/main.py` — lifespan starts the task after `_settings.validate()`,
  cancels + awaits it during shutdown, swallows `CancelledError` from the awaited task.
- `apps/engine/tests/unit/test_order_reconciliation.py` — 10 new unit tests covering
  PaperBroker no-op, terminal-order skip, successful multi-order refresh, per-order
  failure isolation, None-result not counted, disabled/negative interval, clean
  cancellation, loop exits immediately when disabled, loop swallows sweep exceptions.
- `docs/runbooks/release-checklist.md` — added §5.5 "Order Reconciliation" with
  log-verification checklist and disable-with-caution note.

**Validation**:

- `pnpm test:engine` — 490/490 pass (+10 new tests)
- `pnpm lint:engine` — clean
- `pnpm format:check:engine` — clean

**Decisions**:

- Sequential (not concurrent) per-order refresh — keeps us well under Alpaca's
  rate limit and avoids head-of-line blocking if one request hangs; bounded
  worst case is `len(non_terminal) * 15s httpx timeout` ≈ 150s for 10 orders,
  which is still shorter than the 30s loop interval on the steady state.
- Loop swallows all non-`CancelledError` exceptions and continues — maximum
  uptime for live-order state is the goal; one sweep failure must not
  silently leave the entire engine without reconciliation.
- Defaulted to 30s interval — tight enough for UI freshness without stressing
  the rate limit. Operators can tune via env var without code changes.
- Did NOT switch to Alpaca's streaming API (`wss://paper-api.alpaca.markets/stream`) —
  polling is simpler to reason about, survives reconnects without custom logic,
  and 30s latency is acceptable for equity orders. Revisit if we move to
  sub-second strategies.

**Next steps (remaining Phase 1 / Phase 2)**:

1. **Env rotation** (ops task, no code) — still pending.
2. **Live-account KYC handshake** — still blocked on product/legal sign-off.
3. **Phase 2**: Sentry DSN wire-up in Vercel prod, nightly cash/position
   reconciliation cron (different from this intra-day sweep), SLO dashboards.

### 2026-04-10 — Claude (Production Readiness Audit + Phase 1 Blocker #1)

**Goal**: Audit production readiness of Sentinel and close the #1 critical blocker
to live trading — the missing live-execution gate in the engine order path.

**Audit finding**: Project is ~68% production-ready. Paper trading is fully functional
end-to-end, architecture/CI/security posture are solid. The critical gap was that
`POST /api/v1/portfolio/orders` had no `live_execution_enabled` or `global_mode`
check — flipping to live credentials would have routed orders to Alpaca live
with no off-switch in the hot path. Secondary gaps (live-account KYC handshake,
nightly reconciliation, SLO dashboards, Sentry wire-up) remain as follow-ups.

**What changed** (scoped to blocker #1 only):

- `apps/engine/src/services/order_service.py` — added `check_live_execution_gate()`
  which fails closed: rejects orders when the broker would route to a non-paper
  Alpaca endpoint unless both `system_controls.live_execution_enabled=true` AND
  `system_controls.global_mode='live'`. Returns 503 if DB unavailable, 403 if
  either condition fails. PaperBroker and Alpaca paper endpoints bypass the gate.
- `apps/engine/src/api/routes/portfolio.py` — wired the gate into `submit_order`
  immediately after `get_broker()`, before pre-trade risk checks.
- `apps/engine/src/execution/alpaca_broker.py` — exposed `self.base_url` as a
  public attribute so the gate can detect live venues without touching private state.
- `apps/engine/tests/unit/test_portfolio_routes.py` — added 5 new unit tests:
  (1) Alpaca paper bypass, (2) fail-closed on DB=None, (3) block when flag off,
  (4) block when global_mode=paper, (5) allow when both conditions hold.
- `docs/runbooks/release-checklist.md` — added §5.4 "Live Trading Activation Gate"
  with the exact operator checklist for flipping paper → live.

**Validation**:

- `pnpm test:engine` — 479/479 pass (added 5 new tests)
- `pnpm lint:engine` (ruff check) — clean
- `pnpm format:check:engine` (ruff format) — clean

**Decisions**:

- Fail-closed on DB unavailable is intentional: a silent bypass during an outage
  would be catastrophic for live capital. 503 is correct.
- Paper gate bypass is URL-based (`"paper" in base_url`), matching how
  `get_broker()` already detects paper-vs-live in its startup log.
- Did NOT scaffold `/api/onboarding/live-account` KYC route — it needs product
  and legal input before implementation; scaffolding half of it would create
  dead code or security holes.
- Did NOT add Alpaca `trade_update` reconciliation to the web webhook — Alpaca's
  Trading API uses SSE streams, not HTTP webhooks, for order updates. Proper
  reconciliation belongs in the engine (polling `refresh_order` on non-terminal
  orders or subscribing to Alpaca's streaming API).

**Next steps (Phase 1 follow-ups, each its own PR)**:

1. **Env rotation** (ops task, no code): rotate Alpaca production credentials
   into Railway secrets and flip `ALPACA_BASE_URL=https://api.alpaca.markets`.
2. **Live-account KYC handshake**: design + implement `/api/onboarding/live-account`
   with risk acknowledgment, tax ID collection, and accredited-investor check.
   Needs product/legal sign-off on copy and required fields.
3. **Order reconciliation**: add periodic `refresh_order` sweep for non-terminal
   orders in the engine, OR subscribe to Alpaca's Trading API streaming endpoint.
4. **Phase 2**: wire Sentry DSN in Vercel prod, nightly cash/position
   reconciliation cron, SLO dashboards.

### 2026-04-10 — Copilot (PR Guardian System)

**Goal**: Build automated guardrails to prevent AI agent drift and quality issues.

**What changed**:

- Created `scripts/pr-guardian.mjs` — 7-check automated PR quality gate
- Created `.github/workflows/pr-guardian.yml` — CI enforcement
- Created `.github/agents/repo-guardian.agent.md` — on-demand audit agent
- Updated `AGENTS.md` with PR quality gates and self-validation checklist
- Updated `.github/copilot-instructions.md` with scope/freshness rules
- Updated `.github/pull_request_template.md` with agent metadata fields

**Validation**: lint (3/3 pass), test (1122/1122 pass), build (3/3 pass)

**Decisions**: Delta-based file health (not absolute), import checks advisory-only,
overlap/staleness fail only with high-risk paths.

**Next steps**: Add pre-PR validation script, WORKLOG, worktree management, enhanced agent-ops.

### 2026-04-09 — Copilot (PR Audit & Consolidation)

**Goal**: Audit all 8 open PRs, validate main, close stale PRs.

**What changed**: Closed all 8 open PRs (#301, #300, #298, #297, #295, #288, #287, #283).
Deleted 8 stale remote branches. Validated main at `e42c779`.

**Validation**: install, lint (3/3), test (1596 total), build (3/3) — all pass.

**Decisions**: All 8 PRs superseded by consolidated merge PR #303. No cherry-picks needed.
