# Release Checklist and Rollback Runbook

_Last updated: 2026-07-19 — Ticket T-F03_

Use this checklist for every production release. **Do not skip sections.** Each section must be completed in order, and the go/no-go gate (§3) must pass before any deploy begins.

Related docs:

- [SLO Dashboard Spec](slo-dashboard-spec.md) (T-F02) — thresholds referenced in §3
- [Correlation ID Flow](correlation-id-flow.md) (T-F01) — tracing during incidents
- [Production Runbook](production.md) — topology and env var reference
- [AI Review Checklist](../ai/review-checklist.md) — PR-level quality gates

---

## 1. Local Validation (Test Evidence Required)

Run all commands and record pass/fail output. Attach the summary to the PR or handoff message.

```bash
# Web + agents
pnpm lint
pnpm test
pnpm build
pnpm test:web
pnpm test:agents

# Engine
pnpm lint:engine
pnpm format:check:engine
pnpm test:engine
```

Evidence template (paste into PR body):

```text
## Release Test Evidence
- pnpm lint:            ✅ pass
- pnpm test:            ✅ pass (N tests)
- pnpm build:           ✅ pass
- pnpm test:web:        ✅ pass (N tests)
- pnpm test:agents:     ✅ pass (N tests)
- pnpm lint:engine:     ✅ pass
- pnpm format:check:engine: ✅ pass
- pnpm test:engine:     ✅ pass (N tests)
- git status:           ✅ clean
```

- [ ] All 8 commands pass
- [ ] Evidence pasted into PR body
- [ ] No untracked files that should be committed (`git status`)

> **Blocker:** If any critical-path test suite fails, stop here. Do not proceed to the go/no-go gate.

### 1.1 Supply-chain verification (SBOM tooling)

- [ ] SBOM generation step uses pinned or integrity-verified tooling (no unverified `curl | sh` installers).
- [ ] Generated SBOM artifacts (`sbom.cdx.json`, `sbom.spdx.json`) are attached to the release.
- [ ] Any change to SBOM tooling is reviewed as a security-sensitive CI change.

---

## 2. Code Review Gate

- [ ] PR has been reviewed and approved
- [ ] CI pipeline passes all jobs (test-web, test-engine, test-agents)
- [ ] No `NEXT_PUBLIC_ENGINE_URL` or `NEXT_PUBLIC_AGENTS_URL` referenced in new client-side code
- [ ] No backend URLs or auth keys exposed to the browser
- [ ] No `localhost` URLs hardcoded in production code paths
- [ ] If API routes changed: proxy routes still forward correctly
- [ ] If env vars changed: deployment guide updated
- [ ] Review checklist in `docs/ai/review-checklist.md` completed

---

## 3. Go / No-Go Gate (SLO-Based)

Before deploying, confirm current production SLO health. These thresholds come from [slo-dashboard-spec.md](slo-dashboard-spec.md) §1–§2. **If any gate is red, the deploy is blocked.**

### 3.1 Error Budget Check

| Metric                | Budget Limit (30-day)          | Deploy Blocked If     |
| --------------------- | ------------------------------ | --------------------- |
| Auth error rate       | ≤ 1% of authenticated requests | Budget consumed ≥ 75% |
| Order failure rate    | ≤ 0.5% of order submissions    | Budget consumed ≥ 75% |
| Proxy 5xx rate        | ≤ 1% of all proxy requests     | Budget consumed ≥ 75% |
| Timeout rate          | ≤ 2% of all proxy requests     | Budget consumed ≥ 75% |
| Stale-data rate       | ≤ 5% of market-hours minutes   | Budget consumed ≥ 75% |
| Agent P0 failure rate | ≤ 1% of scheduled cycles       | Budget consumed ≥ 75% |

- [ ] All error budgets are below 75% consumption

### 3.2 Latency Check

