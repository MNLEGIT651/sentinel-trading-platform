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

### 2026-04-16 — Codex (Security hardening sprint)

**Goal**: Deliver focused fail-closed hardening for proxy/auth boundaries, runtime parity, readiness wiring, CI truthfulness, and readiness docs.

**What changed**:

- Removed fail-open role fallback in `requireRole`; missing/invalid profile role now denies access with explicit audit logging.
- Reworked web engine/agents proxy handlers to explicit allowlists with deny-by-default for unknown paths/mutations and operator checks on privileged mutations.
- Tightened production auth env behavior in `proxy.ts` + startup validation in `instrumentation.ts` to fail closed when auth config is missing in production runtime.
- Aligned timeout envelope (`strategy scan` proxy timeout reduced to 55s vs route maxDuration 60s).
- Fixed engine quote fail-open risk behavior by removing unsafe fallback pricing in order submission and adding regression test.
- Aligned readiness checks to `/ready` for deploy/startup paths (`apps/engine/railway.toml`, engine Docker healthcheck, compose healthcheck, smoke defaults, runbook docs).
- Fixed agents telemetry runtime drift by moving OTel packages into runtime dependencies and adding CI production artifact image builds.
- Upgraded CI validation to enforce web/agents coverage thresholds and lockfile-based Python dependency sync in CI.
- Extended route-security automation to include engine/agents proxy trust boundary allowlist checks.
- Added/updated docs and reports to reduce overclaims and add explicit readiness-matrix language.

**Validation**:

- Node workspace lint/typecheck/test/build and route security/script tests passed.
- Engine Python validations were attempted but blocked in this environment because `apps/engine/.venv` lacked `ruff`/`pytest`.

**Decisions**:

- Kept process-local rate limiting but documented limitations instead of over-claiming distributed protection.
- Avoided async proxy rearchitecture; applied minimal safe timeout alignment and explicit boundary policy enforcement.

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
