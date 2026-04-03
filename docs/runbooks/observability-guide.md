# Sentinel Platform — Observability Guide

> Living document — update when adding new services, endpoints, or logging patterns.
> Created as part of AUD-08. See also: `correlation-id-flow.md`, `../slos.md`.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Current Observability State](#current-observability-state)
3. [Log Formats & Locations](#log-formats--locations)
4. [Health Check Inventory](#health-check-inventory)
5. [Key Metrics per Service](#key-metrics-per-service)
6. [Correlation ID Tracing](#correlation-id-tracing)
7. [OpenTelemetry Integration](#opentelemetry-integration)
8. [Recommended Monitoring Stack](#recommended-monitoring-stack)
9. [Alert Rules](#alert-rules)
10. [Runbook: Debugging with Logs](#runbook-debugging-with-logs)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Client (Browser)                                            │
└──────────┬───────────────────────────────────────────────────┘
           │ HTTPS
┌──────────▼───────────────────────────────────────────────────┐
│  Web (Next.js on Vercel)                                     │
│  • Service proxy with structured JSON logs                   │
│  • Correlation ID generation & forwarding                    │
│  • Rate limiter (in-memory sliding window)                   │
│  • CSRF validation                                           │
│  • OpenTelemetry SDK (opt-in)                                │
│  • Sentry integration (opt-in)                               │
└──────┬────────────────────────────┬──────────────────────────┘
       │ x-correlation-id           │ x-correlation-id
┌──────▼──────────────┐   ┌────────▼─────────────────────────┐
│  Engine (FastAPI     │   │  Agents (Express/TypeScript       │
│  on Railway)         │   │  on Railway)                      │
│  • JSON structured   │   │  • JSON structured logger         │
│    logging           │   │  • AsyncLocalStorage correlation   │
│  • CorrelationID     │   │  • Workflow audit logger           │
│    middleware         │   │  • CircuitBreaker + retry          │
│  • Gunicorn access   │   │  • DB-persisted cycle history      │
│    logs w/ timing    │   │  • OpenTelemetry SDK (opt-in)      │
│  • OpenTelemetry     │   └──────────────────────────────────┘
│    SDK (opt-in)      │
└──────────────────────┘
```

---

## Current Observability State

### Web Service (`apps/web`)

| Capability         | Status          | Details                                                            |
| ------------------ | --------------- | ------------------------------------------------------------------ |
| Structured logging | ✅ Partial      | Service proxy emits JSON; route handlers use plain `console.error` |
| Request timing     | ✅ Proxy only   | `durationMs` tracked per proxy request including retries           |
| Correlation IDs    | ✅ Full         | Generated/forwarded across all proxy boundaries                    |
| Health endpoint    | ✅              | `GET /api/health` — checks engine + agents connectivity            |
| Rate limiting      | ✅              | 3-tier: 120/min proxy, 60/min API, 20/min mutations                |
| CSRF protection    | ✅              | Origin/Referer/X-Requested-With validation                         |
| OpenTelemetry      | ⚠️ Opt-in       | `OTEL_ENABLED=true` — ConsoleSpanExporter only                     |
| Sentry             | ⚠️ Unused       | `initSentry()` defined but not called from instrumentation hook    |
| Error tracking     | ⚠️ Inconsistent | Proxy: structured JSON; routes: unstructured console.error         |

### Engine Service (`apps/engine`)

| Capability         | Status      | Details                                                                      |
| ------------------ | ----------- | ---------------------------------------------------------------------------- |
| Structured logging | ✅ Full     | Custom `JSONFormatter` — all logs are JSON with timestamp, level, request_id |
| Request timing     | ✅ Gunicorn | Access log format includes `%(D)s` (microseconds)                            |
| Correlation IDs    | ✅ Full     | `CorrelationIDMiddleware` + `CorrelationIDFilter` on all log records         |
| Health endpoint    | ✅          | `GET /health` — checks Polygon, Alpaca, Supabase                             |
| Rate limiting      | ✅          | Configurable via `RATE_LIMIT_PER_MINUTE` (default: 100)                      |
| API key auth       | ✅          | HMAC-safe Bearer token, excludes `/health`, `/docs`                          |
| OpenTelemetry      | ⚠️ Opt-in   | `OTEL_ENABLED=true` — OTLP or Console exporter                               |
| Error handling     | ✅          | Custom exception hierarchy with standardized codes                           |

### Agents Service (`apps/agents`)

| Capability         | Status         | Details                                                          |
| ------------------ | -------------- | ---------------------------------------------------------------- |
| Structured logging | ✅ Full        | Custom JSON logger: `{level, event, ts, correlationId, ...meta}` |
| Request timing     | ✅ Agent-level | `durationMs` tracked per agent execution cycle                   |
| Correlation IDs    | ✅ Full        | `AsyncLocalStorage`-based, auto-injected into all log lines      |
| Health endpoint    | ✅             | `GET /health` — checks engine, Supabase, Anthropic config        |
| Status endpoint    | ✅             | `GET /status` — agent states, cycle count, next cycle time       |
| Workflow audit     | ✅             | `AuditLogger` persists to local JSON + Supabase `workflow_runs`  |
| Circuit breaker    | ✅             | Prevents cascade failures to engine                              |
| OpenTelemetry      | ⚠️ Opt-in      | `OTEL_ENABLED=true` — auto-instruments Express + Node.js         |
| DB persistence     | ✅             | `cycle_history`, `agent_logs`, `workflow_jobs`, `workflow_runs`  |

---

## Log Formats & Locations

### Web — Service Proxy (structured)

**Source:** `apps/web/src/lib/server/service-proxy.ts`

```json
{
  "scope": "service-proxy",
  "level": "info",
  "action": "success",
  "service": "engine",
  "method": "POST",
  "upstreamPath": "/api/v1/strategies/scan",
  "upstreamStatus": 200,
  "durationMs": 12450,
  "attempt": 1,
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error variant** adds: `message`, `code`, `status`, `upstreamStatus`, `retryable`.

### Web — Route Handlers (unstructured)

Most route handlers use a minimal pattern:

```
console.error('experiments.GET', Error: Failed to fetch)
```

**Gap:** No structured fields, no correlation ID, no timing.

### Engine — JSON Formatter

**Source:** `apps/engine/src/logging_config.py`

```json
{
  "timestamp": "2026-01-15T14:32:00.123456+00:00",
  "level": "INFO",
  "logger": "src.api.routes.strategies",
  "message": "Signal scan completed",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "trace_id": "abc123def456...",
  "span_id": "789xyz..."
}
```

### Engine — Gunicorn Access Log

```
Format: %(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s
```

`%(D)s` = response time in microseconds.

### Agents — Structured Logger

**Source:** `apps/agents/src/logger.ts`

```json
{
  "level": "info",
  "event": "orchestrator.cycle.complete",
  "ts": "2026-01-15T14:32:00.123Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "cycleCount": 42,
  "successCount": 3,
  "totalCount": 3
}
```

**Output routing:** `info`/`debug` → stdout; `warn`/`error` → stderr.

### Agents — Audit Logger (persistent)

**Source:** `apps/agents/src/wat/audit-logger.ts`

- **Local:** JSON files to `.tmp/runs/{timestamp}-cycle-{number}-{role}.json`
- **Remote:** Supabase `workflow_runs` table (async, non-blocking)
- **Captures:** tool calls, LLM transcripts, workflow updates, duration, success/failure

---

## Health Check Inventory

All health endpoints return a consistent JSON structure with these common fields:

| Field          | Type                 | Description                        |
| -------------- | -------------------- | ---------------------------------- |
| `status`       | `"ok" \| "degraded"` | Overall service health             |
| `service`      | `string`             | Service identifier                 |
| `timestamp`    | `string` (ISO 8601)  | When the check was performed       |
| `dependencies` | `object`             | Per-dependency connectivity status |

### `GET /api/health` — Web (Next.js)

**Public:** Yes (no auth required)
**HTTP Status:** Always 200 (service itself is healthy)

```json
{
  "status": "ok",
  "service": "sentinel-web",
  "timestamp": "2026-01-15T14:32:00.123Z",
  "dependencies": {
    "engine": "connected",
    "agents": "connected"
  }
}
```

Dependency values: `"connected"` | `"disconnected"` | `"not_configured"`

### `GET /health` — Engine (FastAPI)

**Public:** Yes (excluded from API key middleware)
**HTTP Status:** 200 (healthy) or 503 (degraded)

```json
{
  "status": "ok",
  "service": "sentinel-engine",
  "timestamp": "2026-01-15T14:32:00.123456+00:00",
  "dependencies": {
    "polygon": true,
    "alpaca": true,
    "supabase": true
  }
}
```

Dependency values: `true` (configured/reachable) | `false` (missing/unreachable)

### `GET /health` — Agents (Express)

**Public:** Yes (no auth required)
**HTTP Status:** 200 (healthy) or 503 (degraded)

```json
{
  "status": "ok",
  "service": "sentinel-agents",
  "timestamp": "2026-01-15T14:32:00.123Z",
  "uptime": 3600,
  "cycleCount": 42,
  "halted": false,
  "dependencies": {
    "engine": "connected",
    "anthropic": "configured",
    "supabase": "connected"
  }
}
```

Dependency values: `"connected"` | `"disconnected"` | `"configured"` | `"not_configured"`

### `GET /status` — Agents (Express)

**Auth required:** Yes
**Purpose:** Operational state for dashboards

```json
{
  "agents": {
    "market_sentinel": { "status": "idle", "lastRun": "2026-01-15T14:30:00Z" },
    "strategy_analyst": { "status": "running", "lastRun": null },
    "risk_monitor": { "status": "idle", "lastRun": "2026-01-15T14:31:00Z" }
  },
  "cycleCount": 42,
  "halted": false,
  "isRunning": true,
  "nextCycleAt": "2026-01-15T14:45:00Z",
  "lastCycleAt": "2026-01-15T14:30:00Z"
}
```

### `GET /api/strategy-health` — Web (Next.js)

**Auth required:** Yes (+ rate limited 60 req/min)
**Purpose:** Strategy-level health scores

```json
{
  "snapshots": [{ "health_label": "momentum_breakout", "health_score": 0.85, "...": "..." }]
}
```

### Proxy Pass-Through Health Routes

| Web Path                 | Proxies To           |
| ------------------------ | -------------------- |
| `GET /api/engine/health` | Engine `GET /health` |
| `GET /api/agents/health` | Agents `GET /health` |
| `GET /api/agents/status` | Agents `GET /status` |

---

## Key Metrics per Service

### Web

| Metric              | Source                                    | How to Observe                                          |
| ------------------- | ----------------------------------------- | ------------------------------------------------------- |
| Proxy latency (p95) | `service-proxy.ts` → `durationMs`         | Parse JSON logs, bucket by `service` + `upstreamPath`   |
| Proxy error rate    | `service-proxy.ts` → `level: "error"`     | Count `action: "failure"` logs per minute               |
| Retry rate          | `service-proxy.ts` → `action: "retrying"` | Count retrying events; high rate = upstream instability |
| Rate limit triggers | `rate-limiter.ts` → HTTP 429 responses    | Count 429 status codes in access logs                   |
| Health check status | `/api/health` → `status` field            | Synthetic probe every 30s                               |

### Engine

| Metric                | Source                              | How to Observe                              |
| --------------------- | ----------------------------------- | ------------------------------------------- |
| Request latency       | Gunicorn `%(D)s` field              | Parse access logs, microseconds per request |
| Signal scan duration  | OTel span `strategy.scan`           | Trace exporter when `OTEL_ENABLED=true`     |
| Risk evaluation time  | OTel span `risk.assess`             | Trace exporter when `OTEL_ENABLED=true`     |
| Supabase connectivity | `/health` → `dependencies.supabase` | Synthetic probe                             |
| Error rate by route   | JSON logs → `level: "ERROR"`        | Group by `logger` field                     |
| Rate limit triggers   | `RateLimitMiddleware` → HTTP 429    | Count in access logs                        |

### Agents

| Metric                | Source                              | How to Observe                   |
| --------------------- | ----------------------------------- | -------------------------------- |
| Cycle completion rate | `orchestrator.cycle.complete` event | Success vs total ratio           |
| Agent execution time  | `agent.complete` → `durationMs`     | Per-agent histograms             |
| Agent failure rate    | `agent.failed` events               | Count per agent role             |
| Halt activations      | `orchestrator.halt` events          | Count per day (SLO target)       |
| Risk blocks           | `recommendation_events` table       | Filter `status = 'risk_blocked'` |
| Workflow job failures | `workflow_jobs` table               | Filter `status = 'failed'`       |
| Circuit breaker trips | `CircuitBreaker` state transitions  | Log events (when state changes)  |
| Token usage           | `agent.complete` → `outputTokens`   | Track LLM cost per cycle         |

---

## Correlation ID Tracing

See `docs/runbooks/correlation-id-flow.md` for full implementation details.

### Quick Reference

1. **Web** generates UUID via `crypto.randomUUID()` or accepts from client `x-correlation-id`
2. **Service proxy** forwards in `extraHeaders`, logs as `correlationId`
3. **Engine** extracts via `CorrelationIDMiddleware`, stores in `ContextVar`, adds to all log records as `request_id`
4. **Agents** extracts via Express middleware, stores in `AsyncLocalStorage`, adds to all log lines as `correlationId`

### Cross-Service Trace Query

To trace a request end-to-end, search for the correlation ID across all log streams:

```bash
# Web logs
grep '"correlationId":"<ID>"' web.log

# Engine logs
grep '"request_id":"<ID>"' engine.log

# Agents logs
grep '"correlationId":"<ID>"' agents.log
```

---

## OpenTelemetry Integration

All three services include OpenTelemetry SDKs. Activation is opt-in via environment variables.

### Environment Variables

| Variable                      | Default | Description                                             |
| ----------------------------- | ------- | ------------------------------------------------------- |
| `OTEL_ENABLED`                | `false` | Enable tracing (all services)                           |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | —       | OTLP collector endpoint (e.g., `http://localhost:4317`) |

### Service Names

| Service | `service.name`    |
| ------- | ----------------- |
| Web     | `sentinel-web`    |
| Engine  | `sentinel-engine` |
| Agents  | `sentinel-agents` |

### Current State

- **Without OTLP endpoint:** Traces export to console (development only)
- **With OTLP endpoint:** Traces sent via gRPC to an OTLP-compatible collector
- **Auto-instrumentation:** FastAPI (engine), Express + Node.js (agents), Next.js server (web)

### Custom Spans

| Service | Span Name               | Attributes                                          |
| ------- | ----------------------- | --------------------------------------------------- |
| Engine  | `strategy.scan`         | Strategy parameters                                 |
| Engine  | `risk.assess`           | Portfolio state                                     |
| Agents  | `orchestrator.runCycle` | `cycle.count`, `cycle.success_count`                |
| Agents  | Workflow steps          | `workflow.job_id`, `workflow.type`, `workflow.step` |

---

## Recommended Monitoring Stack

### Minimum Viable Observability (current capabilities)

```
Structured JSON logs (stdout/stderr)
  → Railway log drain / Vercel log drain
    → Log aggregator (Datadog, Grafana Loki, or CloudWatch)
      → Dashboard + alerts
```

**What works today without changes:**

1. All three services emit structured JSON to stdout/stderr
2. Railway and Vercel capture these as platform logs
3. Correlation IDs enable cross-service tracing in any log aggregator

### Recommended Production Stack

| Layer                    | Tool                         | Purpose                                         |
| ------------------------ | ---------------------------- | ----------------------------------------------- |
| **Log aggregation**      | Grafana Loki or Datadog Logs | Centralized log search with JSON parsing        |
| **Traces**               | Grafana Tempo or Jaeger      | Distributed trace visualization (OTLP receiver) |
| **Metrics**              | Prometheus + Grafana         | SLO dashboards, error budgets                   |
| **Error tracking**       | Sentry                       | Real-time error alerting with stack traces      |
| **Synthetic monitoring** | UptimeRobot or Checkly       | Health endpoint probes every 30s                |
| **Dashboards**           | Grafana                      | Unified view: logs, traces, metrics             |

### Setup Steps

1. **Enable OTel** — Set `OTEL_ENABLED=true` and `OTEL_EXPORTER_OTLP_ENDPOINT` on all services
2. **Connect Sentry** — Set `SENTRY_DSN` on web; call `initSentry()` from instrumentation hook
3. **Configure log drain** — Railway → Datadog/Loki; Vercel → same destination
4. **Deploy Grafana dashboards** — Import SLO definitions from `docs/slos.md`
5. **Set up synthetic probes** — Hit `/api/health`, `/health` (engine), `/health` (agents) every 30s

---

## Alert Rules

See `docs/slos.md` for the full SLO definitions and thresholds.

### Critical Alerts (immediate response required)

| Alert               | Condition                                           | Service | Action                                                        |
| ------------------- | --------------------------------------------------- | ------- | ------------------------------------------------------------- |
| **Service down**    | Health endpoint returns non-200 for > 2 min         | All     | Check Railway/Vercel deployment status                        |
| **Engine degraded** | `/health` returns `status: "degraded"` for > 5 min  | Engine  | Check Supabase connectivity, API keys                         |
| **Agents halted**   | `/health` returns `halted: true` unexpectedly       | Agents  | Investigate `orchestrator.halt` logs, check `system_controls` |
| **High error rate** | > 5% of proxy requests fail in 5 min window         | Web     | Check upstream service health, review proxy error logs        |
| **SLO breach**      | Any metric exceeds CRITICAL threshold (see slos.md) | All     | Follow SLO-specific runbook                                   |

### Warning Alerts (investigate during business hours)

| Alert                    | Condition                               | Service | Action                                   |
| ------------------------ | --------------------------------------- | ------- | ---------------------------------------- |
| **Retry spike**          | > 20 retry events/min in proxy logs     | Web     | Upstream service may be flapping         |
| **Circuit breaker open** | Circuit breaker trips to OPEN state     | Agents  | Engine may be overloaded                 |
| **High latency**         | p95 proxy `durationMs` > 10s for 15 min | Web     | Check engine load, DB query performance  |
| **Agent failure**        | Any agent fails 3+ consecutive cycles   | Agents  | Check `agent.failed` logs for root cause |
| **Token budget**         | Daily LLM token usage > threshold       | Agents  | Review agent prompts for efficiency      |
| **Rate limit surge**     | > 100 rate-limited requests/hour        | Web     | Possible abuse; review IP patterns       |

### Alert Implementation

**With Grafana/Loki:**

```yaml
# Example alert rule for high proxy error rate
groups:
  - name: sentinel-web
    rules:
      - alert: HighProxyErrorRate
        expr: |
          sum(rate({app="sentinel-web"} |= `"level":"error"` |= `"scope":"service-proxy"` [5m])) /
          sum(rate({app="sentinel-web"} |= `"scope":"service-proxy"` [5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'High proxy error rate (>5%)'
```

**With synthetic monitoring:**

```bash
# UptimeRobot / Checkly probe
curl -sf https://sentinel-web.vercel.app/api/health | jq -e '.status == "ok"'
curl -sf https://sentinel-engine.railway.app/health | jq -e '.status == "ok"'
curl -sf https://sentinel-agents.railway.app/health | jq -e '.status == "ok"'
```

---

## Runbook: Debugging with Logs

### Scenario: User reports slow page load

1. Get the correlation ID from the response header: `x-correlation-id`
2. Search web proxy logs: filter `scope: "service-proxy"` + `correlationId: "<ID>"`
3. Check `durationMs` — if high, the bottleneck is upstream
4. Search engine logs: filter `request_id: "<ID>"`
5. Check Gunicorn access log `%(D)s` for the matching request

### Scenario: Agent cycle fails

1. Check agents logs: filter `event: "agent.failed"` + `role: "<agent_name>"`
2. Get the `correlationId` from the failure log
3. If the agent called engine, search engine logs with that `request_id`
4. Check `workflow_jobs` table for `status = 'failed'` entries
5. Review `.tmp/runs/` audit files for the LLM transcript

### Scenario: Trading halt triggered unexpectedly

1. Search agents logs: filter `event: "orchestrator.halt"`
2. Check `reason` field in the log entry
3. Query `operator_actions` table for recent manual interventions
4. Query `system_controls` table for current `autonomy_mode`
5. If caused by incident monitor: check `incident-monitor.fallback.triggered` logs

---

## Known Gaps & Future Work

| Gap                                                 | Impact                                     | Recommended Fix                                     | Priority                               |
| --------------------------------------------------- | ------------------------------------------ | --------------------------------------------------- | -------------------------------------- |
| Web route handlers use unstructured `console.error` | Hard to query/filter in log aggregator     | Adopt structured logger (e.g., pino) for all routes | Medium                                 |
| Rate limit triggers not logged server-side          | Cannot monitor rate-limit abuse patterns   | Add structured log on 429 responses                 | Medium                                 |
| CSRF rejections not logged server-side              | Cannot detect CSRF attack patterns         | Add structured log on 403 CSRF responses            | Low                                    |
| Sentry integration wired but not activated          | No real-time error alerting                | Call `initSentry()` from instrumentation hook       | Medium                                 |
| In-memory rate limiting not distributed             | Won't work with multiple Vercel instances  | Migrate to Vercel KV or Upstash Redis               | Low (Vercel handles via single-region) |
| No Prometheus metrics endpoint                      | Cannot scrape metrics for Grafana          | Add `/metrics` endpoint to engine + agents          | Medium                                 |
| Gunicorn access logs not JSON-structured            | Harder to parse alongside application logs | Switch to JSON access log format                    | Low                                    |
