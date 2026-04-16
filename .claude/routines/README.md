# Sentinel Claude Code Routines

This directory is the single source of truth for every Claude Code routine this
repository runs. Each routine has:

1. An entry in [`manifest.yaml`](manifest.yaml).
2. A checked-in spec at `.claude/routines/<id>.md` (one of the files listed below).
3. A matching GitHub Action at `.github/workflows/routine-<id>.yml`.

The manifest, the specs, and the workflows are kept in lockstep by
`scripts/routines/verify-routine-sync.mjs`. Run:

```bash
pnpm routines:verify
```

…before opening a PR that touches anything in this directory or
`.github/workflows/routine-*.yml`.

## Routines

| ID | Display Name | Primary Trigger | Spec | Workflow |
|---|---|---|---|---|
| `morning-ops-commander` | Morning Ops Commander | schedule (daily) | [spec](morning-ops-commander.md) | [workflow](../../.github/workflows/routine-morning-ops-commander.yml) |
| `pr-intake-gatekeeper` | PR Intake Gatekeeper | GitHub `pull_request` | [spec](pr-intake-gatekeeper.md) | [workflow](../../.github/workflows/routine-pr-intake-gatekeeper.yml) |
| `post-deploy-runtime-sentinel` | Post-Deploy Runtime Sentinel | deploy / `workflow_run` bridge | [spec](post-deploy-runtime-sentinel.md) | [workflow](../../.github/workflows/routine-post-deploy-runtime-sentinel.yml) |
| `release-readiness-control-tower` | Release Readiness Control Tower | `workflow_dispatch` / API | [spec](release-readiness-control-tower.md) | [workflow](../../.github/workflows/routine-release-readiness-control-tower.yml) |
| `weekly-architecture-churn-audit` | Weekly Architecture and Churn Audit | schedule (weekly) | [spec](weekly-architecture-churn-audit.md) | [workflow](../../.github/workflows/routine-weekly-architecture-churn-audit.yml) |

## How this repo uses Claude Code routines

- **Routines** are Anthropic-managed cloud sessions that run on a schedule,
  from an API call, or from a GitHub event. They are listed and configured at
  `claude.ai/code/routines`, from the Claude Code desktop app, or via
  `/schedule` inside Claude Code (scheduled routines only).
- GitHub-triggered routines require the **Claude GitHub App** to be installed
  on `stevenschling13/Trading-App`.
- Each routine run is a fresh session — the routine prompt must carry all
  context it needs. Use the "Prompt Template" section of each spec.
- Routines count against the account's routine run allowance, so the paired
  GitHub Actions are built to be *observable on their own* when the native
  routine is disabled or not yet provisioned.

## Activation

Specs and workflows are **created** by this change. Native Claude routine
activation is a **manual step** that must be performed in the Claude Code app.
See [`docs/runbooks/claude-routines-activation.md`](../../docs/runbooks/claude-routines-activation.md)
for the exact click-by-click steps.

## Editing rules

- When you change a spec, update the manifest and run `pnpm routines:verify`.
- Every routine must stay paired with a workflow. Do not add an orphan spec.
- Do not invent new trigger types. The allowed values are:
  `schedule`, `api`, `github_event`, `workflow_dispatch`, `bridge`.
- Do not fabricate connectors, URLs, or secrets.
- Keep routine prompts in sync with repo docs (especially
  `AGENTS.md`, `docs/ai/working-agreement.md`, and
  `docs/runbooks/production.md`).