| Critical Path          | p95 Target (ms) | Deploy Blocked If p95 Exceeds |
| ---------------------- | --------------- | ----------------------------- |
| Market data — quotes   | ≤ 3,000         | 7,000 (p99 budget)            |
| Market data — bars     | ≤ 2,500         | 6,000                         |
| Strategy scan          | ≤ 15,000        | 35,000                        |
| Backtest execution     | ≤ 10,000        | 25,000                        |
| Order submission       | ≤ 2,000         | 5,000                         |
| Agent workflows (GET)  | ≤ 1,500         | 3,000                         |
| Agent workflows (POST) | ≤ 2,000         | 4,000                         |
| Health probes          | ≤ 500           | 1,500                         |

- [ ] No critical-path endpoint exceeds its p99 budget

### 3.3 Availability Check

| Service          | Target | Deploy Blocked If    |
| ---------------- | ------ | -------------------- |
| Web (Vercel)     | 99.9%  | Availability < 99.5% |
| Engine (Railway) | 99.5%  | Availability < 99.0% |
| Agents (Railway) | 99.5%  | Availability < 99.0% |

- [ ] All services above their block threshold

### 3.4 Active Alerts Check

- [ ] No active SEV-1 (Critical) alerts
- [ ] No active SEV-2 (Warning) alerts older than 1 hour

### Go / No-Go Decision

- [ ] **GO** — All gates green. Proceed to §4.
- [ ] **NO-GO** — Document which gate failed and why. Fix before re-attempting.

---

## 4. Deploy Procedure

### 4.1 Railway Backend Deploy

Deploy backends **before** the web frontend so health probes pass during Vercel build.

**Engine:**

```bash
# Railway deploys automatically on push to main.
# To trigger a manual deploy:
railway up --service sentinel-engine --environment production
```

- [ ] Engine deployed to Railway
- [ ] Engine `/health` returns 200
- [ ] Engine logs show clean startup and correct port binding

**Agents:**

```bash
railway up --service sentinel-agents --environment production
```

- [ ] Agents deployed to Railway
- [ ] Agents `/health` returns 200
- [ ] Agents `/status` returns orchestrator state
- [ ] Agents logs show clean startup and correct port binding

### 4.2 Vercel Preview Validation

- [ ] Vercel preview env vars set (`ENGINE_URL`, `ENGINE_API_KEY`, `AGENTS_URL`)
- [ ] Preview deployment reaches `READY` state
- [ ] `/api/engine/health` returns 200
- [ ] `/api/agents/health` returns 200
- [ ] `/api/settings/status` reports engine + agents connected
- [ ] `/settings` page shows all services connected
- [ ] `/agents` page loads with controls enabled
- [ ] `/` dashboard loads without offline banner
- [ ] Browser DevTools Network tab: no direct backend requests

### 4.3 Vercel Production Deploy

- [ ] Merge PR to `main`
- [ ] Vercel production deployment reaches `READY` state

Or force deploy without a commit:

```bash
cd apps/web && vercel --prod
```

---

## 5. Post-Deploy Validation

Run these within 5 minutes of production deploy completing.

### 5.1 Smoke Tests

| Check          | Path                   | Expected                                 |
| -------------- | ---------------------- | ---------------------------------------- |
| Engine health  | `/api/engine/health`   | 200                                      |
| Agents health  | `/api/agents/health`   | 200                                      |
| Agents status  | `/api/agents/status`   | 200 + orchestrator state                 |
| Service status | `/api/settings/status` | engine + agents connected                |
| Settings page  | `/settings`            | All services connected                   |
| Agents page    | `/agents`              | Controls enabled                         |
| Dashboard      | `/`                    | No offline banner, no localhost fallback |

- [ ] All smoke tests pass
- [ ] `Vercel Preview Smoke` GitHub Action passed for the commit (required gate)

### 5.2 SLO Spot Check (5-Minute Window Post-Deploy)

| Metric                       | Acceptable Range       |
| ---------------------------- | ---------------------- |
| p95 quote latency            | ≤ 3,000 ms             |
| p95 order submission latency | ≤ 2,000 ms             |
| 5xx error rate               | ≤ 1%                   |
| Health probe latency         | ≤ 500 ms               |
| Agent P0 cycles              | Completing on schedule |

