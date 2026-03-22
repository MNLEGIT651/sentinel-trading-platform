# 📋 EXPERT AUDIT CHECKLIST

## Sentinel Trading Platform — Implementation Progress Tracker

Print this document and check off items as you complete them.

---

## ✅ TIER 1: CRITICAL (Week 1)

### Phase 1A: File Review & Understanding (2 hours)

- [ ] Read `CODE_AUDIT_AND_OPTIMIZATIONS.md` (part 1 & 2)
- [ ] Read `IMPLEMENTATION_ROADMAP.md` (Week 1 section)
- [ ] Review existing Python engine code (`src/api/main.py`)
- [ ] Review existing TypeScript agents code (`src/orchestrator.ts`)
- [ ] Understand current error handling patterns

### Phase 1B: Middleware & Utilities Integration (4 hours)

**Task 1: Update apps/engine/src/api/main.py**

- [ ] Add import: `from src.middleware.tracing import CorrelationIDMiddleware, setup_correlation_logging`
- [ ] Add import: `from src.middleware.rate_limit import RateLimitMiddleware`
- [ ] Add import: `from src.logging_config import configure_logging`
- [ ] Add import: `from src.clients.http import close_http_client`
- [ ] Update `lifespan()` context manager:
  - [ ] Call `configure_logging(level="INFO")`
  - [ ] Call `await close_http_client()` on shutdown
- [ ] Add middleware line: `app.add_middleware(CorrelationIDMiddleware)`
- [ ] Add middleware line: `app.add_middleware(RateLimitMiddleware, requests_per_minute=100)`
- [ ] Test: `python -m py_compile src/api/main.py` (no syntax errors)

**Task 2: Update apps/engine/src/api/routes/data.py**

- [ ] Add imports:
  - [ ] `from src.api.validators import GetBarsRequest, GetQuotesRequest, IngestRequestValidated`
  - [ ] `from src.errors import ValidationError, NotFoundError, ServiceUnavailableError`
  - [ ] `from src.clients.circuit_breaker import get_polygon_circuit_breaker`
- [ ] Update `get_bars()` signature with Field validators
- [ ] Update `get_quotes()` signature with Field validators
- [ ] Update `get_quote()` with circuit breaker:
  - [ ] Wrap `polygon.get_latest_price()` in `polygon_breaker.call()`
  - [ ] Add try/except for CircuitBreakerOpen
- [ ] Update error responses to use `ServiceUnavailableError`
- [ ] Test: `python -m py_compile src/api/routes/data.py`

**Task 3: Update apps/engine/src/api/routes/strategies.py**

- [ ] Add imports:
  - [ ] `from src.api.validators import ScanRequestValidated`
  - [ ] `from src.errors import ValidationError, NotFoundError`
  - [ ] `from src.clients.circuit_breaker import get_polygon_circuit_breaker`
- [ ] Update `scan_signals()` to use new validators
- [ ] Add circuit breaker for polygon calls
- [ ] Test: `python -m py_compile src/api/routes/strategies.py`

**Task 4: Update apps/engine/src/api/routes/health.py**

- [ ] Change: `settings = Settings()` → `settings: Settings = Depends(get_settings)`
- [ ] Add import: `from src.api.deps import get_settings`
- [ ] Test: `python -m py_compile src/api/routes/health.py`

**Task 5: Update apps/engine/src/api/routes/portfolio.py**

- [ ] Add imports: error classes
- [ ] Wrap external API calls with error handling
- [ ] Test: `python -m py_compile src/api/routes/portfolio.py`

**Task 6: Update apps/engine/src/api/routes/risk.py**

- [ ] Add imports: error classes
- [ ] Wrap external API calls with error handling
- [ ] Test: `python -m py_compile src/api/routes/risk.py`

**Task 7: Update apps/engine/src/api/routes/backtest.py**

- [ ] Add imports: error classes
- [ ] Wrap external API calls with error handling
- [ ] Test: `python -m py_compile src/api/routes/backtest.py`

### Phase 1C: Verification & Testing (3 hours)

**Task 1: Settings Singleton**

```bash
- [ ] python -c "from apps.engine.src.api.deps import get_settings; s1=get_settings(); s2=get_settings(); assert s1 is s2, 'Not cached!'; print('✓ Settings cached correctly')"
```

**Task 2: Middleware Integration**

```bash
- [ ] docker-compose up -d engine
- [ ] curl -i http://localhost:8000/health
- [ ] Check response includes: X-Request-ID header ✓
- [ ] Check logs show JSON format with request_id ✓
- [ ] docker-compose logs engine | grep "request_id"
```

