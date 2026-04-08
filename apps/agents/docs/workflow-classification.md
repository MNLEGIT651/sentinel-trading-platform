# Agent Workflow Classification — T-E01

_Created: 2026-07-18_

Purpose: classify all agent workflows as **user-facing** or **internal operations** and
assign investment priority so the team focuses on product-critical work first.

---

## Classification Table

| #   | Workflow / Agent             | Type     | Priority              | Status      | Notes                                                                                                                                             |
| --- | ---------------------------- | -------- | --------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Market Sentinel**          | User     | **P0 — Critical**     | Implemented | Core market-monitoring loop. Feeds real-time alerts and regime detection to the dashboard. Runs every 5 min during market hours.                  |
| 2   | **Strategy Analyst**         | User     | **P0 — Critical**     | Implemented | Generates trade signals and conviction-ranked recommendations that users act on. Runs every 15 min during market hours.                           |
| 3   | **Risk Monitor**             | User     | **P0 — Critical**     | Implemented | Capital-protection guardian. Enforces drawdown circuit breakers, concentration limits, and daily loss caps. Fastest cycle (1 min). Visible in UI. |
| 4   | **Research Analyst**         | User     | **P1 — Important**    | Implemented | On-demand deep-dive technical analysis (support/resistance, momentum, volume). Directly serves the Advisor/Research UI.                           |
| 5   | **Execution Monitor**        | User     | **P1 — Important**    | Implemented | Executes approved trades and reports fill quality. Users see order status, slippage, and execution anomalies. Triggered by risk approval.         |
| 6   | **Recommendation Lifecycle** | User     | **P1 — Important**    | Implemented | Durable workflow: risk check → auto-execution policy → order submit → fill confirm. Powers the recommendation-to-fill pipeline visible to users.  |
| 7   | **Incident Monitor**         | Internal | **P1 — Important**    | Implemented | Auto-downgrades autonomy on consecutive failures. Safety-critical module that protects users from runaway auto-execution.                         |
| 8   | **Auto-Execution Policy**    | Internal | **P1 — Important**    | Implemented | Seven-check validation framework for autonomous trade execution. Directly gates whether trades execute without operator intervention.             |
| 9   | **Agent Cycle**              | Internal | **P2 — Nice-to-have** | Implemented | Durable orchestration wrapper that tracks each cycle as a job. Useful for observability but not directly user-facing.                             |
| 10  | **Workflow Manager**         | Internal | **P2 — Nice-to-have** | Retired     | Removed from active runtime to reduce non-product agent surface area and contract drift.                                                          |
| 11  | **Workflow Runner / Worker** | Internal | **P2 — Nice-to-have** | Implemented | Durable execution engine (polling, retries, timeouts, distributed locks). Essential infrastructure but not user-facing.                           |
| 12  | **Scheduler**                | Internal | **P2 — Nice-to-have** | Implemented | Market-hours cron scheduler (NYSE 09:30–15:59 ET, DST-correct). Infrastructure plumbing.                                                          |
| 13  | **PR Manager**               | Internal | **P3 — Deprioritize** | Retired     | Removed from active runtime; CI and branch protection remain the canonical dev-process controls.                                                  |

---

## Classification Criteria

### User-Facing

A workflow is **user-facing** if it:

- Produces data, alerts, or recommendations shown in the dashboard UI
- Handles a user-initiated action (research request, order placement)
- Its failure directly degrades the user experience or trading capability

### Internal Operations

A workflow is **internal operations** if it:

- Supports development processes (CI/CD, code review, PR management)
- Provides system-level orchestration or observability
- Could be removed without any visible change to the end-user product

---

## Priority Definitions

| Priority              | Meaning                                                     | Investment Guidance                                                                        |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **P0 — Critical**     | Core product loop. Must be reliable, tested, and monitored. | Invest heavily. Harden error handling, add integration tests, build operational dashboards |
| **P1 — Important**    | Directly supports user-facing flows or critical safety.     | Invest moderately. Ensure correctness and observability.                                   |
| **P2 — Nice-to-have** | Infrastructure or operational tooling.                      | Maintain current state. Fix bugs as encountered but do not proactively invest.             |
| **P3 — Deprioritize** | Development tooling unrelated to the product.               | Defer indefinitely. Do not invest until all P0–P1 work is complete.                        |

---

## Recommendations

### Invest Now (P0 + P1)

1. **Market Sentinel, Strategy Analyst, Risk Monitor** — These three form the core trading cycle. Harden their error paths, add end-to-end integration tests, and build health dashboards (aligns with T-E02 Advisor reliability pass and Phase D risk work).

2. **Research Analyst** — Key differentiator for the Advisor UI. Improve response quality and add timeout/retry resilience (aligns with T-E02).

3. **Execution Monitor + Recommendation Lifecycle** — The order execution pipeline must be bulletproof. Expand fill-confirmation edge cases and slippage alerting.

4. **Incident Monitor + Auto-Execution Policy** — These safety modules gate autonomous trading. Ensure policy evaluation is deterministic and fully auditable.

### Maintain (P2)

5. **Agent Cycle, Workflow Runner/Worker, Scheduler** — Infrastructure building blocks that are already stable. Keep them working but don't proactively enhance unless P0/P1 work requires it.

### Defer (P3)

6. **PR Manager** — now retired. Developer-experience checks should stay in GitHub Actions and repository rulesets.

---

## Trading Cycle Priority Order (Runtime)

For reference, the runtime execution priority:

1. `risk_monitor` — highest (capital protection)
2. `execution_monitor` — high (active trades)
3. `market_sentinel` — medium (market awareness)
4. `strategy_analyst` — medium (signal generation)
5. `research` — low (on-demand analysis)

This runtime ordering reflects the active product scope: only trading-relevant agents are part of the runtime contract.

---

## Change Log

| Date       | Author  | Change                                                                                                                                 |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-18 | Copilot | Initial classification (T-E01). Classified 7 agents, 2 durable workflows, and 4 infrastructure modules. Deprioritized PR Manager (P3). |
| 2026-04-08 | Codex   | Retired PR Manager and Workflow Manager from runtime contracts and workflow files; kept classification history for auditability.       |
