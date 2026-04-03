# Correlation ID Flow

How request correlation IDs propagate through the Sentinel platform for distributed tracing.

## Overview

Every request entering the web proxy is assigned a **correlation ID** — a UUID that follows the request across service boundaries. This allows operators to trace a single user action through web → engine/agents logs.

## Header Convention

| Header             | Direction              | Purpose                            |
| ------------------ | ---------------------- | ---------------------------------- |
| `x-correlation-id` | Request & Response     | Primary correlation header         |
| `X-Request-ID`     | Response only (engine) | Legacy alias — engine returns both |

## Flow Diagram

```
Client (browser)
  │
  │  x-correlation-id: <from-client OR absent>
  ▼
┌──────────────────────────────────────────────┐
│  Next.js API Route (engine or agents proxy)  │
│  ─────────────────────────────────────────── │
│  • Extract x-correlation-id from request     │
│  • Generate crypto.randomUUID() if absent    │
│  • Inject into extraHeaders                  │
│  • Include in auth-error responses (401)     │
└──────────────┬───────────────────────────────┘
               │
               │  x-correlation-id: <uuid>
               ▼
┌──────────────────────────────────────────────┐
│  Service Proxy (service-proxy.ts)            │
│  ─────────────────────────────────────────── │
│  • Forwards via toForwardedHeaders()         │
│  • Includes in structured JSON success/fail  │
│    logs (correlationId field)                │
│  • Filters response: preserves               │
│    x-correlation-id from upstream            │
│  • Error responses: includes ID in body      │
│    (correlationId) and response header       │
└──────────────┬───────────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│   Engine    │  │   Agents    │
│  (Python)   │  │  (Node.js)  │
└─────────────┘  └─────────────┘
```

### Engine (Python FastAPI)

1. `CorrelationIDMiddleware` extracts `x-correlation-id` (or `X-Request-ID`, or generates UUID)
2. Stores in `ContextVar` (`request_id_context`) for the request lifetime
3. `JSONFormatter` injects `request_id` into every structured log entry
4. Response includes both `x-correlation-id` and `X-Request-ID` headers

### Agents (Node.js Express)

1. Express middleware extracts `x-correlation-id` (or generates UUID)
2. Stores in `AsyncLocalStorage` via `withCorrelationId()`
3. Structured logger (`logger.ts`) includes `correlationId` in every log entry
4. `EngineClient` automatically attaches ID when calling the engine service
5. Response includes `x-correlation-id` header

## Where IDs Appear

| Layer                            | Log field       | Response header                    |
| -------------------------------- | --------------- | ---------------------------------- |
| Web proxy (success/failure logs) | `correlationId` | `x-correlation-id`                 |
| Web proxy (error response body)  | `correlationId` | `x-correlation-id`                 |
| Engine (Python JSON logs)        | `request_id`    | `x-correlation-id`, `X-Request-ID` |
| Agents (Node.js JSON logs)       | `correlationId` | `x-correlation-id`                 |

## Tracing a Request

1. **Find the correlation ID** — check the `x-correlation-id` response header from any API call, or the `correlationId` field in an error response body.

2. **Search web proxy logs** for the ID:

   ```
   # Success log example
   {"scope":"service-proxy","level":"info","action":"success","service":"engine","correlationId":"abc-123",...}

   # Failure log example
   {"scope":"service-proxy","level":"error","action":"failed","service":"engine","correlationId":"abc-123",...}
   ```

3. **Search engine logs** (Railway) using `request_id`:

   ```
   {"level":"INFO","request_id":"abc-123","message":"Strategy scan completed",...}
   ```

4. **Search agents logs** (Railway) using `correlationId`:
   ```
   {"level":"info","event":"workflow.started","correlationId":"abc-123",...}
   ```

## Error Response Contract

All proxy error responses include the correlation ID for client-side tracing:

```json
{
  "error": "quant engine timed out after 70000ms.",
  "code": "timeout",
  "service": "engine",
  "retryable": false,
  "status": 504,
  "correlationId": "abc-123-def-456"
}
```

Auth errors (401) from proxy routes also include the ID:

```json
{
  "error": "unauthorized",
  "message": "Not authenticated",
  "correlationId": "abc-123-def-456"
}
```

## Troubleshooting

| Symptom                                 | Likely cause                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| No `x-correlation-id` in response       | Upstream service crashed before middleware ran                                            |
| ID in proxy log but not in engine log   | Request rejected by engine middleware (CORS, rate limit) before `CorrelationIDMiddleware` |
| Different IDs in proxy vs engine        | Engine generated its own ID — check `x-correlation-id` header forwarding                  |
| `correlationId` missing from error body | Proxy route did not pass `extraHeaders` (should not happen with current code)             |