**Task 3: Rate Limiting**

```bash
- [ ] ab -n 150 -c 1 http://localhost:8000/health
- [ ] Requests 1-100 should return 200 ✓
- [ ] Requests 101-150 should return 429 ✓
- [ ] Response header: X-RateLimit-Limit: 100 ✓
```

**Task 4: Input Validation**

```bash
- [ ] curl http://localhost:8000/api/v1/data/quote/invalid_ticker_12345
  - [ ] Should return 422 Unprocessable Entity ✓
- [ ] curl http://localhost:8000/api/v1/data/quote/AAPL
  - [ ] Should return 200 OK ✓
```

**Task 5: Error Handling**

```bash
- [ ] curl http://localhost:8000/api/v1/data/bars/AAPL?days=400
  - [ ] Should return 422 (days > 365) ✓
- [ ] curl http://localhost:8000/api/v1/data/bars/AAPL?days=-5
  - [ ] Should return 422 (days < 1) ✓
```

**Task 6: Circuit Breaker**

```bash
- [ ] Restart engine with POLYGON_API_KEY empty or wrong
- [ ] Monitor logs for circuit breaker state
- [ ] docker-compose logs engine | grep "circuit"
- [ ] Should see state transitions: closed → open → half_open → closed ✓
```

**Task 7: Final Integration Test**

```bash
- [ ] docker-compose down
- [ ] docker-compose up --build
- [ ] Wait for health checks to pass: docker-compose ps
- [ ] Verify all services show (healthy) ✓
- [ ] Run basic smoke tests:
  - [ ] GET http://localhost:8000/health → 200
  - [ ] GET http://localhost:3001/health → 200
  - [ ] GET http://localhost:3000 → 200
- [ ] Check logs: docker-compose logs | grep error
  - [ ] Should have 0 errors ✓
```

---

## 🟠 TIER 2: HIGH PRIORITY (Week 2)

### Pagination Implementation (2 hours)

- [ ] Add keyset pagination to `data.py`
- [ ] Update database queries to use `gt(id, cursor)` instead of `offset()`
- [ ] Test with large datasets (>1000 rows)
- [ ] Verify response includes `has_more` and `next_cursor`

### Database Indexes (1 hour)

- [ ] Open Supabase SQL editor
- [ ] Create index on `ticker` column
- [ ] Create index on `timeframe` column
- [ ] Create composite index: `(ticker, timeframe, timestamp DESC)`
- [ ] Verify in Supabase: Dashboard → Database → Indexes
- [ ] Test query performance: `EXPLAIN ANALYZE`

### Graceful Degradation (1 hour)

- [ ] Update `get_quotes()` to fallback to cache on Polygon failure
- [ ] Test by stopping Polygon connectivity
- [ ] Verify fallback works
- [ ] Verify logs show fallback event

### Agents Error Handling (1 hour)

- [ ] Add to `apps/agents/src/orchestrator.ts`:
  - [ ] Import `retryWithBackoff` from error-handling
  - [ ] Import `CircuitBreaker` from error-handling
  - [ ] Wrap agent execution with retry logic
  - [ ] Add timeout wrapper
- [ ] Test agent cycle with network failures
- [ ] Verify retry behavior in logs

---

## 🟡 TIER 3: MEDIUM PRIORITY (Week 3-4)

### Next.js Optimizations (1 hour)

- [ ] Update page with `export const revalidate = 60`
- [ ] Implement SWR hook for data fetching
- [ ] Add service worker registration
- [ ] Test offline functionality
- [ ] Run Lighthouse audit
- [ ] Verify Core Web Vitals score

### Service Worker (1 hour)

- [ ] Create `public/sw.js`
- [ ] Add service worker registration in layout
- [ ] Test offline mode
- [ ] Verify cache strategy

### Performance Monitoring (1 hour)

- [ ] Create Web Vitals tracking
- [ ] Setup metrics endpoint
- [ ] Add to Vercel Analytics
- [ ] Monitor in dashboard

### Native Build for Agents (1 hour)

- [ ] Update `package.json` scripts
  - [ ] `"build": "tsc"`
  - [ ] `"start": "node dist/index.js"`
- [ ] Test: `npm run build && npm start`
- [ ] Verify compiled JS works
- [ ] Update Dockerfile (already done)

---

## 🧪 TESTING & VALIDATION

### Unit Tests

