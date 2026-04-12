# Vercel Production Sync Report

**Repository:** stevenschling13/Trading-App
**Date:** 2025-07-10
**Vercel Team:** steven-schlingmans-projects

---

## Previous Broken Behavior

Production deploys on `main` were being **canceled** by the Vercel Ignored Build Step
(`scripts/vercel-ignore-command.sh`). The script checked whether `apps/web/` or
`packages/shared/` had changes in the diff — if not, it exited 0 (skip build).

This caused production to serve stale deployments when `main` received engine-only,
docs-only, or config-only commits. The production alias would stay pinned to the last
commit that happened to touch web code.

**Example:** Commit `c10f6f8` (live execution gate — engine + docs only) triggered a
production deploy that was immediately **Canceled** by the ignore script. Production
remained on deployment `trading-j9p4c4gop` from commit `542bec0` (2+ hours stale).

## Root Cause

`scripts/vercel-ignore-command.sh` applied the same diff-based skip logic to **all**
environments including production. It did not distinguish between production builds
(which should always deploy) and preview builds (where optimization is acceptable).

## Config Changes Made

### `scripts/vercel-ignore-command.sh`

Added early-exit logic for production:

```bash
# Production: always build
if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "Production environment detected; running build."
  exit 1
fi

if [ "${VERCEL_GIT_COMMIT_REF:-}" = "main" ]; then
  echo "Branch is main; running build."
  exit 1
fi

# Preview: keep diff-based optimization
```

Preview builds on PR branches still use the diff-based optimization to save build minutes.

### `docs/runbooks/production.md`

Updated deploy order step 3 to reflect that production always builds on `main` push.

## Vercel Project Inventory

| Project       | Status                      | Role                                      |
| ------------- | --------------------------- | ----------------------------------------- |
| `trading-app` | **Canonical**               | Production web dashboard                  |
| `web`         | Stale (Error state, 4d old) | Not in use — likely an older project name |

**Recommendation:** The `web` project can be removed from the Vercel dashboard when
convenient. It has a single Error deployment and is not serving traffic.

## Deployment Verification

### Old Production State

| Field      | Value                                |
| ---------- | ------------------------------------ |
| Deployment | `trading-j9p4c4gop`                  |
| Status     | ● Ready                              |
| Commit     | `542bec0` (CSRF enforcement PR #315) |
| Created    | 2h before fix                        |

### Latest Canceled Deploy (before fix)

| Field      | Value                                               |
| ---------- | --------------------------------------------------- |
| Deployment | `trading-g0vxbrdle`                                 |
| Status     | ● Canceled                                          |
| Commit     | `c10f6f8` (live execution gate PR #316)             |
| Reason     | Ignored Build Step exited 0 (no web/shared changes) |

### New Production Deploy (after fix)

| Field      | Value                         |
| ---------- | ----------------------------- |
| Deployment | `trading-ahkwdg0gn`           |
| Status     | ● Ready                       |
| Commit     | `e534347` (ignore script fix) |
| Created    | Sun Apr 12 2026 14:01:06 CDT  |
| Build time | ~50s                          |

### Production Health Check

```
GET https://sentinel-trading-platform.vercel.app/api/health
{
  "status": "ok",
  "service": "sentinel-web",
  "timestamp": "2026-04-12T19:03:35.448Z",
  "dependencies": {
    "engine": "connected",
    "agents": "connected"
  }
}
```

## Deployment Model

### Production (main)

- **Trigger:** Every push to `main`
- **Ignore command:** Bypassed — always builds
- **Root directory:** `apps/web`
- **Build command:** `turbo run build --filter=@sentinel/web`
- **Install command:** `cd ../.. && pnpm install --frozen-lockfile`
- **Framework:** Next.js
- **Node version:** 22.x
- **Region:** iad1

### Preview (PR branches)

- **Trigger:** Every push to a PR branch
- **Ignore command:** Diff-based — skips if no `apps/web/` or `packages/shared/` changes
- \*\*Same build config as production otherwise

### Aliases

| Alias                                                         | Target                |
| ------------------------------------------------------------- | --------------------- |
| `sentinel-trading-platform.vercel.app`                        | Production deployment |
| `sentinel-trading-platform-agents.vercel.app`                 | Production deployment |
| `trading-app-steven-schlingmans-projects.vercel.app`          | Production deployment |
| `trading-app-git-main-steven-schlingmans-projects.vercel.app` | Git branch alias      |

### How to Verify Production Matches Latest Main

```bash
# 1. Get latest main SHA
git rev-parse origin/main

# 2. Check Vercel production deployment
npx vercel ls trading-app  # Look for latest Production ● Ready

# 3. Hit health endpoint
curl https://sentinel-trading-platform.vercel.app/api/health
```

---

## Final Verdict

### VERCEL PROJECT

`trading-app` (canonical). `web` is stale and can be removed.

### PRODUCTION DEPLOYMENT STATUS

● **Ready** — deployment `trading-ahkwdg0gn` serving latest `main`.

### MAIN SHA

`e53434777715535b6a22d6e66d77992b1a21cfda`

### DEPLOYED SHA

`e53434777715535b6a22d6e66d77992b1a21cfda` (same commit — **aligned**)

### ALIAS STATUS

All 4 production aliases point to latest deployment. Health check returns `ok`.

### REMAINING RISKS

1. **`web` project exists but is unused.** Remove from Vercel dashboard when convenient.
2. **Preview optimization may skip legitimate preview builds** if a PR only changes engine
   files but the reviewer wants to see the Vercel preview. This is acceptable — previews
   can be force-triggered with `vercel --prod` or by touching any `apps/web/` file.
