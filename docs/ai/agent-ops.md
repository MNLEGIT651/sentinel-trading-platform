# Agent Operations Guide

Use this guide to keep Claude Code and Codex aligned across sessions.

## Purpose

This document defines how agents:

- decide what to work on next
- claim work without colliding
- report status in a shared format
- resume from the current state of the project without re-auditing everything

## Mandatory startup workflow

At the start of every session:

1. Read `AGENTS.md`.
2. Read, in order:
   - `docs/ai/working-agreement.md`
   - `docs/ai/architecture.md`
   - `docs/ai/commands.md`
   - `docs/ai/review-checklist.md`
3. Read `WORKLOG.md` — check for failed approaches and active context.
4. Check open issues and confirm assignment/ownership for the task.
5. Check for open PRs: `gh pr list --state open`
6. Read `docs/ai/state/project-state.md` as secondary context/history (not live lock state).
7. If the session is executing roadmap work, read `docs/ai/roadmaps/2026-03-20-deployment-readme-roadmap.md`.
8. Link branch/PR to one issue or tightly related issue bundle before editing files when possible.
9. Confirm the files you plan to touch are not already active in another open PR.

If issue/PR state and docs disagree, treat GitHub issue assignment + open PR linkage as authoritative and note the mismatch in your handoff.

## Coordination protocol

The primary live coordination surface is GitHub issue assignment + PR linkage. The optional summary entry in `docs/ai/state/project-state.md` should include:

- ticket ID
- title
- status: queued | active | blocked | done
- owner: Claude | Codex | Human
- branch or worktree name
- allowed scope
- validation required
- last updated date
- brief note

### Rules

- One owner per file at a time.
- Prefer one ticket per branch.
- If you need to expand scope, update the task entry before editing the new files.
- If blocked, change status to `blocked` and write the blocker in one sentence.
- Use issue comments/PR description for same-day status; use `project-state.md` only as secondary summary/history.

## Handoff protocol

When ending a session, update the issue/PR with:

- current status
- what changed
- what stayed intentionally unchanged
- commands run and pass/fail status
- next recommended action
- unresolved risks or assumptions

Also update `WORKLOG.md`:

- Add a session log entry (date, agent, goal, changes, decisions)
- Record any failed approaches in the Failed Approaches Log
- Update Active Context if architecture decisions changed

Optionally update `docs/ai/state/project-state.md` as a historical summary if needed.

## Session priority order

When choosing work, prefer:

1. `active` tasks already assigned to you on the current branch
2. `blocked` tasks you can unblock with docs, review, or narrow implementation
3. the next `queued` ticket in roadmap order
4. only after that, ad hoc improvements

## Decision rules for Claude and Codex

### Claude Code should prefer

- ambiguous architecture questions
- reviews and audits
- decomposition of large tasks
- cross-service risk analysis

### Codex should prefer

- isolated implementation tasks
- tests and fixtures
- docs creation and cleanup
- mechanical config alignment

## Validation discipline

Use the canonical commands from `docs/ai/commands.md`.

Always record:

- exact command
- pass/fail
- skipped commands and why

## Definition of done for roadmap tickets

A roadmap ticket is done only when:

- the scoped files are updated
- required validation has been run or an explicit environment limitation is recorded
- issue + PR linkage reflects done status
- the handoff states the next dependency or next available ticket

## Anti-drift rule

Do not create a second source of truth for status.

Use these artifacts only:

- GitHub issues + PR linkage for live status and ownership
- `WORKLOG.md` for cross-session context and failed approaches
- `docs/ai/state/project-state.md` for secondary summary/history
- roadmap documents for sequencing and task definitions

## Worktree isolation (required for parallel agents)

When multiple agents are active, each agent MUST work in its own Git worktree:

```bash
# Create an isolated worktree for your task
bash scripts/agent-worktree.sh create feat/my-feature claude

# List active worktrees
bash scripts/agent-worktree.sh list

# Remove after merging
bash scripts/agent-worktree.sh remove feat/my-feature

# Clean up all merged worktrees
bash scripts/agent-worktree.sh clean
```

Rules:

- Never edit files in the main worktree while another agent is using it
- Always `pnpm install` in a new worktree before starting work
- Always `pnpm pre-pr` before pushing from a worktree
- Delete worktrees after the branch is merged
- If the worktree script is unavailable, manually create with `git worktree add`

## Pre-PR validation (mandatory before opening any PR)

Before creating a pull request, run the full validation gate:

```bash
pnpm pre-pr        # full check: guardian + lint + test + build
pnpm pre-pr:quick  # guardian checks only (for draft PRs)
```

This catches:

- Scope violations (>20 files, >3 workspace areas)
- Staleness (behind main)
- File health issues (>500 line files)
- High-risk path changes
- Overlap with open PRs
- Lint, typecheck, test, build failures

**A PR opened without passing `pnpm pre-pr` will be rejected by CI.**

## Open PR limit

No agent may have more than 2 open PRs at any time. Before creating a new PR:

```bash
gh pr list --state open --author @me
```

If 2+ are already open, finish or close one first.