- [ ] No SLO violations in the first 5-minute post-deploy window

### 5.3 Log Verification

- [ ] Vercel runtime logs: no `not_configured` errors
- [ ] Vercel runtime logs: no `localhost` in upstream URLs
- [ ] Vercel runtime logs: no auth header leakage
- [ ] Railway engine logs: clean startup
- [ ] Railway agents logs: clean startup
- [ ] Correlation IDs flowing (check a sample request trace per [correlation-id-flow.md](correlation-id-flow.md))

### 5.4 Live Trading Activation Gate

> **Scope:** Only relevant when promoting the environment from paper to live trading.
> For paper-only deploys, skip this section — the defaults already block live execution.

The engine order-submission path (`apps/engine/src/api/routes/portfolio.py:submit_order`)
calls `check_live_execution_gate()` (`apps/engine/src/services/order_service.py`) which
**fails closed**: any order routed to an Alpaca **live** base URL is rejected unless
**both** of these conditions hold in the `system_controls` table:

| Field                    | Required value | Effect when missing                                        |
| ------------------------ | -------------- | ---------------------------------------------------------- |
| `live_execution_enabled` | `true`         | Engine returns `403 Live execution is disabled`            |
| `global_mode`            | `'live'`       | Engine returns `403 System is in '<mode>' mode`            |

Paper brokers (`PaperBroker`) and Alpaca paper endpoints
(`*paper-api.alpaca.markets*`) bypass the gate because they cannot move real capital.

**Activation checklist** (operator role required, one-way door — treat as deploy):

- [ ] Alpaca **live** credentials rotated into Railway engine secrets:
      - `ALPACA_API_KEY` (production)
      - `ALPACA_SECRET_KEY` (production)
      - `ALPACA_BASE_URL=https://api.alpaca.markets`
- [ ] Engine redeployed and `GET /api/engine/health` returns 200
- [ ] Engine logs show `Using Alpaca broker (live)` on startup
- [ ] Dry-run order **before** flipping the gate: `POST /api/v1/portfolio/orders`
      must return `403 Live execution is disabled` (proves the gate is active)
- [ ] Flip the gate via the Web UI (operator role) or `PATCH /api/system-controls`:
      ```json
      { "live_execution_enabled": true, "global_mode": "live" }
      ```
- [ ] Verify the operator action was logged in `operator_actions` with
      `action_type = "change_mode"`
- [ ] Submit a $1 smoke order against a safe symbol and verify it reaches Alpaca
- [ ] Set `trading_halted = true` immediately if anything looks wrong
      (kill switch remains in place; see §6 Rollback)

**Rollback from live → paper** is always available:
```json
PATCH /api/system-controls
{ "live_execution_enabled": false, "global_mode": "paper" }
```
No redeploy required. Any in-flight order path will then be rejected by the gate.

### 5.5 Order Reconciliation (Non-Terminal Sweep)

The engine runs a background task (`apps/engine/src/services/order_reconciliation.py`)
that sweeps non-terminal orders against Alpaca every
`ORDER_RECONCILIATION_INTERVAL_SECONDS` seconds (default **30**). The sweep
calls `AlpacaBroker.refresh_order()` for each order whose status is not in
`TERMINAL_STATUSES` (`filled`, `rejected`, `cancelled`) and updates the local
order store. This keeps the UI, risk engine, and P&L in sync when Alpaca
fills an order asynchronously.

- **PaperBroker deployments:** the sweep is a no-op — `get_broker()` is not
  `AlpacaBroker`, so no action is needed.
- **Live deployments:** confirm the loop is running by checking engine logs
  for `order_reconciliation: starting loop (interval=30.0s)` on startup.
- **Disabling:** set `ORDER_RECONCILIATION_INTERVAL_SECONDS=0` in Railway
  engine env (not recommended for live — non-terminal orders will never
  settle in the local store).

Post-deploy verification:

- [ ] Engine logs contain `order_reconciliation: starting loop` on startup
- [ ] After submitting a dry-run live order, engine logs eventually show
      `order_reconciliation: refreshed 1/1 non-terminal orders`