- [ ] Test Settings singleton caching
- [ ] Test validators with edge cases
- [ ] Test circuit breaker state transitions
- [ ] Test rate limiter accuracy
- [ ] Coverage target: 80%+

### Integration Tests

- [ ] Full flow: request → validation → execution → response
- [ ] Error handling for all error types
- [ ] Middleware chaining (multiple middleware)
- [ ] Database operations with pagination

### Load Tests

- [ ] 100 concurrent requests
- [ ] 1000 req/s throughput
- [ ] Monitor memory usage
- [ ] Monitor CPU usage
- [ ] Verify no request timeouts

### Security Tests

- [ ] SQL injection attempts (should fail with 422)
- [ ] XSS attempts (should fail with 422)
- [ ] Invalid auth (should fail with 401)
- [ ] Rate limit bypass attempts (should fail at 100 req/min)

---

## 📊 PERFORMANCE BENCHMARKS

### Before → After Targets

**Latency (p50)**

- [ ] Before: 250ms → After: 150ms ✓ (measure with: `ab -t 30 http://localhost:8000/health`)

**Latency (p99)**

- [ ] Before: 800ms → After: 400ms ✓

**Error Rate**

- [ ] Before: 5-10% → After: <1% ✓

**Rate Limit Enforcement**

- [ ] Before: No limit → After: 100 req/min ✓

**Database Query Time**

- [ ] Before: 500ms → After: <100ms ✓ (with indexes)

---

## 📝 CODE QUALITY

### Linting & Formatting

- [ ] All Python files: `python -m ruff check apps/engine`
- [ ] All TypeScript files: `npx tsc --noEmit`
- [ ] No console.logs in production code
- [ ] No TODO comments without context
- [ ] Documentation added for complex functions

### Security Review

- [ ] No secrets in code or logs
- [ ] No hardcoded API keys
- [ ] All inputs validated
- [ ] All errors handled
- [ ] Rate limiting in place

### Documentation

- [ ] All functions have docstrings
- [ ] All complex logic has comments
- [ ] README updated with new middleware
- [ ] TROUBLESHOOTING guide created
- [ ] Runbook for common issues created

---

## 🚀 PRODUCTION READINESS

### Code Freeze

- [ ] No uncommitted changes
- [ ] All tests passing
- [ ] No compiler warnings
- [ ] Git history clean

### Infrastructure

- [ ] Database backups configured
- [ ] Database monitoring enabled
- [ ] Log aggregation configured
- [ ] Alerting configured
- [ ] PagerDuty/Slack integration tested

### Deployment

- [ ] Build passes without warnings
- [ ] Docker images built successfully
- [ ] docker-compose up works
- [ ] All health checks pass
- [ ] No services restart on startup

### Operations

- [ ] Runbook documented
- [ ] On-call rotation established
- [ ] Escalation procedures clear
- [ ] Incident response tested
- [ ] Team trained

---

## 📞 SIGN-OFF

- [ ] Code review: **\*\*\*\***\_**\*\*\*\*** (reviewer name, date)
- [ ] QA testing: **\*\*\*\***\_**\*\*\*\*** (QA name, date)
- [ ] Product approval: **\*\*\*\***\_**\*\*\*\*** (PM name, date)
- [ ] Ops approval: **\*\*\*\***\_**\*\*\*\*** (Ops name, date)

**Ready for production deployment**: ☐ YES / ☐ NO

---

## 📈 METRICS DASHBOARD

Track these metrics throughout implementation:

| Metric        | Target  | Current | Date | Status |
| ------------- | ------- | ------- | ---- | ------ |
| Latency p50   | <150ms  |         |      |        |
| Latency p99   | <400ms  |         |      |        |
| Error rate    | <1%     |         |      |        |
| Rate limit    | 100/min |         |      |        |
| Test coverage | 80%+    |         |      |        |
| Uptime        | 99.5%   |         |      |        |

---

## 🎯 COMPLETION TIMELINE

- **Week 1**: Tier 1 (12 hours) ✅
- **Week 2**: Tier 2 (6 hours) ⏳
- **Week 3-4**: Tier 3 (4 hours) 📅
- **Week 4**: Testing & validation (4 hours) 🧪
- **Week 5**: Production deployment 🚀

**Total: 26 hours over 5 weeks**

---

**Start Date**: **\*\***\_\_**\*\***  
**Expected Completion**: **\*\***\_\_**\*\***  
**Actual Completion**: **\*\***\_\_**\*\***

---

Print this checklist and tape it to your monitor. Check off items daily.

Good luck! 🚀
