# Critical-Path SLO Dashboard Spec

_Created: 2026-07-19 — Ticket T-F02_

Operational service-level objectives for the Sentinel Trading Platform. Defines latency targets, error budgets, alert thresholds, and escalation paths so the team can implement monitoring with standard observability tools (Datadog, Grafana, Railway metrics, Vercel analytics, or equivalent).

---

## 1. Service-Level Objectives

### 1.1 Latency — p95 Targets

Measured at the **web proxy boundary** (`service-proxy.ts` → upstream response received). All values derived from configured timeouts in `service-config.ts` — targets are set at ≤ 50% of timeout to leave headroom for retries.

| Critical Path                   | Endpoint Pattern                   | Timeout (ms) | p95 Target (ms) | p99 Budget (ms) | Measurement                                                    |
| ------------------------------- | ---------------------------------- | ------------ | --------------- | --------------- | -------------------------------------------------------------- |
| **Market data — quotes**        | `/api/v1/data/quotes`              | 15,000       | ≤ 3,000         | ≤ 7,000         | Proxy structured log `durationMs` where `upstreamPath` matches |
| **Market data — bars**          | `/api/v1/data/bars/*`              | 12,000       | ≤ 2,500         | ≤ 6,000         | Same                                                           |
| **Strategy scan**               | `/api/v1/strategies/scan`          | 70,000       | ≤ 15,000        | ≤ 35,000        | Same                                                           |
| **Backtest execution**          | `/api/v1/backtest/run`             | 45,000       | ≤ 10,000        | ≤ 25,000        | Same                                                           |
| **Order submission**            | Engine POST mutations              | 15,000       | ≤ 2,000         | ≤ 5,000         | Proxy log `method=POST` + relevant path                        |
| **Order history**               | `/api/v1/portfolio/orders/history` | 10,000       | ≤ 2,000         | ≤ 5,000         | Same                                                           |
| **Agent workflows (GET)**       | `/api/agents/*` (GET)              | 6,000        | ≤ 1,500         | ≤ 3,000         | Proxy log `service=agents`                                     |
| **Agent workflows (mutations)** | `/api/agents/*` (POST)             | 8,000        | ≤ 2,000         | ≤ 4,000         | Same                                                           |
| **Health probes**               | `/health` (engine + agents)        | 4,000        | ≤ 500           | ≤ 1,500         | Synthetic monitor or proxy log                                 |

### 1.2 Availability

| Service          | Target | Window          | Measurement                                   |
| ---------------- | ------ | --------------- | --------------------------------------------- |
| Web (Vercel)     | 99.9%  | Rolling 30 days | Vercel analytics or synthetic uptime monitor  |
| Engine (Railway) | 99.5%  | Rolling 30 days | `/health` probe success rate (1-min interval) |
| Agents (Railway) | 99.5%  | Rolling 30 days | `/health` probe success rate (1-min interval) |

### 1.3 Freshness (Stale-Data SLO)

| Data Type                | Staleness Threshold       | Measurement                                                                           |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------------- |
| Quote data               | > 60 s since last update  | Client-side `DataProvenance` component; server-side: engine `/health` `last_quote_at` |
| Bar / chart data         | > 120 s since last update | Same pattern                                                                          |
| Market Sentinel alerts   | > 10 min since last cycle | Agent `market_sentinel` job completion timestamp vs current time                      |
| Strategy Analyst signals | > 30 min since last cycle | Agent `strategy_analyst` job completion timestamp vs current time                     |
| Risk Monitor state       | > 2 min since last cycle  | Agent `risk_monitor` job completion timestamp (P0 — fastest cycle)                    |

---

## 2. Error Budgets

Error budgets define how much failure is acceptable before the team must stop feature work and prioritize reliability.

| Metric                    | Budget (per 30-day window)           | Burn-Rate Alert                     | Calculation                                                                                     |
| ------------------------- | ------------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Auth error rate**       | ≤ 1% of total authenticated requests | Alert if 5-min rate > 5%            | `count(status=401 OR status=403) / count(total proxy requests)` from structured proxy logs      |
| **Order failure rate**    | ≤ 0.5% of order submissions          | Alert if 5-min rate > 2%            | `count(order mutations with status >= 400) / count(total order mutations)`                      |
| **Proxy 5xx rate**        | ≤ 1% of all proxy requests           | Alert if 5-min rate > 3%            | `count(status >= 500) / count(total)` from proxy logs                                           |
| **Timeout rate**          | ≤ 2% of all proxy requests           | Alert if 5-min rate > 5%            | `count(code=timeout) / count(total)` from proxy error logs                                      |
| **Stale-data rate**       | ≤ 5% of market-hours minutes         | Alert if 3 consecutive stale checks | Minutes where quote staleness > 60 s / total market-hours minutes                               |
| **Agent P0 failure rate** | ≤ 1% of scheduled cycles             | Alert if 2 consecutive failures     | Failed `market_sentinel`, `strategy_analyst`, or `risk_monitor` cycles / total scheduled cycles |

### Budget Exhaustion Policy

