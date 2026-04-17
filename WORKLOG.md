# Sentinel Worklog

> Cross-session context persistence. Updated by every AI agent at session start and end.
> Prevents context loss, circular debugging, and repeated failed approaches.
>
> **Rule**: Read this file at session start. Update it at session end.

## Active Context

_Last updated: 2026-04-10_

### Current Architecture Decisions

- **Web → Engine**: All calls go through `apps/web/src/lib/engine-fetch.ts` (same-origin proxy)
- **Web → Agents**: All calls go through `apps/web/src/lib/agents-client.ts`
- **Deployment**: Vercel (web) + Railway (engine + agents) + Supabase (database)
- **Agent coordination**: `docs/ai/state/project-state.md` is the single source of truth for task status

### Known Working Patterns

- `pnpm lint && pnpm test && pnpm build` for Node workspace validation
- `pnpm lint:engine && pnpm format:check:engine && pnpm test:engine` for Python engine
- `pnpm guardian` to run PR Guardian checks locally before creating a PR
- `turbo --ui stream` required for CI/scripting (TUI mode swallows output otherwise)
- `pnpm install` may prompt interactively — answer Y if it asks to rebuild node_modules

### Known Gotchas

- Node 24.x triggers `typescript-estree` warnings (supports <6.0.0) — cosmetic, non-blocking
- TypeScript 6.0.2 is bleeding edge — some ecosystem tools emit warnings
- `apps/web/.next/cache` can grow large — `pnpm clean` if builds are slow
- `proxy.ts` and `middleware.ts` cannot coexist in Next.js — use only `proxy.ts`

---

## Failed Approaches Log

> Record approaches that were tried and failed. Prevents agents from re-trying the same thing.

| Date       | Agent    | What Was Tried                                     | Why It Failed                                            | Lesson                                              |
| ---------- | -------- | -------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| 2026-04-09 | Multiple | 8 overlapping PRs from 3 agents                    | No coordination — agents didn't check for in-flight work | Always check open PRs before starting work          |
| 2026-04-09 | Codex    | PR #297 used `BrokerInterface` class name          | Hallucinated — actual class is `BrokerAdapter`           | Run `pnpm typecheck` before creating PR             |
| 2026-04-09 | Codex    | PR #295 added `middleware.ts` alongside `proxy.ts` | Next.js rejects coexistence of middleware + proxy        | Check existing patterns before introducing new ones |
| 2026-04-09 | Codex    | PR #297 touched 64 files across 5 subsystems       | Too broad — impossible to review safely                  | Keep PRs under 20 files, one concern per PR         |

---

## Session Log

> Brief entry per agent session. Most recent first.

### 2026-04-17 — Copilot (Vercel preview smoke follow-up to PR #345)

**Goal**: Take over from PR #345 and apply the remaining fixes so the Vercel preview smoke check is correct, reliable, and mergeable.

**What changed**:

- `.github/workflows/vercel-preview-smoke.yml`: stopped using `mapfile < <(...)` under `set -e` (subshell failures were silently swallowed); resolver now runs into a tempfile and a non-zero exit aborts the step. Explicit preview deployment `failure`/`error`/`api_error`/`timeout` now fail the required check instead of warning-and-skipping. On push to `main`, the canonical alias fallback only runs for `not_found`/`inactive`/`timeout` — explicit prod `failure`/`error`/`api_error` fail the gate. Fork PRs without secrets are explicitly skipped with a warning. Health-check step receives `VERCEL_AUTOMATION_BYPASS_SECRET`.
- `scripts/resolve-vercel-deployment-url.sh`: rewrote to fetch only the latest deployment for `(sha, environment)` (was fetching up to 100 and could pick a stale earlier success while a newer one was still pending), wait through pending/in_progress/queued instead of returning stale data, and catch transport/HTTP errors so transient API failures emit `state=api_error` instead of crashing the resolver. Added `state=timeout` for the deployment-stuck-pending case. Header comment updated to enumerate all emitted states (`success|failure|error|inactive|not_found|api_error|timeout`).
- `scripts/health-check.sh`: added optional `VERCEL_AUTOMATION_BYPASS_SECRET` support — when set, sends `x-vercel-protection-bypass` (and `x-vercel-set-bypass-cookie: samesitenone`) on every probe so protected preview deployments respond instead of returning 401. No-op when unset, harmless on non-Vercel/unprotected hosts.
- `docs/runbooks/preview.md`: documented the bypass secret setup, the resolver state vocabulary, and that `failure`/`error`/`api_error` now fail the required gate.

