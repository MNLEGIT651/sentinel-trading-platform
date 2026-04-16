# Routine: Post-Deploy Runtime Sentinel

> Manifest id: `post-deploy-runtime-sentinel`
> Paired workflow: `.github/workflows/routine-post-deploy-runtime-sentinel.yml`
> Primary executor: Claude Code routine (GitHub event / bridge)
> Paired fallback: GitHub Action (`workflow_run`, `deployment_status`)

## Objective

After every deploy-relevant event (Vercel preview smoke run, CI success on
`main`, or a `deployment_status` update), verify runtime health end-to-end,
confirm the data-provenance UI contracts (`OfflineBanner`, `SimulatedBadge`)
are not regressed, and either confirm success or file a structured
rollback-ready issue.

## Why this belongs in Claude Code routines

- The task fires on multiple heterogeneous events and benefits from
  judgment (which signals actually matter, what to do when some are stale).
- It consumes the existing `scripts/health-check.sh` rather than reinventing
  probes, so the routine adds narrative + rollback guidance on top.
- Narrative reports (what regressed, what to roll back) are more useful than
  raw red/green on their own.

## Trigger contract

| Aspect | Value |
|---|---|
| Best primary trigger | **GitHub event (bridge)** — `workflow_run` (CI + Vercel Preview Smoke), `deployment_status` |
| Paired GitHub Action | `.github/workflows/routine-post-deploy-runtime-sentinel.yml` |
| Paired workflow trigger | `workflow_run` (`Vercel Preview Smoke`, `CI`) + `deployment_status` + `workflow_dispatch` |
| Repo attached | `stevenschling13/Trading-App` |
| Environment | `preview` (default), `production` when triggered from `main` |
| Required connectors | GitHub (required), Vercel (optional) |
| Required secrets | `GITHUB_TOKEN`, `VERCEL_PREVIEW_SMOKE_URL` (gated/optional) |

## Prompt Claude should run

```
You are the Post-Deploy Runtime Sentinel for the Sentinel Trading Platform.
Repo: stevenschling13/Trading-App.

Context passed in:
- deploy_source: vercel | railway | workflow_run
- deployment_environment: preview | production
- deployment_url (if available)
- commit_sha
- health_check_summary (raw log from scripts/health-check.sh)

Read:
1. docs/runbooks/production.md
2. docs/runbooks/preview.md
3. docs/runbooks/troubleshooting.md
4. scripts/health-check.sh (to understand what was actually probed)
5. docs/ai/review-checklist.md (Data Provenance Flows section)

Produce a markdown report:

## Post-Deploy Runtime Sentinel — <commit_sha> (<env>)

### Health check results
<table of services and pass/fail>

### UX contract checks
- OfflineBanner visible when engine unreachable? (yes/no/unknown)
- SimulatedBadge present on fallback data? (yes/no/unknown)

### Regression indicators
<list or "none detected">

### Verdict
- GREEN — deploy looks healthy
- YELLOW — soft warning; proceed with caution
- RED — rollback recommended

### If RED, recommended rollback commands
(Copy from docs/runbooks/production.md §Rollback for the relevant service)

Posting rules:
- Preview env: post as a PR comment on the associated PR (if any).
- Production env + GREEN: post as a workflow summary only.
- Production env + RED: create a GitHub issue labeled `ops,incident,deploy`,
  include the rollback commands, and tag @stevenschling13.

Constraints:
- Do NOT rollback automatically.
- Do NOT promote, redeploy, or otherwise change infra.
- Do NOT edit repo files (reports go in comments/issues/summaries only).
```

## Success criteria

- A verdict (`GREEN`, `YELLOW`, `RED`) is always produced.
- The health-check log is either attached or referenced by artifact name.
- Production `RED` always results in an incident issue with rollback commands.
- No duplicate incident issues per commit SHA.

## Output format

See "Prompt Claude should run".

## Fail conditions

- Health check artifact missing on production run (then the routine should
  emit `YELLOW` with "signals missing — investigate").
- Routine attempts a rollback or redeploy on its own.

## Escalation rules

- Production `RED` → file an `ops,incident,deploy` issue, mention
  `@stevenschling13`, include rollback commands.
- Preview `RED` → PR comment; advisory, does not block merge by itself.
- `YELLOW` twice in a row on the same environment → file a `ops,investigate`
  issue summarizing the pattern.

## What Claude may do automatically

- Read workflow artifacts, PR metadata, health check logs.
- Post PR comments or workflow summaries.
- File incident issues on production `RED` outcomes.
- Edit an existing incident issue for the same commit SHA instead of
  creating a duplicate.

## What Claude must never do automatically

- Trigger a rollback, redeploy, or promotion.
- Modify infrastructure (Vercel, Railway, Supabase).
- Edit any file in the repo.
- Auto-close the incident issue.

## Mapping to the paired GitHub Action

The workflow `.github/workflows/routine-post-deploy-runtime-sentinel.yml`:

- Fires on `workflow_run` (from `Vercel Preview Smoke` and `CI` completion)
  and `deployment_status`.
- Executes `scripts/health-check.sh` where it can (when
  `VERCEL_PREVIEW_SMOKE_URL` is available) and uploads the log as an
  artifact named `health-check-<commit_sha>-<run_id>`.
- Skips cleanly on fork PRs (secrets not available) and emits a warning
  annotation instead of failing.
- Normalizes deploy metadata into a compact JSON artifact that the routine
  can consume.

## Testing safely

1. Trigger the paired workflow via `workflow_dispatch` on a known-good SHA.
2. Inspect the `health-check-<sha>-<run>` artifact.
3. Let the native routine run on the next successful Vercel Preview Smoke
   completion for a PR; confirm a preview PR comment appears.
4. Force a synthetic failure by pointing the routine at an unreachable URL;
   confirm it produces `RED` without taking rollback actions.

## Verifying a successful run

- Workflow run completed.
- Health check artifact exists (or `YELLOW` explains its absence).
- A report posted in the expected location (PR comment / summary / issue).
- No unexpected infra changes.

## Manual activation steps (Claude Code app)

See `docs/runbooks/claude-routines-activation.md` §3.