- [ ] `/api/v1/portfolio/orders/history` shows the final `filled` status
      without manually hitting `GET /orders/{id}`

### 5.6 Portfolio Reconciliation (Cash/Position Audit)

The engine runs a background task (`apps/engine/src/services/portfolio_reconciliation.py`)
that performs a full audit of portfolio state against Alpaca every
`PORTFOLIO_RECONCILIATION_INTERVAL_SECONDS` seconds (default **3600** = 1 hour).

Unlike the order reconciliation (§5.5), which refreshes individual order statuses,
this service:
- Fetches authoritative account (cash, equity) and all positions from Alpaca
- Cross-references Alpaca positions against filled orders in the local store
- Flags **unaccounted positions** (manual trades, dividends, corporate actions)
- Flags **phantom orders** (filled locally but missing from Alpaca)
- Persists reconciliation snapshots to Supabase (`reconciliation_snapshots` table)

| Env Var                                      | Default | Notes                                  |
| -------------------------------------------- | ------- | -------------------------------------- |
| `PORTFOLIO_RECONCILIATION_INTERVAL_SECONDS`  | `3600`  | Set to `0` to disable; `86400` = daily |

- **PaperBroker deployments:** no-op (returns immediately).
- **Live deployments:** confirm via engine logs on startup:
  `portfolio_reconciliation: starting loop (interval=3600.0s)`
- **Discrepancy alerts:** look for WARNING-level log:
  `portfolio_reconciliation: discrepancies detected`

Post-deploy verification:

- [ ] Engine logs contain `portfolio_reconciliation: starting loop` on startup
- [ ] After first interval elapses, logs show either `clean` or `discrepancies detected`
- [ ] If `reconciliation_snapshots` table exists in Supabase, verify rows are inserted
- [ ] No false-positive phantom orders from partially-filled orders still in transit

### 5.7 Sentry Error Tracking (Engine)

The engine initialises Sentry during lifespan startup (`src/telemetry.py:init_sentry`).
It is **opt-in**: no `SENTRY_DSN` env var → no SDK calls, no overhead.

| Env Var                        | Required | Default         | Notes                                        |
| ------------------------------ | -------- | --------------- | -------------------------------------------- |
| `SENTRY_DSN`                   | No       | _(empty)_       | Set to enable; leave blank to disable        |
| `SENTRY_ENVIRONMENT`           | No       | `RAILWAY_ENVIRONMENT` fallback | e.g. `production`, `staging` |
| `SENTRY_TRACES_SAMPLE_RATE`    | No       | `0.1`           | 0.0–1.0; keep low in production              |

Post-deploy verification (only when `SENTRY_DSN` is set):

- [ ] Engine logs contain `Sentry initialised (env=..., sample_rate=...)` on startup
- [ ] Trigger a test error (e.g. invalid order payload) and verify it appears in Sentry dashboard
- [ ] Confirm `send_default_pii=False` — no user emails/IPs in events

### 5.8 CI Environment Prerequisites

The following secrets/env vars must be configured in GitHub repo settings for
CI workflows to pass. Missing values cause workflow failures that are **not code bugs**.

| Secret / Variable              | Used By                        | Notes                                     |
| ------------------------------ | ------------------------------ | ----------------------------------------- |
| `VERCEL_PREVIEW_SMOKE_URL`     | Synthetic Proxy Smoke workflow | Vercel preview URL for smoke tests        |
| `VERCEL_TOKEN`                 | Vercel deploy workflows        | Vercel API token                          |
| `SENTRY_DSN`                   | Engine (Railway)               | Optional; omit to disable error tracking  |

---

## 6. Rollback Procedures

**Rule:** Rollback first, investigate second. Restore traffic to a known-good state before debugging.

### 6.1 Web (Vercel) Rollback

**Via Dashboard:**

1. Go to Vercel Dashboard → Deployments
2. Find the last `READY` deployment before the broken one
3. Click "…" → "Promote to Production"

