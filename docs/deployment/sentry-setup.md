# Sentry Error Monitoring Setup

> Step-by-step guide for integrating [Sentry](https://sentry.io) across all Sentinel services.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Next.js Web App (`apps/web`)](#nextjs-web-app-appsweb)
- [FastAPI Engine (`apps/engine`)](#fastapi-engine-appsengine)
- [Express Agents (`apps/agents`)](#express-agents-appsagents)
- [Source Map Uploads (Vercel)](#source-map-uploads-vercel)
- [Error Boundary Integration](#error-boundary-integration)
- [Verifying the Setup](#verifying-the-setup)

---

## Overview

Sentinel uses Sentry for real-time error tracking and performance monitoring. Each
service reports to its own Sentry project so alerts can be routed independently:

| Service       | Framework           | Sentry SDK            | Sentry Project    |
| ------------- | ------------------- | --------------------- | ----------------- |
| `apps/web`    | Next.js 16 (Vercel) | `@sentry/nextjs`      | `sentinel-web`    |
| `apps/engine` | FastAPI (Railway)   | `sentry-sdk[fastapi]` | `sentinel-engine` |
| `apps/agents` | Express 5 (Railway) | `@sentry/node`        | `sentinel-agents` |

The web app already has an optional Sentry stub at `apps/web/src/lib/sentry.ts` that
dynamically imports `@sentry/nextjs` when `SENTRY_DSN` is set. The guides below
show how to wire everything up end-to-end.

---

## Prerequisites

1. Create a [Sentry](https://sentry.io) account (the free Developer plan works).
2. Create **three Sentry projects** — one per service — inside a single
   Sentry organization (e.g. `sentinel-trading`).
3. Note each project's **DSN** (found under _Settings → Client Keys_).
4. Generate an **Auth Token** with `project:releases` and `org:read` scopes
   (_Settings → Auth Tokens_). This is needed for source-map uploads.

---

## Environment Variables

Add the following to each service's environment (Vercel dashboard, Railway
variables, or local `.env` files). All variables are **optional** — Sentry
gracefully degrades when the DSN is absent.

### Shared

| Variable             | Description             | Example                                    |
| -------------------- | ----------------------- | ------------------------------------------ |
| `SENTRY_DSN`         | Project DSN from Sentry | `https://abc123@o123.ingest.sentry.io/456` |
| `SENTRY_ENVIRONMENT` | Deployment environment  | `production` / `preview` / `development`   |

### Web-only (Vercel)

| Variable                 | Description                       | Example              |
| ------------------------ | --------------------------------- | -------------------- |
| `SENTRY_AUTH_TOKEN`      | Auth token for source-map uploads | `sntrys_eyJ...`      |
| `SENTRY_ORG`             | Sentry organization slug          | `sentinel-trading`   |
| `SENTRY_PROJECT`         | Sentry project slug               | `sentinel-web`       |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side DSN (public)          | Same as `SENTRY_DSN` |

### Engine-only (Railway)

| Variable                    | Description                     | Example |
| --------------------------- | ------------------------------- | ------- |
| `SENTRY_TRACES_SAMPLE_RATE` | Transaction sampling rate (0–1) | `0.1`   |

### Agents-only (Railway)

| Variable                    | Description                     | Example |
| --------------------------- | ------------------------------- | ------- |
| `SENTRY_TRACES_SAMPLE_RATE` | Transaction sampling rate (0–1) | `0.1`   |

> **Tip:** Add all `SENTRY_*` variables to the root `.env.example` file so
> future contributors know they exist.

---

## Next.js Web App (`apps/web`)

### 1. Install the SDK

```bash
cd apps/web
pnpm add @sentry/nextjs
```

### 2. Run the Sentry Wizard (optional)

The wizard scaffolds config files automatically:

```bash
npx @sentry/wizard@latest -i nextjs
```

Or create the files manually as shown below.

### 3. Create Configuration Files

#### `apps/web/sentry.client.config.ts`

See the example template at [`apps/web/sentry.client.config.ts.example`](../../apps/web/sentry.client.config.ts.example).

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,

  // Performance monitoring
  tracesSampleRate: 0.1,

  // Session replay (optional — captures DOM replay for errors)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],

  // Filter noisy errors
  ignoreErrors: ['ResizeObserver loop', 'Network request failed', /Loading chunk \d+ failed/],
});
```

#### `apps/web/sentry.server.config.ts`

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

#### `apps/web/sentry.edge.config.ts`

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

#### `apps/web/instrumentation.ts`

Next.js 16 uses the `instrumentation.ts` hook to initialize server-side SDKs:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
```

> Import `Sentry` at the top of the file if your bundler requires static
> imports:
>
> ```ts
> import * as Sentry from '@sentry/nextjs';
> ```

### 4. Wrap `next.config.ts`

Add the Sentry plugin to the existing Next.js config:

```ts
// next.config.ts (add at the end)
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // ... existing config ...
};

export default withSentryConfig(nextConfig, {
  // Upload source maps during the Vercel build
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress source-map upload logs in CI
  silent: !process.env.CI,

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,

  // Hide source maps from the client bundle
  hideSourceMaps: true,
});
```

---

## FastAPI Engine (`apps/engine`)

### 1. Install the SDK

```bash
cd apps/engine
uv add "sentry-sdk[fastapi]"
```

Or add to `pyproject.toml`:

```toml
[project]
dependencies = [
  # ... existing deps ...
  "sentry-sdk[fastapi]>=2",
]
```

### 2. Initialize Sentry

Add initialization to the FastAPI application entry point (e.g.
`apps/engine/src/main.py`):

```python
import os
import sentry_sdk

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    environment=os.getenv("SENTRY_ENVIRONMENT", "development"),

    # Performance monitoring
    traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),

    # Associate commits with releases
    release=os.getenv("RAILWAY_GIT_COMMIT_SHA", "local"),

    # Filter out health-check noise
    before_send_transaction=_filter_health_transactions,
)


def _filter_health_transactions(event, hint):
    """Drop /health transactions to reduce noise."""
    if event.get("transaction") == "/health":
        return None
    return event
```

The `sentry-sdk[fastapi]` extra automatically patches FastAPI, so no additional
middleware is needed. It hooks into:

- Request/response lifecycle
- Unhandled exceptions
- ASGI server errors

### 3. Enrich Errors with User & Correlation Context

```python
from sentry_sdk import set_user, set_tag

@app.middleware("http")
async def sentry_context_middleware(request, call_next):
    correlation_id = request.headers.get("x-correlation-id", "")
    if correlation_id:
        set_tag("correlation_id", correlation_id)
    # Optionally set user from auth
    # set_user({"id": request.state.user_id})
    return await call_next(request)
```

---

## Express Agents (`apps/agents`)

### 1. Install the SDK

```bash
cd apps/agents
pnpm add @sentry/node
```

### 2. Initialize Sentry

Sentry **must** be initialized before any other imports. Create or update the
entry point (e.g. `apps/agents/src/instrument.ts`):

```ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  release: process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local',
  integrations: [
    // Automatically instruments Express routes
    Sentry.expressIntegration(),
    // Capture unhandled promise rejections
    Sentry.onUnhandledRejectionIntegration(),
  ],
});
```

Import this file **first** in your main entry point:

```ts
// apps/agents/src/index.ts
import './instrument'; // must be first
import express from 'express';
// ... rest of app
```

### 3. Add Express Error Handler

Sentry provides a request handler and error handler for Express:

```ts
import * as Sentry from '@sentry/node';

const app = express();

// After all routes
Sentry.setupExpressErrorHandler(app);

// Custom fallback handler (after Sentry's)
app.use((err, _req, res, _next) => {
  res.status(500).json({
    error: 'Internal server error',
    eventId: Sentry.lastEventId(),
  });
});
```

### 4. Propagate Correlation IDs

```ts
app.use((req, _res, next) => {
  const correlationId = req.headers['x-correlation-id'];
  if (correlationId) {
    Sentry.setTag('correlation_id', correlationId as string);
  }
  next();
});
```

---

## Source Map Uploads (Vercel)

For the Next.js app, source maps are uploaded during the Vercel build via the
`withSentryConfig` wrapper (see above). Ensure these variables are set in the
**Vercel dashboard** (_Settings → Environment Variables_):

| Variable                 | Scope               | Value                |
| ------------------------ | ------------------- | -------------------- |
| `SENTRY_AUTH_TOKEN`      | Production, Preview | Your auth token      |
| `SENTRY_ORG`             | All                 | `sentinel-trading`   |
| `SENTRY_PROJECT`         | All                 | `sentinel-web`       |
| `NEXT_PUBLIC_SENTRY_DSN` | All                 | Your web project DSN |

### Verifying Uploads

After a successful Vercel deploy:

1. Go to Sentry → _Releases_ → latest release
2. Confirm source-map artifacts are listed
3. Trigger a test error and verify the stack trace is deobfuscated

> **Railway services** (engine and agents) don't need source-map uploads —
> Python traces are already readable, and the agents service runs server-side
> Node.js where source maps can be inlined during the build.

---

## Error Boundary Integration

### React Error Boundary (Next.js)

Wrap key UI subtrees with Sentry's error boundary for graceful degradation:

```tsx
// apps/web/src/components/error-boundary.tsx
'use client';

import * as Sentry from '@sentry/nextjs';
import { type ReactNode } from 'react';

interface FallbackProps {
  error: Error;
  resetError: () => void;
}

function ErrorFallback({ error, resetError }: FallbackProps) {
  return (
    <div role="alert" className="p-6 text-center">
      <h2 className="text-xl font-semibold text-red-600">Something went wrong</h2>
      <p className="mt-2 text-sm text-gray-500">{error.message}</p>
      <button
        onClick={resetError}
        className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}

export function SentryErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorFallback error={error as Error} resetError={resetError} />
      )}
      showDialog={false}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
```

Usage in a layout or page:

```tsx
import { SentryErrorBoundary } from '@/components/error-boundary';

export default function DashboardLayout({ children }) {
  return <SentryErrorBoundary>{children}</SentryErrorBoundary>;
}
```

### Next.js `global-error.tsx`

Capture unhandled errors at the root layout level:

```tsx
// apps/web/src/app/global-error.tsx
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Something went wrong</h2>
            <button onClick={reset} className="mt-4 rounded bg-blue-600 px-4 py-2 text-white">
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
```

---

## Verifying the Setup

### Quick Smoke Test

Trigger a test error in each service to confirm events reach Sentry:

**Web (browser console or a test page):**

```ts
import * as Sentry from '@sentry/nextjs';
Sentry.captureException(new Error('Sentry test from sentinel-web'));
```

**Engine (Python shell):**

```python
import sentry_sdk
sentry_sdk.capture_message("Sentry test from sentinel-engine")
```

**Agents (Node REPL or test route):**

```ts
import * as Sentry from '@sentry/node';
Sentry.captureMessage('Sentry test from sentinel-agents');
```

### Checklist

- [ ] All three Sentry projects receive test events
- [ ] Source maps are uploaded for web builds (stack traces are readable)
- [ ] `correlation_id` tags appear on events originating from proxied requests
- [ ] Health-check endpoints (`/health`) do **not** generate Sentry transactions
- [ ] `SENTRY_DSN` is absent in local `.env` by default (opt-in for local dev)
- [ ] Error boundaries render fallback UI without crashing the entire page