**Findings confirmed from PR #345 evidence** (workflow run 24579770862, head SHA `67a542ab…`):

- Resolver correctly identified deployment `4403592940` and emitted `https://trading-kca552w77-steven-schlingmans-projects.vercel.app`.
- Health check failed because every probe returned HTTP 401 with Vercel "Authentication Required" — i.e. preview deployment protection, not an app bug.
- This confirmed the prompt's blocker hypothesis and made `VERCEL_AUTOMATION_BYPASS_SECRET` the correct minimal fix.

**Kept from PR #345 (verified, not regressed)**: dynamic `apps/web/src/app/robots.ts` with `getCanonicalSiteUrl`, deletion of stale `apps/web/public/robots.txt`, narrow `turbo.json passThroughEnv` entries (`CRON_SECRET`, `ALPACA_WEBHOOK_SECRET` are referenced by `apps/web/src/app/api/internal/cron/health/route.ts` and `apps/web/src/app/api/webhooks/alpaca/route.ts` respectively).

**Validation**: `bash -n scripts/resolve-vercel-deployment-url.sh scripts/health-check.sh`; `pnpm exec prettier --check` on changed files; `pnpm --filter @sentinel/web lint`; `git diff --check`.

**Manual follow-up required (Vercel + GitHub dashboards)**: generate a Protection Bypass for Automation secret in Vercel, save it in GitHub repo Actions secrets as `VERCEL_AUTOMATION_BYPASS_SECRET`. Without that step, same-repo preview smoke will keep failing with 401 — which is now the correct, loud signal rather than a silent skip.

### 2026-04-17 — Codex (Vercel deploy alignment)

**Goal**: Verify current Vercel deployment findings and remediate repo-side deployment workflow/canonical URL issues with minimal risk.

**What changed**:

- Rewrote `.github/workflows/vercel-preview-smoke.yml` to resolve deployment URLs from GitHub Deployments API for the current SHA (`Preview` on PRs, `Production` on `main`) instead of relying on `VERCEL_PREVIEW_SMOKE_URL`.
- Added `scripts/resolve-vercel-deployment-url.sh` helper to poll deployment status and return environment URL + state.
- Replaced static `apps/web/public/robots.txt` with dynamic `apps/web/src/app/robots.ts` so sitemap URL follows canonical URL helper logic.
- Added narrowly-scoped `tasks.build.passThroughEnv` entries (`CRON_SECRET`, `ALPACA_WEBHOOK_SECRET`) in `turbo.json` for runtime-only server route secrets without broadening cache keys.
- Updated `docs/runbooks/preview.md` with the new CI preview-smoke URL resolution behavior.

**Validation**: `bash -n scripts/resolve-vercel-deployment-url.sh scripts/health-check.sh scripts/smoke-test.sh`; `pnpm exec prettier --check .github/workflows/vercel-preview-smoke.yml turbo.json apps/web/src/app/robots.ts docs/runbooks/preview.md`; `pnpm --filter @sentinel/web lint`; `pnpm --filter @sentinel/web build`; `git diff --check`.

**Decisions**: Kept deployment/env-contract changes narrow due high risk; documented unresolved dashboard-only actions separately rather than making speculative repo changes.

### 2026-04-10 — Copilot (PR Guardian System)

**Goal**: Build automated guardrails to prevent AI agent drift and quality issues.

**What changed**:

- Created `scripts/pr-guardian.mjs` — 7-check automated PR quality gate
- Created `.github/workflows/pr-guardian.yml` — CI enforcement
- Created `.github/agents/repo-guardian.agent.md` — on-demand audit agent
- Updated `AGENTS.md` with PR quality gates and self-validation checklist
- Updated `.github/copilot-instructions.md` with scope/freshness rules
- Updated `.github/pull_request_template.md` with agent metadata fields

**Validation**: lint (3/3 pass), test (1122/1122 pass), build (3/3 pass)

**Decisions**: Delta-based file health (not absolute), import checks advisory-only,
overlap/staleness fail only with high-risk paths.

**Next steps**: Add pre-PR validation script, WORKLOG, worktree management, enhanced agent-ops.

### 2026-04-09 — Copilot (PR Audit & Consolidation)

**Goal**: Audit all 8 open PRs, validate main, close stale PRs.

**What changed**: Closed all 8 open PRs (#301, #300, #298, #297, #295, #288, #287, #283).
Deleted 8 stale remote branches. Validated main at `e42c779`.

**Validation**: install, lint (3/3), test (1596 total), build (3/3) — all pass.

**Decisions**: All 8 PRs superseded by consolidated merge PR #303. No cherry-picks needed.
