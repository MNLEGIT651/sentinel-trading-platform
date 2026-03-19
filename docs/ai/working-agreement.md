# AI Working Agreement

This repo supports both Claude Code and Codex. The goal is not to make them behave identically;
the goal is to make them converge on the same repo rules, task boundaries, and validation bar.

## Ownership

- Human owner: product intent, security-sensitive approval, schema approval, release judgment.
- Claude Code: investigation, architecture, debugging, decomposition, review.
- Codex: isolated implementation, test additions, repetitive edits, branch-based execution.

## Mandatory Task Contract

Every AI task should include these fields, whether it starts in chat, an issue, or a PR:

1. Outcome: the user-visible or system-visible result.
2. Scope: files or modules that may change.
3. Validation: commands that must run before handoff.
4. Forbidden changes: paths or behaviors that must stay untouched.

If any of those fields are missing, the agent should infer the smallest safe scope and state it.

## Branch And Worktree Rules

- One task, one branch.
- Use a separate worktree for parallel work when more than one agent is active.
- Never let two agents edit the same file at the same time.
- Rebase or merge only after the owning agent finishes and the branch passes validation.

Recommended branch names:

- `feat/<area>-<outcome>`
- `fix/<area>-<bug>`
- `chore/<area>-<maintenance>`
- `docs/<area>-<topic>`

## Stop-And-Ask Changes

These changes require explicit human approval or a very clear task scope before editing:

- `supabase/migrations/*`
- `package.json`
- `pnpm-lock.yaml`
- `.env.example`
- `.github/workflows/*`
- `vercel.json`
- shared contracts in `packages/shared/src/*`
- engine auth or config in `apps/engine/src/api/main.py` and `apps/engine/src/config.py`

## Repo-Specific Guardrails

- Web client calls to the engine must use `apps/web/src/lib/engine-fetch.ts`.
- Server-side engine access in the agents app goes through `apps/agents/src/engine-client.ts`.
- Do not add API key entry forms to the settings page.
- Keep offline states visible with `OfflineBanner`.
- Keep simulated or fallback market data labeled with `SimulatedBadge`.

## Collaboration Loops

Use the lightest loop that fits the task.

### Small Fix

1. One agent implements on a fresh branch.
2. Run the targeted validation from `docs/ai/commands.md`.
3. Open a PR with the required scope and validation details.

### Bug Or Ambiguous Failure

1. Claude reproduces or narrows the root cause.
2. Codex or Claude implements the fix on an isolated branch.
3. Claude or the human reviewer checks for contract drift and missing tests.

### Large Refactor

1. Claude writes the decomposition and identifies shared-risk boundaries first.
2. Codex handles bounded subtasks on separate branches or worktrees.
3. Final review checks architecture consistency before merge.

## Handoff Standard

Every handoff or PR must include:

- what changed
- what stayed intentionally unchanged
- exact commands run
- pass/fail status
- unresolved risks or assumptions

Use `docs/ai/task-template.md` when you need a copy-paste prompt skeleton.
