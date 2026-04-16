# Claude Code Routines — Operator Guide

This is the in-repo reference for operators and reviewers working with the
Sentinel Trading Platform's Claude Code routines. It explains what each
routine is for, how its paired GitHub Action relates to it, and what to look
for when something goes wrong.

The single source of truth for the routine/workflow pairing is
[`.claude/routines/manifest.yaml`](../../.claude/routines/manifest.yaml).
For step-by-step activation, see
[`docs/runbooks/claude-routines-activation.md`](../runbooks/claude-routines-activation.md).

## How routines are structured here

Each routine has three artifacts that must stay in sync:

| Artifact | Path |
|---|---|
| Manifest entry | `.claude/routines/manifest.yaml` |
| Routine spec | `.claude/routines/<id>.md` |
| Paired GitHub Action | `.github/workflows/routine-<id>.yml` |

Run `pnpm routines:verify` before you push anything that touches either
`.claude/routines/**` or `.github/workflows/routine-*.yml`.

## The five routines

### 1. Morning Ops Commander — `morning-ops-commander`

- Daily (13:30 UTC) ops report: CI, PRs, issues, security, deploys, branches, deps.
- Primary trigger: Claude Code **schedule**. Paired workflow runs on the same
  schedule for dry-run parity and in-repo artifacts.
- Output: GitHub issue `[ops] Morning Ops Report — YYYY-MM-DD`
  (labels `ops,report`), plus `morning-ops-report-<run_id>` artifact.
- Related skill: `.claude/skills/sentinel-ops-commander/SKILL.md`.

### 2. PR Intake Gatekeeper — `pr-intake-gatekeeper`

- Runs on every `pull_request` event (non-draft).
- Primary trigger: Claude Code **GitHub event**. Paired workflow normalizes
  the PR payload and emits a workflow summary fallback.
- Output: single comment with the marker
  `<!-- sentinel:pr-intake-gatekeeper -->` on the PR.
- Complements — does not replace — `pr-guardian.yml`, which remains the
  merge-blocking gate.

### 3. Post-Deploy Runtime Sentinel — `post-deploy-runtime-sentinel`

- Runs on `workflow_run` completion (Vercel Preview Smoke, CI),
  `deployment_status`, and `workflow_dispatch`.
- Primary trigger: Claude Code **GitHub event (bridge)**. Paired workflow
  runs `scripts/health-check.sh` when possible and uploads
  `post-deploy-bridge-<sha>-<run>` as the Claude-routine input.
- Output: PR comment on preview, workflow summary on success, or
  `ops,incident,deploy` issue on production `RED`.

### 4. Release Readiness Control Tower — `release-readiness-control-tower`

- Manual `workflow_dispatch` (or API trigger). Strictest routine.
- Preflight runs `pnpm test:scripts`, `pnpm lint`, `pnpm typecheck` and
  refuses to proceed if `rollback_plan_confirmed=false`.
- Output: workflow summary verdict, and a `release,readiness` issue on
  `NO-GO`.
- Never auto-deploys, auto-tags, or auto-merges.

### 5. Weekly Architecture and Churn Audit — `weekly-architecture-churn-audit`

- Runs Mondays at 14:00 UTC (or on dispatch).
- Paired workflow gathers churn, file sizes, large growth, PR history, and
  CI flakiness signals and uploads them as `weekly-arch-audit-<run_id>`.
- Output: weekly issue `[arch] Weekly Architecture & Churn Audit — YYYY-Www`
  (labels `ops,report,architecture`).

## Anti-drift checks

`scripts/routines/verify-routine-sync.mjs` is run:

- Locally via `pnpm routines:verify`.
- In every paired routine workflow as the first step (scoped with `--only <id>`).

The verifier blocks CI when:

- the manifest is missing required fields,
- the spec file is missing or doesn't reference its manifest id / workflow,
- the workflow is missing or doesn't invoke the verifier with the correct id,
- an orphan spec or workflow exists without a manifest entry.

## When something goes wrong

| Symptom | First move |
|---|---|
| Routine silently stopped producing reports | Check `claude.ai/code/routines` — verify trigger is still enabled and repo/connectors are linked. |
| GitHub Action shows `skipped` on a PR | Likely a fork PR or a draft PR — expected behavior. |
| Native routine disabled but workflow runs green | Expected behavior — workflow artifacts are the in-repo fallback until routine is re-enabled. |
| `pnpm routines:verify` fails | Follow the printed list of errors. Do **not** bypass the check. |
| Duplicate ops/architecture report issues | Check the title dedup: daily reports carry `YYYY-MM-DD`, weekly reports carry `YYYY-Www`. |
| Production `RED` but no incident issue | Inspect the paired workflow run; confirm the bridge artifact exists and that the native routine is attached to the repo. |

## Editing rules

1. Change the manifest first. Then update the spec. Then update the workflow.
   Run `pnpm routines:verify` before committing.
2. Do not add a routine spec without a paired workflow.
3. Do not add a `routine-*.yml` workflow without a manifest entry and spec.
4. Do not hand-edit the naming convention — specs are `<id>.md`, workflows
   are `routine-<id>.yml`.

## Related documents

- Activation runbook: [`docs/runbooks/claude-routines-activation.md`](../runbooks/claude-routines-activation.md)
- Ops commander skill: [`.claude/skills/sentinel-ops-commander/SKILL.md`](../../.claude/skills/sentinel-ops-commander/SKILL.md)
- Release checklist: [`docs/runbooks/release-checklist.md`](../runbooks/release-checklist.md)
- Production runbook: [`docs/runbooks/production.md`](../runbooks/production.md)
- Working agreement: [`docs/ai/working-agreement.md`](../ai/working-agreement.md)
