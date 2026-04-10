# Repository Consolidation & Production Readiness Report

> **Date**: 2026-04-10
> **Agent**: repo-commander (Copilot)
> **Main SHA**: `6cb285d` → post-consolidation: `f877435`
> **Scope**: Full repository audit, branch consolidation, production readiness gate

---

## Executive Summary

This report documents a comprehensive repository consolidation of the Sentinel
Trading Platform. 16 remote branches were audited, 5 commits cherry-picked from
2 high-value branches, 4 open PRs classified for closure, and all validation passes.

### Consolidation History

| Date       | Action                           | Result                                          |
| ---------- | -------------------------------- | ----------------------------------------------- |
| 2026-04-09 | Closed 8 PRs, deleted 8 branches | Main validated at `e42c779`                     |
| 2026-04-10 | Added PR Guardian system         | Automated quality gates                         |
| 2026-04-10 | **This consolidation**           | Cherry-picked 5 commits, classified 16 branches |

---

## Production Readiness Audit

### ✅ Critical Path Assessment

| Area                       | Status       | Notes                                                                             |
| -------------------------- | ------------ | --------------------------------------------------------------------------------- |
| **Web→Engine proxy**       | ✅ Healthy   | `engine-fetch.ts` uses same-origin `/api/engine` proxy; no raw URLs               |
| **Web→Agents proxy**       | ✅ Healthy   | Routes through `/api/agents/[...path]` server-side proxy                          |
| **Auth (proxy.ts)**        | ✅ Healthy   | Supabase session refresh, rate limiting, proper 401/redirect handling             |
| **Environment validation** | ✅ Healthy   | `env.ts` validates required/recommended vars at startup                           |
| **Service config**         | ✅ Healthy   | Production-safe: no local URLs in production, fail-closed on missing config       |
| **Service proxy**          | ✅ Healthy   | Retry logic, timeout tiers, body size limits, correlation IDs, structured logging |
| **CSRF protection**        | ✅ Present   | Origin header validation with Referer/X-Requested-With fallback                   |
| **Rate limiting**          | ✅ Present   | API proxy rate limiting + mutation-specific limits                                |
| **Engine config**          | ✅ Healthy   | Pydantic settings with proper validation and warnings for optional keys           |
| **Agents env**             | ✅ Healthy   | 7 required vars validated at boot, clear error messages                           |
| **Deployment (Vercel)**    | ✅ Healthy   | `vercel.json` with turbo build, region pinning, cron health check                 |
| **Deployment (Railway)**   | ✅ Healthy   | Health checks, restart policy, watch patterns for engine + agents                 |
| **CI pipeline**            | ✅ Healthy   | 4 jobs: commit verification, test-web, test-engine, test-agents + security audit  |
| **Security workflows**     | ✅ Present   | CodeQL, Gitleaks, dependency review, scorecards                                   |
| **Branch cleanup**         | ✅ Automated | Weekly stale-branch-cleanup workflow with 14-day threshold                        |
| **PR quality gates**       | ✅ Enforced  | PR Guardian checks scope, staleness, overlap, file health                         |

### ✅ Database Migrations

33 sequential migrations present, covering:

- Initial schema through to latest indexes/RLS tightening
- Gap in numbering (00018 → 00021) is noted but not blocking
- Migrations include proper RLS policies and optimization passes
- Recent migrations focus on security hardening (RLS, user data isolation)

### ✅ Shared Contracts (`packages/shared/src/`)

Clean shared types package with:

- `types.ts` — core type definitions
- `advisor.ts` — advisor-specific types
- `state-machine.ts` — state machine utilities
- `onboarding-state.ts` — onboarding flow states
- `index.ts` — barrel export
- Tests in `__tests__/`

### ✅ Environment Contract (`.env.example`)

Comprehensive, well-documented template covering:

- Supabase (3 key resolution paths)
- Internal services (ENGINE_URL, AGENTS_URL)
- Market data & broker (Polygon, Alpaca)
- Agent configuration
- Observability (OTEL opt-in)
- Clear separation by runtime ([web], [engine], [agents])

---

## Architecture Health

### Web App (`apps/web/`)

- **Framework**: Next.js 16 with `proxy.ts` (no middleware.ts conflict)
- **Auth**: Supabase session management via server-side updateSession
- **API proxy**: All backend calls routed through `/api/engine/*` and `/api/agents/*`
- **Error handling**: Route-level error boundaries, service error serialization
- **Data provenance**: DataProvenance component tracks Live/Cached/Simulated/Offline modes
- **Tests**: 1100+ tests across unit/component/page tests

### Engine (`apps/engine/`)

- **Framework**: FastAPI with Pydantic settings
- **Broker**: Abstract `BrokerAdapter` with Alpaca paper/live support
- **Risk**: Pre-trade checks with `PreTradeCheck` result type
- **Lint**: Ruff check + format
- **Tests**: 470+ pytest tests