**Via CLI:**

```bash
# List recent deployments
vercel ls --prod

# Rollback to a specific deployment
vercel rollback <deployment-id>
```

**Estimated time:** < 1 minute (instant promotion, no rebuild).

### 6.2 Engine (Railway) Rollback

**Via Dashboard:**

1. Go to Railway Dashboard → `sentinel-engine` → Deployments
2. Click the previous healthy deployment → "Redeploy"

**Via CLI:**

```bash
# List recent deployments for the engine service
railway status --service sentinel-engine

# Redeploy previous version
railway redeploy --service sentinel-engine --deployment <deployment-id>
```

**Estimated time:** ~2–3 minutes (container restart, health check at `/health` with 120s timeout).

### 6.3 Agents (Railway) Rollback

**Via Dashboard:**

1. Go to Railway Dashboard → `sentinel-agents` → Deployments
2. Click the previous healthy deployment → "Redeploy"

**Via CLI:**

```bash
# List recent deployments for the agents service
railway status --service sentinel-agents

# Redeploy previous version
railway redeploy --service sentinel-agents --deployment <deployment-id>
```

**Estimated time:** ~2–3 minutes (container restart, health check at `/health` with 60s timeout).

### 6.4 Config / Environment Variable Rollback

If the failure is caused by environment variable changes:

1. Restore previous env values in the Vercel / Railway dashboard
2. Trigger a redeploy (env changes require redeployment)
3. Re-run smoke tests from §5.1

### 6.5 Full Rollback (All Services)

When a deploy touched all three services and the root cause is unclear:

```bash
# 1. Rollback web immediately (stops user-facing errors)
vercel rollback <last-good-web-deployment-id>

# 2. Rollback engine
railway redeploy --service sentinel-engine --deployment <last-good-engine-id>

# 3. Rollback agents
railway redeploy --service sentinel-agents --deployment <last-good-agents-id>

# 4. Verify all health probes
curl -s https://<production-url>/api/engine/health
curl -s https://<production-url>/api/agents/health
curl -s https://<production-url>/api/settings/status
```

### 6.6 Post-Rollback Verification

- [ ] All §5.1 smoke tests pass on the rolled-back version
- [ ] No active SEV-1 alerts
- [ ] Communicate rollback status in `#sentinel-incidents`

---

## 7. Incident Escalation (Deploy Failure)

If a deploy fails and rollback does not restore service:

1. **Declare an incident** in `#sentinel-incidents`
2. **Follow the escalation matrix** from [slo-dashboard-spec.md](slo-dashboard-spec.md) §4:
   - SEV-1 (trading impaired): PagerDuty → on-call → 15 min ack → engineering lead at 30 min → CTO at 1 hr
   - SEV-2 (degraded performance): Slack → on-call at 30 min → engineering lead at 2 hr
3. **Use correlation IDs** from [correlation-id-flow.md](correlation-id-flow.md) to trace the failure across services
4. **Check Railway logs** for the affected backend service
5. **Check Vercel function logs** for proxy errors
6. **Document** in post-mortem (SEV-1) or weekly review (SEV-2)

---

## 8. Post-Release Cleanup

Only after production is verified stable for ≥ 30 minutes:

- [ ] Remove deprecated Vercel env vars (`NEXT_PUBLIC_ENGINE_URL`, `NEXT_PUBLIC_ENGINE_API_KEY`, `NEXT_PUBLIC_AGENTS_URL`)
- [ ] Decommission stale Railway services
- [ ] Verify removal doesn't break anything (redeploy and re-check)
- [ ] Update `docs/ai/state/project-state.md` with release outcome

---

## Change Log

| Date       | Author  | Change                                                                                                                                                            |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-20 | Codex   | Initial release checklist with local validation, code review, deploy order, smoke tests, log verification, and basic rollback trigger.                            |
| 2026-07-19 | Copilot | T-F03: Added SLO-based go/no-go gate (§3), per-service rollback commands (§6), test evidence requirements (§1), post-deploy SLO validation (§5), escalation (§7). |
