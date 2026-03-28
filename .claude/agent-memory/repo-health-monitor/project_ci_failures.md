---
name: Recurring CI failures on main
description: Test Web e2e failures on main branch after route group restructure, plus Railway agents build failures and auth gate blocking health endpoints
type: project
---

As of 2026-03-25, the main branch CI is failing due to:

1. **Test Web e2e failures** in `apps/web/tests/e2e/dashboard.spec.ts` -- 5 tests broken after the route group restructure (commit 58b66a6). Dashboard page elements moved but test selectors were not updated.

2. **Auth middleware blocking health endpoints** -- `/api/engine/health` and `/api/settings/status` return 401 instead of 200. This breaks both e2e tests and the Vercel Deployment Checks workflow.

3. **Railway sentinel-agents build failure** -- persistent across all branches. PR #57 attempted to fix build context but the failure continues.

4. **CircleCI Pipeline in error state** -- appears misconfigured or not properly integrated.

**Why:** The route group restructure for auth vs dashboard layouts moved pages but test selectors were not updated in the same commit.

**How to apply:** When checking CI status, these are known failures. The Test Web fix should update selectors in dashboard.spec.ts. The health endpoint fix needs the auth middleware to whitelist /api/engine/health and /api/settings/status.