### Agents (`apps/agents/`)

- **Framework**: Express.js with modular routes
- **Orchestration**: Agent cycle with Market Sentinel, Strategy Analyst, Risk Monitor
- **Workflows**: Durable workflow runner/worker pattern
- **Auth**: JWT verification middleware
- **Tests**: Vitest test suite

---

## Branch Audit Table (16 branches)

| #   | Branch                                                  | Ahead | Behind | Files | PR          | CI          | Classification    | Reason                                             |
| --- | ------------------------------------------------------- | ----- | ------ | ----- | ----------- | ----------- | ----------------- | -------------------------------------------------- |
| 1   | `copilot/analyze-repo-history`                          | 0     | 6      | 0     | —           | —           | **DISCARD**       | Fully merged into main                             |
| 2   | `copilot/fix-ci-cd-validation-pipeline`                 | 0     | 0      | 0     | —           | —           | **DISCARD**       | Fully merged into main                             |
| 3   | `claude/fix-ci-cleanup-TWR3y`                           | 2     | 9      | 17    | #292 closed | —           | **DISCARD**       | 9 behind, PR closed, stale                         |
| 4   | `codex/fix-broken-ci-pipeline-and-clean-up-repo`        | 1     | 9      | 17    | #291 closed | —           | **DISCARD**       | 9 behind, PR closed, stale                         |
| 5   | `codex/upgrade-desktop-trading-app-to-workstation`      | 1     | 9      | 8     | #289 closed | —           | **DISCARD**       | 9 behind, PR closed, stale                         |
| 6   | `feat/professional-ui-polish`                           | 1     | 9      | 5     | #285 closed | —           | **DISCARD**       | 9 behind, PR closed, stale                         |
| 7   | `fix/typecheck-errors`                                  | 1     | 9      | 22    | #284 closed | —           | **DISCARD**       | 9 behind, PR closed, stale                         |
| 8   | `copilot/fix-commit-signature-issues`                   | 4     | 9      | 3     | #290 closed | —           | **DISCARD**       | 9 behind, PR closed, superseded by #303            |
| 9   | `chore/prod-readiness-20260409`                         | 1     | 6      | 5     | #296 closed | —           | **DISCARD**       | Superseded by #303, PR closed                      |
| 10  | `copilot/create-api-agent-for-supabase`                 | 2     | 5      | 6     | none        | —           | **DISCARD**       | 5 behind, agent config only, no PR                 |
| 11  | `claude/optimize-deployment-pipeline-GTBI5`             | 2     | 4      | 6     | #304 open   | CONFLICTING | **DISCARD**       | Merge conflicts, rewrites CI workflows (high-risk) |
| 12  | `codex/convert-system-to-live-production-functionality` | 1     | 0      | 10    | #307 open   | CI fail     | **DISCARD**       | Overlaps with #13, CI failures                     |
| 13  | `copilot/audit-remove-simulated-behavior`               | 1     | 0      | 12    | none        | —           | **DISCARD**       | Overlaps with #12, no PR, incomplete               |
| 14  | `claude/fix-image-issue-EMpi1`                          | 2     | 0      | 8     | #305 open   | ✅ Core CI  | **CHERRY-PICKED** | Graceful error UX, humanizeFetchError utility      |
| 15  | `claude/audit-production-readiness-5tYWd`               | 3     | 0      | 9     | #306 open   | ✅ Core CI  | **CHERRY-PICKED** | Live execution gate, security upgrade              |
| 16  | `copilot/consolidate-production-ready-main`             | 7     | 0      | —     | this PR     | —           | **ACTIVE**        | Consolidation branch (this work)                   |

### Commits Cherry-Picked

| Commit    | Source Branch                           | Description                                                            |
| --------- | --------------------------------------- | ---------------------------------------------------------------------- |
| `3b71a4b` | claude/fix-image-issue-EMpi1            | fix(markets): gracefully degrade chart when bars endpoint errors       |
| `2fd5baf` | claude/fix-image-issue-EMpi1            | fix(web): graceful degradation + friendly error copy across pages      |
| `ba89de7` | claude/audit-production-readiness-5tYWd | feat(engine): fail-closed live execution gate in order submission path |
| `7c87f81` | claude/audit-production-readiness-5tYWd | fix(engine): match Alpaca paper endpoint by hostname allowlist         |
| `fcc2134` | claude/audit-production-readiness-5tYWd | fix(security): upgrade next to 16.2.3, override axios>=1.15.0          |

---

## Validation Results (Post-Consolidation)

| Command                    | Result  | Details                               |
| -------------------------- | ------- | ------------------------------------- |
| `pnpm install`             | ✅ PASS | 6.9s, frozen-lockfile                 |
| `pnpm lint`                | ✅ PASS | 3 tasks, 0 errors                     |
| `pnpm test`                | ✅ PASS | **1136 tests**, 106 files, 3 packages |
| `pnpm build`               | ✅ PASS | 3 tasks, 28s                          |
| `pnpm lint:engine`         | ✅ PASS | All checks passed                     |
| `pnpm format:check:engine` | ✅ PASS | 91 files already formatted            |
| `pnpm test:engine`         | ✅ PASS | **480 tests** in 3.86s                |
| `pnpm test:scripts`        | ✅ PASS | 9 tests                               |