| Budget Consumed  | Action                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| < 50%            | Normal operations. Ship features.                                      |
| 50–75%           | Investigate root cause. Add to weekly review agenda.                   |
| 75–99%           | Freeze non-critical deploys. Dedicate engineering time to reliability. |
| 100% (exhausted) | Full feature freeze. All hands on reliability until budget recovers.   |

---

## 3. Alert Definitions

All alerts fire based on structured JSON logs emitted by `service-proxy.ts` (fields: `scope`, `level`, `action`, `service`, `code`, `status`, `durationMs`, `correlationId`). Use `correlationId` for cross-service tracing per `docs/runbooks/correlation-id-flow.md`.

### 3.1 Latency Alerts

| Alert Name              | Condition                                           | Severity | Channel                  |
| ----------------------- | --------------------------------------------------- | -------- | ------------------------ |
| `market-data-slow`      | p95 quote latency > 3,000 ms over 5-min window      | Warning  | Slack `#sentinel-alerts` |
| `market-data-critical`  | p95 quote latency > 7,000 ms over 5-min window      | Critical | Slack + PagerDuty        |
| `order-submit-slow`     | p95 order POST latency > 2,000 ms over 5-min window | Warning  | Slack `#sentinel-alerts` |
| `order-submit-critical` | p95 order POST latency > 5,000 ms over 5-min window | Critical | Slack + PagerDuty        |
| `backtest-slow`         | p95 backtest latency > 10,000 ms over 5-min window  | Warning  | Slack `#sentinel-alerts` |
| `strategy-scan-slow`    | p95 scan latency > 15,000 ms over 5-min window      | Warning  | Slack `#sentinel-alerts` |

### 3.2 Error-Rate Alerts

| Alert Name                  | Condition                                 | Severity | Channel                    |
| --------------------------- | ----------------------------------------- | -------- | -------------------------- |
| `auth-error-spike`          | Auth error rate > 5% over 5-min window    | Critical | Slack + PagerDuty          |
| `order-failure-spike`       | Order failure rate > 2% over 5-min window | Critical | Slack + PagerDuty          |
| `proxy-5xx-spike`           | 5xx rate > 3% over 5-min window           | Critical | Slack + PagerDuty          |
| `timeout-spike`             | Timeout rate > 5% over 5-min window       | Warning  | Slack `#sentinel-alerts`   |
| `csrf-rejection-spike`      | CSRF 403 rate > 10 req/min                | Warning  | Slack `#sentinel-security` |
| `mutation-rate-limit-spike` | 429 responses > 5/min (20 req/min limit)  | Info     | Slack `#sentinel-alerts`   |

### 3.3 Freshness Alerts

| Alert Name               | Condition                                            | Severity | Channel                  |
| ------------------------ | ---------------------------------------------------- | -------- | ------------------------ |
| `stale-quotes`           | No quote update > 60 s during market hours           | Warning  | Slack `#sentinel-alerts` |
| `stale-quotes-critical`  | No quote update > 180 s during market hours          | Critical | Slack + PagerDuty        |
| `risk-monitor-stale`     | Risk Monitor cycle gap > 3 min (normal: 1 min)       | Critical | Slack + PagerDuty        |
| `market-sentinel-stale`  | Market Sentinel cycle gap > 15 min (normal: 5 min)   | Warning  | Slack `#sentinel-alerts` |
| `strategy-analyst-stale` | Strategy Analyst cycle gap > 45 min (normal: 15 min) | Warning  | Slack `#sentinel-alerts` |

### 3.4 Infrastructure Alerts

| Alert Name               | Condition                              | Severity | Channel           |
| ------------------------ | -------------------------------------- | -------- | ----------------- |
| `engine-health-down`     | 3 consecutive `/health` probe failures | Critical | Slack + PagerDuty |
| `agents-health-down`     | 3 consecutive `/health` probe failures | Critical | Slack + PagerDuty |
| `service-not-configured` | Proxy log `code=not_configured`        | Critical | Slack + PagerDuty |

---

## 4. Escalation Matrix

### Severity Levels

| Severity             | Definition                                                                                                 | Response Time      | Resolution Target  |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------ | ------------------ |
| **SEV-1 (Critical)** | Trading capability impaired — users cannot submit orders, market data unavailable, or risk monitor offline | 15 min acknowledge | 1 hour mitigation  |
| **SEV-2 (Warning)**  | Degraded performance or partial feature loss — elevated latency, stale data, non-critical agent down       | 30 min acknowledge | 4 hours mitigation |
| **SEV-3 (Info)**     | Anomaly detected — rate limit hits, minor error spikes, non-market-hours issues                            | Next business day  | 1 week resolution  |

### Escalation Path

```
Alert fires
  │
  ├─ Critical (SEV-1)
  │   ├─ 0 min:  PagerDuty → on-call engineer
  │   ├─ 15 min: If no ack → escalate to engineering lead
  │   ├─ 30 min: If no mitigation → escalate to CTO
  │   └─ Post-incident: Blameless post-mortem within 48 hours
  │
  ├─ Warning (SEV-2)
  │   ├─ 0 min:  Slack #sentinel-alerts
  │   ├─ 30 min: If no ack → PagerDuty on-call
  │   ├─ 2 hr:   If no mitigation → escalate to engineering lead
  │   └─ Post-incident: Add to weekly reliability review
  │
  └─ Info (SEV-3)
      ├─ 0 min:  Slack channel only
      └─ Review in next daily standup
```

