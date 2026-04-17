# Sentinel Trading Platform

> Universal instructions for Codex CLI, Claude Code, and other coding agents.
> Read this file first, then the docs in `docs/ai/`. Keep tool-specific behavior in
> `CLAUDE.md` or local agent config.

Evidence-based systematic trading platform. Turborepo monorepo, three apps, shared types,
and a Python engine that is validated separately from the Node workspaces.

## Read Order

1. `WORKLOG.md` — check active context and failed approaches
2. `docs/ai/working-agreement.md`
3. `docs/ai/architecture.md`
4. `docs/ai/commands.md`
5. `docs/ai/review-checklist.md`
6. `docs/ai/state/project-state.md` _(secondary view — check GitHub issues for live status)_
7. `docs/ai/agent-ops.md`
8. `CLAUDE.md` when using Claude Code

## Repository Map

```text
apps/web/        Next.js 16 dashboard (TypeScript, port 3000)
apps/engine/     Python FastAPI quant engine (port 8000)
apps/agents/     TypeScript agent orchestrator (port 3001)
packages/shared/ Shared TypeScript contracts (@sentinel/shared)
supabase/        PostgreSQL migrations and seed data
```

## Non-Negotiables

- Use a fresh branch or worktree for every scoped task. Do not share a branch between agents.
- One agent per file at a time. If a file is already in flight elsewhere, stop and coordinate.
- Every task and PR must state outcome, scope, validation, and forbidden changes.
- Do not change `package.json`, `pnpm-lock.yaml`, `turbo.json`, `vercel.json`, `.env.example`,
  `supabase/migrations/*`, or shared contracts without explicit scope.
- Web-to-engine requests must go through `apps/web/src/lib/engine-fetch.ts`. Do not add raw
  client-side engine URLs or auth headers ad hoc.
- Do not present fallback data as live data. Keep `OfflineBanner` and `SimulatedBadge` behavior intact.
- No secrets in code, docs, tests, fixtures, screenshots, or commits.
- Prefer minimal diffs. Do not refactor unrelated code while implementing a narrow task.

## PR Quality Gates (Enforced by CI)

The `PR Guardian` workflow (`scripts/pr-guardian.mjs`) runs on every PR and will **block merge**
if any of the following are violated:

| Rule                  | Threshold                                                        | Action                                  |
| --------------------- | ---------------------------------------------------------------- | --------------------------------------- |
| **File count**        | >30 files                                                        | ❌ Fail — split the PR                  |
| **Line churn**        | >1500 lines                                                      | ❌ Fail — reduce scope                  |
| **File size growth**  | Creating a file >500 lines, or growing a large file by >50 lines | ❌ Fail — decompose first               |
| **Staleness + risk**  | >15 commits behind `main` AND touches high-risk paths            | ❌ Fail — rebase first                  |
| **High-risk overlap** | >8 files shared with another PR in high-risk paths               | ❌ Fail — coordinate or close duplicate |
| **Workspace spread**  | >5 workspace areas                                               | ❌ Fail — split by concern              |

Advisory warnings (do not block, but expect review feedback):

- File count >20, line churn >800
- Any changed file already >400 lines
- > 3 files overlap with another open PR
- Unresolved relative imports (possible hallucination)
- > 3 workspace areas touched

### Self-Validation Checklist (Run Before Creating a PR)

Every agent must verify these before opening a PR. Use the automated gate:

```bash
# Preferred: automated pre-PR gate (runs all checks below)
pnpm pre-pr

# Quick mode for draft PRs (guardian checks only, no build/test)
pnpm pre-pr:quick
```

Or manually:

```bash
# 1. Branch is fresh from main
git fetch origin && git rev-list --count HEAD..origin/main  # must be ≤5

# 2. Scope is reasonable
git diff --stat origin/main | tail -1   # aim for <20 files

# 3. No file exceeds 400 lines
find . -name '*.ts' -o -name '*.tsx' -o -name '*.py' | \
  xargs wc -l | sort -rn | head -20    # check top files

# 4. All imports resolve (TypeScript)
pnpm typecheck                          # catches hallucinated types

# 5. Standard validation
pnpm lint && pnpm test && pnpm build    # Node workspaces
pnpm lint:engine && pnpm test:engine    # Python engine (if touched)

# 6. Check for PR overlap
gh pr list --state open                 # must have <2 of your PRs
```

## Validation Rules

- `pnpm lint`, `pnpm test`, and `pnpm build` cover the Node/Turborepo workspaces only.
- Engine checks are separate. Use `pnpm lint:engine`, `pnpm format:check:engine`, and
  `pnpm test:engine`.
- Before handoff, list the exact commands you ran and whether they passed.
- If you change shared types, API contracts, env contracts, or migrations, validate every
  affected surface, not just the file you edited.

## Sensitive Paths

- `apps/web/src/lib/engine-fetch.ts`
- `apps/web/src/lib/engine-client.ts`
- `apps/engine/src/api/main.py`
- `apps/engine/src/config.py`
- `packages/shared/src/*`
- `supabase/migrations/*`
- `.github/workflows/ci.yml`

## Execution State

- Before editing files, check open GitHub issues for the task you are claiming. Assign the issue to yourself (or note "untracked audit") before starting.
- Use `docs/ai/agent-ops.md` for the startup checklist, handoff format, and session priority order.
- GitHub issue assignment + PR linkage is the authoritative coordination surface. `docs/ai/state/project-state.md` is a secondary summary view only — do not treat it as live truth and do not block on it being current.
- If no issue exists for your task, note "untracked audit" in the PR description.

## Collaboration Defaults

- Claude is best used for ambiguous debugging, architecture choices, and review.
- Codex is best used for isolated implementation, test additions, and mechanical changes.
- Small tasks do not need a multi-step handoff; large or risky tasks do.
- CI is the final gate. Prompts and repo docs guide behavior, but passing checks decide merge readiness.
