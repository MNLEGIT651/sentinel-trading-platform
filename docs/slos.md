# Sentinel Service Level Objectives

> Living document — review quarterly or after any architecture change.

## Data Freshness

| Metric               | Target                    | Measurement                                                                                                                                          |
| -------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quote data freshness | < 5 s during market hours | Histogram `data.quote.age_seconds` from engine `/api/v1/data/quotes` response timestamps vs wall-clock. Alert when p95 > 5 s over a 5-minute window. |
| Bar data freshness   | < 60 s after bar close    | Histogram `data.bar.lag_seconds` comparing bar `timestamp` to ingest time. Alert when p95 > 60 s over a 5-minute window.                             |

## Latency

| Metric                  | Target (p95) | Measurement                                                                                                                                              |
| ----------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signal scan completion  | < 30 s       | Span `strategy.scan` duration from OpenTelemetry traces on engine `/api/v1/strategies/scan`.                                                             |
| Risk evaluation         | < 2 s        | Span `risk.assess` duration on engine `/api/v1/risk/assess`.                                                                                             |
| Approval-to-submit      | < 5 s        | Time from agents `POST /recommendations/:id/approve` entry to engine order response, captured in the `order.approve_to_submit` histogram.                |
| Order state convergence | < 10 s       | Time from order submission to first fill/cancel acknowledgement, tracked via the `order.convergence` histogram in the recommendation lifecycle workflow. |
| Page load (dashboard)   | < 3 s        | Lighthouse CI `first-contentful-paint` + `time-to-interactive` on the `/dashboard` route.                                                                |

## Reliability

| Metric                        | Target                                                | Measurement                                                                                                                      |
| ----------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Engine uptime                 | ≥ 99.5 % during market hours (Mon–Fri 09:30–16:00 ET) | Synthetic health check (`GET /health`) every 30 s. Calculate `(successful_checks / total_checks) * 100` over the trading window. |
| Agents uptime                 | ≥ 99.5 % during market hours                          | Same method against agents `GET /health`.                                                                                        |
| Order submission success rate | ≥ 99 %                                                | `order.submit.success / order.submit.total` counter ratio over a rolling 1-hour window.                                          |
| Broker submit success rate    | ≥ 98 %                                                | `broker.submit.success / broker.submit.total` — excludes intentional risk-blocks (HTTP 422).                                     |

## Risk Controls

| Metric             | Target                                             | Measurement                                                                          |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Halt activation    | < 1 s from trigger to agents `POST /halt` response | Span `halt.activation` in agents service traces.                                     |
| Risk block rate    | Logged per hour                                    | Counter `risk.blocks` with labels `{rule, ticker}`, aggregated hourly in dashboards. |
| Halt trigger count | Tracked per day                                    | Counter `halt.triggers` with label `{reason}`, aggregated daily.                     |

## Alert Thresholds

For every SLO above, two alert levels are defined:

| Level        | Condition                                                                              | Action                                             |
| ------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **WARNING**  | Metric within 10 % of SLO boundary (e.g., p95 scan latency > 27 s when target is 30 s) | Page on-call Slack channel; no wake-up.            |
| **CRITICAL** | SLO breached                                                                           | PagerDuty alert; immediate investigation required. |

### Concrete warning/critical values

| SLO                      | WARNING threshold      | CRITICAL threshold |
| ------------------------ | ---------------------- | ------------------ |
| Quote freshness          | > 4.5 s (p95, 5 min)   | > 5 s              |
| Bar freshness            | > 54 s (p95, 5 min)    | > 60 s             |
| Signal scan latency      | > 27 s (p95)           | > 30 s             |
| Risk evaluation latency  | > 1.8 s (p95)          | > 2 s              |
| Approval-to-submit       | > 4.5 s (p95)          | > 5 s              |
| Order convergence        | > 9 s (p95)            | > 10 s             |
| Dashboard page load      | > 2.7 s (p95)          | > 3 s              |
| Engine uptime            | < 99.7 % (1 h rolling) | < 99.5 %           |
| Agents uptime            | < 99.7 % (1 h rolling) | < 99.5 %           |
| Order submission success | < 99.5 % (1 h rolling) | < 99 %             |
| Broker submit success    | < 98.5 % (1 h rolling) | < 98 %             |
| Halt activation          | > 0.9 s                | > 1 s              |

## Measuring with OpenTelemetry

The platform instruments all three services with OpenTelemetry:

### Engine (Python)

- **Traces**: FastAPI auto-instrumentation produces spans for every route. Custom spans (`strategy.scan`, `risk.assess`, `order.submit`) wrap business logic.
- **Metrics**: Prometheus-compatible histograms exported via OTLP. Key metric names: `http.server.duration`, `data.quote.age_seconds`, `data.bar.lag_seconds`.
- **Correlation**: The `CorrelationIDMiddleware` in `apps/engine/src/middleware/tracing.py` sets `correlation_id` on every span, enabling cross-service trace stitching.

### Agents (TypeScript)

- **Traces**: OpenTelemetry Node SDK with Express instrumentation. Correlation IDs from `x-correlation-id` header are propagated to all downstream engine calls via `EngineClient`.
- **Metrics**: Counters (`order.submit.total`, `risk.blocks`, `halt.triggers`) and histograms (`order.approve_to_submit`, `order.convergence`) exported via OTLP.
- **Logs**: Structured JSON logger (`apps/agents/src/logger.ts`) emits `correlationId` on every line, allowing log↔trace joins.

### Web (Next.js)

- **Traces**: Vercel OTEL integration captures server-side rendering and API route spans. The service proxy in `apps/web/src/lib/server/service-proxy.ts` forwards and returns `x-correlation-id` for end-to-end stitching.
- **Metrics**: Lighthouse CI measures page-load SLOs; server-side histograms track proxy latency.
- **Synthetic checks**: Scheduled health probes against engine and agents `/health` endpoints feed the uptime SLOs.

### Dashboards

A Grafana dashboard (or equivalent) should present:

1. **SLO overview** — burn-rate chart per SLO over 7-day / 30-day windows.
2. **Latency heatmaps** — per-endpoint p50/p95/p99 histograms.
3. **Error budget** — remaining error budget percentage for each reliability SLO.
4. **Risk controls** — hourly block-rate and daily halt-trigger counts.