**Total: 1625 tests passing (1136 Node + 480 Python + 9 script)**

---

## Cleanup Commands

### Step 1: Close remaining open PRs

```bash
# Close PR #304 — claude/optimize-deployment-pipeline (CONFLICTING, high-risk CI)
gh pr close 304 --repo stevenschling13/Trading-App --comment "Closed: consolidation. Branch conflicts with main and rewrites CI workflows."

# Close PR #305 — claude/fix-image-issue (cherry-picked into consolidation PR)
gh pr close 305 --repo stevenschling13/Trading-App --comment "Closed: cherry-picked commits 3b71a4b and 2fd5baf into consolidation PR."

# Close PR #306 — claude/audit-production-readiness (cherry-picked into consolidation PR)
gh pr close 306 --repo stevenschling13/Trading-App --comment "Closed: cherry-picked commits ba89de7, 7c87f81, fcc2134 into consolidation PR."

# Close PR #307 — codex/convert-system (overlaps, CI fails)
gh pr close 307 --repo stevenschling13/Trading-App --comment "Closed: consolidation. Overlaps with other simulated-removal work. CI failures."
```

### Step 2: Delete all non-main remote branches

```bash
# Fully merged (0 ahead)
git push origin --delete copilot/analyze-repo-history
git push origin --delete copilot/fix-ci-cd-validation-pipeline

# Stale with closed PRs (9+ behind)
git push origin --delete claude/fix-ci-cleanup-TWR3y
git push origin --delete codex/fix-broken-ci-pipeline-and-clean-up-repo
git push origin --delete codex/upgrade-desktop-trading-app-to-workstation
git push origin --delete feat/professional-ui-polish
git push origin --delete fix/typecheck-errors
git push origin --delete copilot/fix-commit-signature-issues

# Superseded
git push origin --delete chore/prod-readiness-20260409
git push origin --delete copilot/create-api-agent-for-supabase

# Conflicting / overlapping with open PRs
git push origin --delete claude/optimize-deployment-pipeline-GTBI5
git push origin --delete codex/convert-system-to-live-production-functionality
git push origin --delete copilot/audit-remove-simulated-behavior

# Cherry-picked (close PRs first, then delete)
git push origin --delete claude/fix-image-issue-EMpi1
git push origin --delete claude/audit-production-readiness-5tYWd

# This branch (delete AFTER merging consolidation PR)
# git push origin --delete copilot/consolidate-production-ready-main
```

### Step 3: Local cleanup

```bash
# Delete all non-main local branches
git branch | grep -v '^\*' | grep -v 'main' | xargs -r git branch -D

# Prune stale remote refs
git remote prune origin

# Remove backup after confirming stability (wait 1 week)
# git push origin --delete backup/pre-consolidation-20260410
# git branch -D backup/pre-consolidation-20260410
```

### Step 4: Enable auto-delete

Go to GitHub → Settings → General → Pull Requests:

- ✅ Automatically delete head branches

---

## Rollback Instructions

If the consolidation introduced issues:

```bash
# Option 1: Reset to backup (if no one else has pulled)
git checkout main
git reset --hard backup/pre-consolidation-20260410
git push --force-with-lease origin main

# Option 2: Revert specific cherry-picked commits (safer)
git checkout main
git revert --no-edit f877435 b5fe914 2902039 5858f41 70d641c
git push origin main
```

---

## Branch Hygiene Rules (Going Forward)

1. **One task per branch** — no omnibus branches
2. **No long-lived AI experiment branches** — merge or discard within 7 days
3. **14-day auto-cleanup** for all stale branches (enforced by `stale-branch-cleanup.yml`)
4. **Shared contracts, workflows, migrations, and deployment config require isolated PRs**
5. **Merge only after passing lint, typecheck, tests, and build**
6. **Prefer cherry-pick** over broad merges for mixed-quality AI branches
7. **Auto-delete on merge** — enable in GitHub repo settings
8. **PR Guardian** enforces scope, staleness, overlap checks on every PR

---

## Status: ✅ PRODUCTION READY

Post-consolidation main includes:

- All prior production-ready work from `6cb285d`
- **New**: Graceful error degradation across dashboard pages (humanizeFetchError)
- **New**: Fail-closed live execution gate in engine order submission path
- **New**: Alpaca paper endpoint detection via hostname allowlist (not substring)
- **New**: Next.js 16.2.3 security upgrade + axios vulnerability override
- **New**: Branch consolidation tooling (`scripts/consolidate-branches.sh`)

All 1625 tests pass. All linters clean. Build succeeds.
