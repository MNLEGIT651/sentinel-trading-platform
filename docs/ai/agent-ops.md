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
3. Read `docs/ai/state/project-state.md`.
4. If the session is executing roadmap work, read `docs/ai/roadmaps/2026-03-20-deployment-readme-roadmap.md`.
5. Claim exactly one ticket or tightly related ticket bundle in `project-state.md` before editing files.
6. Confirm the files you plan to touch are not already claimed by another active task.

If the project state and the code disagree, update `project-state.md` first or explicitly note the mismatch in your handoff.

## Claim protocol

Each active task entry in `docs/ai/state/project-state.md` must include:
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

## Handoff protocol

When ending a session, update the task entry with:
- current status
- what changed
- what stayed intentionally unchanged
- commands run and pass/fail status
- next recommended action
- unresolved risks or assumptions

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
- `project-state.md` is updated
- the handoff states the next dependency or next available ticket

## Anti-drift rule

Do not create a second source of truth for status.

Use these artifacts only:
- `docs/ai/state/project-state.md` for live status
- roadmap documents for sequencing and task definitions
- issues/PRs for review and merge discussion
