# Code Standards

Shared coding standards for the Sentinel Trading Platform.
Every agent and human contributor follows these rules.
When in doubt, match what the existing codebase already does.

---

## 1 TypeScript Standards

### 1.1 Strict Mode

The monorepo extends `tsconfig.base.json` which enforces:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`

Run `tsc --noEmit` (via `pnpm typecheck` in `apps/web`) before every PR.

### 1.2 Naming Conventions

| Element              | Convention    | Example                          |
| -------------------- | ------------- | -------------------------------- |
| Variables, functions | `camelCase`   | `fetchPortfolio`, `tradeCount`   |
| Components           | `PascalCase`  | `PortfolioCard`, `TradeHistory`  |
| Types, interfaces    | `PascalCase`  | `PortfolioSummary`, `TradeEntry` |
| Files, directories   | `kebab-case`  | `portfolio-card.tsx`, `lib/`     |
| Constants            | `UPPER_SNAKE` | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Enums                | `PascalCase`  | `OrderStatus.Filled`             |

### 1.3 Import Order

Group imports in the following order, separated by blank lines:

```ts
// 1. React / framework
import { useState } from 'react';
import Link from 'next/link';

// 2. External packages
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

// 3. Internal aliases (@/ or @sentinel/shared)
import { engineFetch } from '@/lib/engine-fetch';
import type { Portfolio } from '@sentinel/shared';

// 4. Relative imports
import { columns } from './columns';

// 5. Type-only imports (when not co-located above)
import type { TradeRow } from '../types';
```

Let ESLint and Prettier auto-sort when possible.

### 1.4 `any` Is Banned

- **Never use `any`** unless there is an explicit justification comment directly above it:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party lib has no types
const result = externalLib.call() as any;
```

- Prefer `unknown` for data from external sources (API responses, user input, JSON parsing).
- Narrow `unknown` values through Zod schemas or type guards before use.

### 1.5 API Response Types

Use **discriminated unions** for API response shapes:

```ts
type ApiResult<T> = { success: true; data: T } | { success: false; error: ApiError };

interface ApiError {
  code: string;
  message: string;
  correlationId?: string;
}
```

Validate responses with Zod before trusting the shape at runtime.

---

## 2 Python Standards

### 2.1 Tooling

- **Ruff** is the sole linter and formatter.
- Configured in `pyproject.toml`: line-length 100, target `py312`.
- Rule sets: `E`, `F`, `I`, `N`, `W`, `UP`.
- Run `pnpm lint:engine` and `pnpm format:check:engine` before every PR.

### 2.2 Type Annotations

Type annotations are **required** on all public functions and methods:

```python
async def get_portfolio(user_id: str) -> PortfolioResponse:
    ...
```

Private helpers may omit annotations when the types are obvious, but annotate when clarity helps.

### 2.3 Pydantic Models

All request and response bodies must use **Pydantic v2 models**:

```python
from pydantic import BaseModel, Field

class ScanRequest(BaseModel):
    symbols: list[str] = Field(..., min_length=1, max_length=50)
    strategy: str
```

Do not pass raw dicts across API boundaries.

### 2.4 Async-First

All FastAPI route handlers **must be async**:

```python
@router.get("/portfolio")
async def get_portfolio(user_id: str = Depends(get_current_user)) -> PortfolioResponse:
    ...
```

Use `httpx.AsyncClient` for outbound HTTP calls.
Reserve synchronous code for pure computation only.

---

## 3 Auth Patterns

### 3.1 Web (Next.js + Supabase SSR)

- Use `@supabase/ssr` for cookie-based auth.
- Protected server routes and server components call `requireAuth()` to get the session or redirect.
- Never read tokens on the client side. The Supabase client handles session refresh automatically.

### 3.2 Engine (FastAPI)

- `ApiKeyMiddleware` protects all engine routes.
- Accepts `Authorization: Bearer <key>` or `X-API-Key: <key>`.
- Web-to-engine calls go through the server-side proxy at `apps/web/src/lib/engine-fetch.ts`, which injects the key from `process.env`.

### 3.3 Hard Rules

- **Never expose API keys in client-side code.** No `NEXT_PUBLIC_*` env vars for engine or third-party keys.
- **JWT validation on proxy routes.** Every `/api/engine/*` handler validates the Supabase JWT before forwarding.
- **Agents auth** follows the same `ApiKeyMiddleware` pattern when called from the web proxy.

---

## 4 Error Handling

### 4.1 No Silent Catch

Every `catch` block must **log or re-throw**. Empty catch blocks are forbidden:

```ts
// ❌ Bad
try {
  await fetchData();
} catch {}

// ✅ Good
try {
  await fetchData();
} catch (error) {
  console.error('[fetchData] failed:', error);
  throw error;
}
```

