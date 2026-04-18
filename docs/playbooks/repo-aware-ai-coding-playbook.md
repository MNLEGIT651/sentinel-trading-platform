# Repo-Aware AI Coding Playbook

Default workflow for any AI-assisted change in this repo. Start here before
dispatching a task to Claude Code, Codex, or the GitHub Copilot coding agent.

See also: `AGENTS.md`, `CLAUDE.md`, `docs/ai/working-agreement.md`,
`docs/ai/commands.md`, `docs/playbooks/contract-safe-change-playbook.md`.

## Default Task Brief

Every non-trivial AI task must include these five fields. If the caller does
not provide them, the agent infers the smallest safe scope and states it
before editing.

1. **Outcome** — user-visible or system-visible result.
2. **Scope** — files or modules that may change.
3. **Validation** — commands that must run before handoff
   (from `docs/ai/commands.md`).
4. **Forbidden changes** — paths or behaviors that must stay untouched.
5. **Boundary notes** — the proxy/auth/contract seams the change touches.

### Example

```text
Outcome: Add structured logging to web route handlers without changing proxy behavior.
Scope:   apps/web/src/app/api/**, shared logger utility if needed.
Validation: pnpm lint, pnpm test:web, pnpm --filter @sentinel/web build.
Forbidden changes: no auth policy changes, no direct backend URL calls,
                   no packages/shared edits.
Boundary notes: must continue to route engine calls through engine-fetch.ts;
                must not weaken proxy CSRF enforcement.
```

## Model Roles

This repo already distinguishes Claude and Codex at the policy level. Keep
the split explicit when dispatching work.

| Role                           | Best fit in this repo                                                             |
| ------------------------------ | --------------------------------------------------------------------------------- |
| **Claude Code**                | Investigation, decomposition, debugging, architecture, review.                    |
| **Codex**                      | Bounded implementation, test additions, mechanical or repetitive edits.           |
| **GitHub Copilot coding agent** | Issue-to-PR delegation and PR-side review support inside GitHub-native workflows. |

When in doubt, use Claude to produce the task brief and decomposition, then
hand bounded subtasks to Codex or a GitHub-native agent.

## Changed-Scope Validation

Prefer the minimum correct validation set for the area you changed. Two
entrypoints:

- `pnpm validate:changed` — auto-detects touched areas from
  `git diff --name-only origin/main...HEAD` and runs matching commands.
- `pnpm validate:changed --dry-run` — preview what would run.

Full-gate validation (`pnpm pre-pr`) is still required before opening a PR.
Use changed-scope validation during implementation to keep iteration fast
without letting the diff drift.

## Stop Conditions

Stop and escalate (or hand off to `contract-guardian` for review) before
editing if the task touches any of these paths:

- `apps/engine/src/config.py`
- `apps/engine/src/api/main.py`
- `apps/web/src/proxy.ts`
- `apps/web/src/lib/engine-fetch.ts`
- `apps/web/src/lib/engine-client.ts`
- `packages/shared/src/**`
- `supabase/migrations/**`
- `.github/workflows/**`
- `.env.example`, `package.json`, `pnpm-lock.yaml`, `turbo.json`, `vercel.json`

For any of these, consult `docs/playbooks/contract-safe-change-playbook.md`
before proposing edits.

## PR Sizing And Coordination

- One task, one branch. Prefer a worktree for parallel work
  (`bash scripts/agent-worktree.sh create <branch> <agent-name>`).
- Keep PRs under 20 files and one concern per PR. Guardian fails at >30 files
  or >1500 lines churn; see `scripts/pr-guardian.mjs`.
- Claim work by GitHub issue assignment (or "untracked audit" in the first
  commit message). `docs/ai/state/project-state.md` is a summary view, not a
  lock file.
- Run `pnpm pre-pr:quick` periodically during implementation to catch drift
  before it compounds.

## Handoff Standard

Every handoff or PR body must include:

- what changed
- what stayed intentionally unchanged
- exact commands run (with pass/fail per command)
- skipped validations with reason
- unresolved risks or assumptions

Reporting format is specified in `docs/ai/commands.md` under "Pass/Fail
Reporting Format". Use ✅ PASS, ❌ FAIL, or ⏭️ SKIPPED.
