# Railway–Supabase Connectivity Audit

**Date:** 2025-07-16
**Commit:** `9c8acc2`
**Scope:** Health check semantics, false "Engine Offline" banner

---

## ROOT CAUSE

Engine and agents `/health` endpoints returned **HTTP 503** when any downstream
dependency (Supabase, Polygon, Alpaca) was degraded. The web app's service proxy
treated 503 as a retryable upstream error, remapped it to 502, and the client-side
health polling hook (`useServiceHealth`) interpreted non-2xx as "service offline."

This caused the **entire UI** to show "Engine Offline" and disable all data fetching
hooks whenever a single dependency had a transient hiccup — even though the engine
process was alive, reachable, and authenticated.

### Failure chain

```
Engine /health → 503 (Supabase unreachable)
  → service-proxy.ts retries 503, maps to 502
    → client checkEngine() sees res.ok === false
      → engineOnline = false in Zustand store
        → OfflineBanner renders "Engine Offline"
        → All TanStack Query hooks disabled (enabled: false)
```

## FILES CHANGED

| File                                                       | Change                                             |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `apps/engine/src/api/routes/health.py`                     | Always return 200; degraded in body                |
| `apps/agents/src/routes/health.ts`                         | Always return 200; degraded in body                |
| `apps/web/src/app/api/health/route.ts`                     | Parse body for degraded; accept 503 as degraded    |
| `apps/web/src/app/api/settings/status/route.ts`            | Add `degraded` status; contract-aware body parsing |
| `apps/web/src/hooks/use-service-health.ts`                 | Accept 503 as alive (defense-in-depth)             |
| `apps/web/src/components/settings/connection-status.tsx`   | Add amber "Degraded" badge                         |
| `apps/engine/tests/unit/test_health.py`                    | Assert 200 always                                  |
| `apps/engine/tests/integration/test_health_integration.py` | Assert 200 always                                  |
| `apps/web/tests/unit/health-route.test.ts`                 | 4 new degraded test cases                          |
| `apps/web/tests/unit/settings-status.test.ts`              | 2 new degraded test cases                          |

## HOST POLICY

No changes. Host/origin policy was fixed in prior commit (`ddcd1a7`).

## HEALTH CONTRACT

### Before (broken)

- `/health` returned **503** when any dependency was degraded
- Web interpreted 503 as "service offline"
- Railway health checks could restart healthy containers on dependency hiccup
- No `degraded` state in UI — only connected/disconnected/not_configured

### After (fixed)

- `/health` **always returns 200** (liveness semantics)
- Body `status` field: `"ok"` or `"degraded"` with per-dependency detail
- Web parses body to detect degraded state, not HTTP status
- Defense-in-depth: web layers also accept 503 as "alive but degraded"
- Settings page shows amber "Degraded" badge when appropriate
- `engineOnline` remains `true` when engine is degraded (avoids ripple through 15+ pages)

### Status model

| Status           | Meaning                                        |
| ---------------- | ---------------------------------------------- |
| `connected`      | Service reachable, all dependencies healthy    |
| `degraded`       | Service reachable, one+ dependencies unhealthy |
| `disconnected`   | Service unreachable or auth failure            |
| `not_configured` | Service URL/credentials not set                |

## PRODUCTION BEHAVIOR

- Engine process alive + reachable → "Connected" (green) or "Degraded" (amber)
- Engine process unreachable → "Disconnected" (red)
- Transient Supabase hiccup → "Degraded" (amber), not "Offline" (red)
- Railway health checks see 200 → no unnecessary container restarts

## PREVIEW BEHAVIOR

No change. Preview environments use the same health contract.

## VALIDATION RESULTS

| Check                           | Result                                          |
| ------------------------------- | ----------------------------------------------- |
| `pnpm lint`                     | ✅ PASS (3 packages, 0 errors)                  |
| `pnpm typecheck`                | ✅ PASS (3 packages)                            |
| `pnpm test`                     | ✅ PASS (1149 tests, 105 files)                 |
| `pnpm test:engine`              | ✅ PASS (495 tests)                             |
| Production `/api/health`        | ✅ 200 OK, engine: connected, agents: connected |
| Production `/api/engine/health` | ✅ 200 OK, status: ok                           |
| Production `/api/agents/health` | ✅ 200 OK, status: ok                           |

## REMAINING RISKS

1. **Agents dependency type drift** — `settings/status/route.ts` types agent dependencies
   as `boolean` but agents `/health` returns strings (`'connected'`/`'disconnected'`).
   Pre-existing issue, not introduced by this fix. Low impact (Settings page only).

2. **No separate `/ready` endpoint** — Currently one endpoint serves both liveness and
   readiness. If strict startup gating is needed later, add `/ready` that CAN return 503.

3. **Service proxy retry on 503** — `service-proxy.ts` still retries 503. Now moot since
   health endpoints return 200, but if any other engine route returns 503, the proxy will
   retry it. This is intentional behavior for data routes but worth noting.
