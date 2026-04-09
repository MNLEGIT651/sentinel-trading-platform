---
name: sentinel-vercel-ops
description: This skill should be used for Vercel operations on the Sentinel trading platform — including "deploy to Vercel", "check deployment", "Vercel build failed", "preview deployment", "Vercel env vars", "deployment logs", "rollback deployment", "why did the build fail", "Vercel status", "is the site deployed", or any time the web app's deployment needs to be inspected, debugged, or managed. Always apply when using Vercel MCP tools for this project.
---

# Sentinel Vercel Operations

**Vercel Project Name:** `sentinel-trading-platform-agents` _(the name is misleading — this deploys the web app)_
**Project ID:** `prj_IOPutSQDIkXYF1LHfjMQxyMoo5tG`
**Team ID:** `team_1jHeAEF8oKm2Z46fqRMdu5uL`
**Team Slug:** `steven-schlingmans-projects`
**GitHub Repo:** `github.com/stevenschling13/sentinel-trading-platform`
**Vercel Dashboard:** [vercel.com/steven-schlingmans-projects/sentinel-trading-platform-agents](https://vercel.com/steven-schlingmans-projects/sentinel-trading-platform-agents)

All MCP operations use `teamId: team_1jHeAEF8oKm2Z46fqRMdu5uL`.

---

## How Deployments Trigger

Deployments fire automatically from GitHub on every push to `main` **unless** the `ignoreCommand` in `vercel.json` exits 0 (meaning: skip this deployment).

```json
"ignoreCommand": "git diff --quiet HEAD^ HEAD -- apps/web packages/shared"
```

**This means:** if a commit only touches `apps/engine/` or `apps/agents/` — with no changes to `apps/web/` or `packages/shared/` — Vercel skips the deployment entirely. This is intentional and correct behaviour for the monorepo.

**If Vercel isn't deploying after a push**, check: did the commit touch `apps/web` or `packages/shared`? If not, that's why.

**PRs** also trigger preview deployments (unique URLs per PR).

---

## MCP Quick Reference

| Task                    | MCP Tool                    | Key Parameters            |
| ----------------------- | --------------------------- | ------------------------- |
| List recent deployments | `list_deployments`          | `projectId`, `teamId`     |
| Get deployment details  | `get_deployment`            | `idOrUrl`, `teamId`       |
| Get build logs          | `get_deployment_build_logs` | `idOrUrl`, `teamId`       |
| Get runtime logs        | `get_runtime_logs`          | `projectId`, `teamId`     |
| Deploy manually         | `deploy_to_vercel`          | `projectId`, `teamId`     |
| Open a URL              | `get_access_to_vercel_url`  | URL of preview deployment |

---

## Checking Deployment Status

```
Tool: list_deployments
projectId: prj_IOPutSQDIkXYF1LHfjMQxyMoo5tG
teamId: team_1jHeAEF8oKm2Z46fqRMdu5uL
```

**States:**

- `READY` — deployed successfully, serving traffic
- `ERROR` — build or deployment failed
- `CANCELED` — manually canceled or superseded by a newer deploy
- `BUILDING` — currently building

The most recent `READY` deployment is what's live in production.

---

## Debugging a Failed Build

```
Tool: get_deployment_build_logs
idOrUrl: <deployment-id-from-list_deployments>
teamId: team_1jHeAEF8oKm2Z46fqRMdu5uL
limit: 100
```

**Common Sentinel build failure causes:**

| Error in logs                             | Cause                                      | Fix                                                         |
| ----------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| `Type error: ...`                         | TypeScript error in `apps/web/`            | Fix the type error, push                                    |
| `Cannot find module '@sentinel/shared'`   | Package not built before web               | Check `turbo.json` task dependencies                        |
| `NEXT_PUBLIC_SUPABASE_URL is not defined` | Env var missing in Vercel project settings | Add via Vercel dashboard → Settings → Environment Variables |
| `Failed to compile`                       | Next.js compilation error                  | Check the specific file in the log                          |
| Build skipped (not an error)              | `ignoreCommand` exited 0                   | Expected — commit didn't touch `apps/web`                   |

**The Next.js config uses `output: 'standalone'`** — ensure this is compatible with Vercel's deployment model (it is, but note it generates a `.next/standalone` directory).

---

## Environment Variables in Vercel

The web app on Vercel needs these variables set in the Vercel project settings (dashboard → Settings → Environment Variables):

| Variable                        | Preview | Production | Notes                                                    |
| ------------------------------- | ------- | ---------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✓       | ✓          | Same value for both                                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓       | ✓          | Public key, same for both                                |
| `SUPABASE_SERVICE_ROLE_KEY`     | ✓       | ✓          | **Secret** — never expose client-side                    |
| `ENGINE_URL`                    | ✓       | ✓          | **Critical** — deployed engine URL for server-side proxy |
| `ENGINE_API_KEY`                | ✓       | ✓          | Engine auth key for server-side proxy                    |
| `AGENTS_URL`                    | ✓       | ✓          | Deployed agents URL for server-side proxy                |
| `CRON_SECRET`                   | ✓       | ✓          | Vercel cron authentication                               |

> **Deprecated:** `NEXT_PUBLIC_ENGINE_URL`, `NEXT_PUBLIC_ENGINE_API_KEY`, and `NEXT_PUBLIC_AGENTS_URL` are fully removed. All engine/agents calls now use the server-side same-origin proxy via `ENGINE_URL` and `AGENTS_URL`. Remove any stale references from Vercel env vars.

**Most common production issue:** `ENGINE_URL` missing or still set to `http://localhost:8000`. The same-origin proxy (`/api/engine/*`) forwards to this URL server-side — it must point to the actual deployed engine.

Pull current Vercel env vars to local:

```bash
vercel env pull apps/web/.env.local
```

---

## Rolling Back a Deployment

To revert to the previous working deployment:

1. Find the last `READY` deployment: `list_deployments`
2. Get its ID (e.g., `dpl_5UPmfwt6Z3Mh1u4SsZksrnswLPSQ`)
3. Promote it via Vercel dashboard → Deployments → find the deployment → "..." → "Promote to Production"

Or via CLI:

```bash
vercel rollback dpl_5UPmfwt6Z3Mh1u4SsZksrnswLPSQ
```

---

## Preview Deployments (PRs)

Every PR gets a unique preview URL:

- Pattern: `sentinel-trading-platfor-git-<branch-hash>-steven-schlingmans-projects.vercel.app`
- Use `get_access_to_vercel_url` MCP tool to access these URLs

Preview deployments use the same env vars as production unless you've set environment-specific overrides in Vercel settings.

---

## Triggering a Manual Deploy

If you need to force a deployment without a new commit:

```bash
cd apps/web
vercel --prod
```

Or via MCP:

```
Tool: deploy_to_vercel
projectId: prj_IOPutSQDIkXYF1LHfjMQxyMoo5tG
teamId: team_1jHeAEF8oKm2Z46fqRMdu5uL
```

---

## Additional Resources

- **`references/vercel-env-setup.md`** — Step-by-step guide to configuring all env vars in the Vercel dashboard
- Use `sentinel-connections` for the complete env var matrix across all environments
- Use `vercel:logs` skill for quick log viewing