### Incident Response Checklist

1. **Acknowledge** the alert in PagerDuty / Slack
2. **Identify** the affected service using `correlationId` tracing (see `correlation-id-flow.md`)
3. **Check** Railway logs for the affected service (`engine` or `agents`)
4. **Check** Vercel function logs for proxy errors
5. **Mitigate** — restart Railway service, rollback deploy, or toggle feature flag
6. **Communicate** status in `#sentinel-incidents` Slack channel
7. **Resolve** and update alert status
8. **Document** in post-mortem (SEV-1) or weekly review notes (SEV-2)

---

## 5. Dashboard Layout Recommendation

A single operational dashboard with four panels, implementable in Grafana, Datadog, or any tool that can query structured JSON logs.

### Panel 1: Latency Overview (top row)

- **Type:** Time-series line chart
- **Metrics:** p50, p95, p99 latency per critical path
- **Source:** Proxy structured logs → `durationMs` grouped by `upstreamPath`
- **Overlay:** Horizontal threshold lines at p95 targets from §1.1
- **Filters:** Service selector (engine / agents), time range

### Panel 2: Error Rates (second row, left)

- **Type:** Stacked area chart + single-stat panels
- **Metrics:** Auth error rate, order failure rate, 5xx rate, timeout rate
- **Source:** Proxy structured logs → `status` and `code` fields
- **Color coding:** Green (< 50% budget), yellow (50–75%), red (> 75%)

### Panel 3: Freshness & Agent Health (second row, right)

- **Type:** Status grid / heatmap
- **Metrics:** Per-agent last-cycle timestamp, quote staleness, bar staleness
- **Source:** Agent job completion events, engine health endpoint
- **Display:** Green = on-schedule, yellow = approaching threshold, red = stale

### Panel 4: Error Budget Burn (bottom row)

- **Type:** Gauge + burn-rate line chart
- **Metrics:** Remaining error budget per SLO (30-day rolling)
- **Source:** Aggregated from panels 1–3
- **Alerts:** Visual indicator when budget consumption > 75%

### Supplementary Views

| View                    | Purpose                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Request trace**       | Drill-down from any log entry via `correlationId` → see full request path across web proxy → engine/agents |
| **Deployment overlay**  | Vertical annotation lines on all charts at deploy timestamps (Vercel + Railway) to correlate regressions   |
| **Market hours filter** | Toggle to show only NYSE market hours (09:30–15:59 ET) where SLOs are most meaningful                      |

---

## 6. Implementation Notes

### Data Sources

All SLO metrics derive from data already emitted by the platform:

| Source                                  | Format                    | Key Fields                                                                                              |
| --------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Service proxy logs (`service-proxy.ts`) | Structured JSON to stdout | `scope`, `action`, `service`, `method`, `upstreamPath`, `status`, `durationMs`, `code`, `correlationId` |
| Engine proxy auth logs (`route.ts`)     | Structured JSON to stderr | `scope=engine-proxy`, `action=auth_failed`, `correlationId`                                             |
| Engine `/health` endpoint               | JSON response             | Service status, version                                                                                 |
| Agent job completion events             | Structured JSON logs      | `event=workflow.completed`, `correlationId`, timestamps                                                 |
| CSRF rejections (`csrf.ts`)             | HTTP 403 responses        | `error=csrf_rejected`                                                                                   |
| Mutation rate limiter (`csrf.ts`)       | HTTP 429 responses        | Rate limit headers                                                                                      |

### Log Query Examples

```
# p95 latency for market data quotes (last 5 min)
scope:"service-proxy" action:"success" upstreamPath:"/api/v1/data/quotes"
  | stats percentile(durationMs, 95) as p95

# Order failure rate (last 5 min)
scope:"service-proxy" method:"POST" upstreamPath:"/api/v1/*order*"
  | stats count(status >= 400) / count(*) as failure_rate

# Auth error rate
scope:"service-proxy" (status:401 OR status:403)
  | stats count / total_requests as auth_error_rate

# Stale Risk Monitor detection
event:"workflow.completed" agent:"risk_monitor"
  | stats max(timestamp) as last_run
  | where now() - last_run > 3m
```

### Relationship to Existing Infrastructure

- **Correlation IDs** (T-F01): Every proxy log includes `correlationId` for cross-service drill-down
- **Agent priorities** (T-E01): P0 agents (Market Sentinel, Strategy Analyst, Risk Monitor) have tighter SLOs
- **Retry behavior**: GET/HEAD requests retry once (2 attempts); mutations never retry — error budgets account for this
- **Rate limits**: Mutation rate limiter at 20 req/min per user; CSRF validation on all mutations

---

## Change Log

| Date       | Author  | Change                                                                                                                                |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-19 | Copilot | Initial SLO dashboard spec (T-F02). Defined p95 latency targets, error budgets, alert matrix, escalation paths, and dashboard layout. |