Same rule in Python — bare `except: pass` is never acceptable.

### 4.2 Typed API Errors

Use discriminated unions (TypeScript) or typed exception classes (Python) for all API errors:

```ts
// TypeScript
interface ApiError {
  code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'INTERNAL';
  message: string;
  correlationId: string;
}
```

```python
# Python
from fastapi import HTTPException

class EngineError(HTTPException):
    def __init__(
        self,
        code: str,
        message: str,
        correlation_id: str,
        status_code: int = 500,
    ):
        super().__init__(
            status_code=status_code,
            detail={
                "code": code,
                "message": message,
                "correlationId": correlation_id,
            },
        )
```

### 4.3 Web Error Handling

- **React Query error boundaries** — use `QueryErrorResetBoundary` with a fallback UI.
- **Toast notifications** — surface user-facing errors via `sonner` toasts.
- Never show raw stack traces or internal codes to end users.

### 4.4 Engine Error Handling

- Register FastAPI exception handlers that return structured JSON:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "symbols list must not be empty",
  "correlationId": "req-abc123"
}
```

- Always include a `correlationId` in error responses for traceability.

---

## 5 Logging & Security

### 5.1 Never Log Secrets

The following fields must **never** appear in log output:

- `password`, `token`, `api_key`, `secret`, `authorization`
- Any PII: email addresses, SSNs, financial account numbers

### 5.2 Structured Logging

- **Engine (production):** Python `logging` module with JSON formatter. Every log entry includes a `correlationId`.
- **Web (production):** Structured JSON logs via OpenTelemetry or equivalent.
- **Development:** Console output is acceptable for both apps.

### 5.3 Redaction

Sensitive fields must be redacted before logging. At minimum, redact:

| Field           | Redacted form       |
| --------------- | ------------------- |
| `password`      | `[REDACTED]`        |
| `token`         | `[REDACTED]`        |
| `api_key`       | `[REDACTED]`        |
| `secret`        | `[REDACTED]`        |
| `authorization` | `Bearer [REDACTED]` |

### 5.4 Correlation IDs

- Engine: generate or propagate a correlation ID on every request via middleware.
- Web proxy routes: forward the correlation ID from the engine response headers.
- Include the correlation ID in all log entries and error responses.

---

## 6 Testing Standards

### 6.1 Web (Vitest + React Testing Library)

- Test files live next to the code they test or in a `__tests__/` directory.
- Use descriptive test names that read as sentences:

```ts
it('renders an error toast when the portfolio fetch fails', async () => {
  // ...
});
```

- Prefer `userEvent` over `fireEvent` for user interactions.
- Always wrap state-updating calls in `act()` or use RTL's built-in waiters.

### 6.2 Engine (Pytest)

- Async test support is enabled (`asyncio_mode = "auto"` in `pyproject.toml`).
- Use **fixtures** for setup/teardown. Avoid repeating setup code in test bodies.
- Use `respx` for mocking HTTP calls to external services (Polygon, Alpaca).
- Use `hypothesis` for property-based testing of numerical calculations.

### 6.3 Coverage

- Minimum coverage threshold: **60%** (configured in `pyproject.toml` and Vitest config).
- Coverage is checked in CI. A PR that drops coverage below threshold will fail the gate.

### 6.4 What to Test

- **Error paths, not just happy paths.** Every API call should have a test for failure.
- **Integration tests for API boundaries.** Web proxy routes, engine endpoints, and agent endpoints each need integration tests that exercise the real handler (not just mocks).
- **Edge cases in quant logic.** Use `hypothesis` to test numerical edge cases in the engine (NaN, Inf, empty series, single-element arrays).

### 6.5 End-to-End (Playwright)

- Playwright tests live in `apps/web/e2e/`.
- Run with `pnpm test:web:e2e`.
- E2E tests cover critical user flows: login, portfolio view, trade execution, settings.
- Do not use E2E tests for unit-level logic — keep them focused on integration.

---

## Quick Reference

| Area      | Lint / Format                             | Test               | Build                               |
| --------- | ----------------------------------------- | ------------------ | ----------------------------------- |
| Web       | `pnpm lint`                               | `pnpm test:web`    | `pnpm --filter @sentinel/web build` |
| Engine    | `pnpm lint:engine`, `format:check:engine` | `pnpm test:engine` | n/a (uvicorn)                       |
| Agents    | `pnpm lint`                               | `pnpm test:agents` | n/a                                 |
| Shared    | `pnpm lint`                               | `pnpm test`        | `pnpm build`                        |
| Docs only | `git diff --check`                        | n/a                | n/a                                 |
